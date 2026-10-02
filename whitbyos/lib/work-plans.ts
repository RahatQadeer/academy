import { createClient } from "@/base/lib/supabase/server";
import { WEB_UNREACHED } from "@/whitbyos/lib/ai/draft-workplan";
import type { DraftedQuestion } from "@/whitbyos/lib/ai/draft-questions";
import { approvalsWaiting, streamDependencies } from "@/whitbyos/lib/plan-derive";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import {
  computePlanCharts,
  computePlanTrends,
  computeStreamCharts,
  type PlanCharts,
  type StreamCharts,
} from "@/whitbyos/lib/plan-math";

export type Urgency = "critical" | "high" | "medium" | "low";
export type Health = "on_track" | "needs_attention" | "at_risk";

export type WorkPlanRow = {
  id: string;
  request_id: string;
  name: string;
  status: string;
  urgency: Urgency;
  health: Health;
  target_date: string | null;
  updated_at: string;
  client_name: string;
  /** Share of this plan's tasks that are done, 0–100. */
  progress: number;
  taskTotal: number;
  taskDone: number;
  /** 6.0a-ii lists a plan by its shape as well as its state. */
  streamCount: number;
  /**
   * A plan that is not written yet and why.
   *
   * `asking` is one somebody left at its questions. It reads as a draft
   * like any other from the outside, which is how it gets lost: nothing on
   * the row says it is waiting on a person rather than on the model.
   */
  draftingState: "asking" | "drafting" | "ready" | "failed" | null;
};

function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type WorkPlanListResult =
  | { ok: true; rows: WorkPlanRow[] }
  | { ok: false; error: string };

/**
 * WP.2 — the workspace's work plans with the progress each one reports.
 *
 * Progress is counted from tasks rather than stored, so it can never drift out
 * of step with the work: SRS §6.6.10 asks for progress based on meaningful work
 * rather than a number someone typed.
 */
export async function listWorkPlans(): Promise<WorkPlanListResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [] };

  const supabase = await createClient();

  // Work plans hang off requests, which is where the workspace lives.
  const { data, error } = await supabase
    .from("whitbyos_workplans")
    .select(
      "id, request_id, name, status, urgency, health, target_date, updated_at, drafting_state, request:whitbyos_requests!request_id (id, workspace_id, client_id, client:whitbyos_clients!client_id (name))",
    )
    // "My Active Work Plans" — an archived plan is filed away and a deleted
    // one is gone from every screen. Both still exist; neither belongs here.
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  // A plan belongs to a client through its Request, which is also how it is
  // scoped to the firm — so both tests are the same pass over the same rows.
  const openClient = await getOpenClientId();

  const mine = (data ?? []).filter((row) => {
    const request = firstOf(
      row.request as { workspace_id?: string; client_id?: string | null } | null,
    );
    if (request?.workspace_id !== workspaceId) return false;
    return !openClient || request?.client_id === openClient;
  });

  if (mine.length === 0) return { ok: true, rows: [] };

  const progress = await countTaskProgress(mine.map((row) => row.id as string));

  return {
    ok: true,
    rows: mine.map((row) => {
      const request = firstOf(
        row.request as { client?: { name: string } | { name: string }[] } | null,
      );
      const client = firstOf(request?.client ?? null);
      const counts = progress.get(row.id as string) ?? { done: 0, total: 0, streams: 0 };

      return {
        id: row.id as string,
        request_id: row.request_id as string,
        name: row.name as string,
        status: row.status as string,
        urgency: (row.urgency as Urgency) ?? "medium",
        health: (row.health as Health) ?? "on_track",
        target_date: row.target_date as string | null,
        updated_at: row.updated_at as string,
        client_name: client?.name ?? "No client",
        taskDone: counts.done,
        taskTotal: counts.total,
        streamCount: counts.streams,
        progress: counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100),
        draftingState:
          (row.drafting_state as "asking" | "drafting" | "ready" | "failed" | null) ?? null,
      };
    }),
  };
}

const DONE = new Set(["complete", "completed", "done"]);

/**
 * Task counts per plan, gathered in two queries rather than one per plan.
 *
 * Counted through the plan's own Work Streams, not through its Request. The
 * Request is the wrong unit twice over: a task can sit on a Request with no
 * Work Stream at all (WP.2c leaves them behind when a plan is removed), and
 * since migration 038 dropped the unique constraint one Request may carry
 * several plans — counting by request_id would have every one of them report
 * the same figure, the union of all their work.
 */
async function countTaskProgress(planIds: string[]) {
  const counts = new Map<string, { done: number; total: number; streams: number }>();
  if (planIds.length === 0) return counts;

  const supabase = await createClient();

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, workplan_id")
    .in("workplan_id", planIds);

  const planOf = new Map<string, string>();
  for (const row of streams ?? []) {
    planOf.set(row.id as string, row.workplan_id as string);
    // The Work Stream count comes free with this read, and 6.0a-ii asks for it.
    const entry = counts.get(row.workplan_id as string) ?? { done: 0, total: 0, streams: 0 };
    entry.streams += 1;
    counts.set(row.workplan_id as string, entry);
  }
  if (planOf.size === 0) return counts;

  const { data: tasks } = await supabase
    .from("whitbyos_tasks")
    .select("workstream_id, status")
    .in("workstream_id", [...planOf.keys()]);

  for (const row of tasks ?? []) {
    const planId = planOf.get(row.workstream_id as string);
    if (!planId) continue;
    const entry = counts.get(planId) ?? { done: 0, total: 0, streams: 0 };
    entry.total += 1;
    if (DONE.has(String(row.status).toLowerCase())) entry.done += 1;
    counts.set(planId, entry);
  }

  return counts;
}

export type PlanTask = {
  id: string;
  title: string;
  status: string;
  /**
   * WP.17e marks some points on the Timeline with a diamond. Nothing records a
   * "milestone", but an approval is the nearest true thing: it is the point the
   * work stops at until somebody decides.
   */
  kind: "auto" | "approval" | "manual";
  /** WP.17d puts this beside the Work Stream on every card. */
  priority: string | null;
  due_date: string | null;
  /** WP.17d writes "Done Apr 12" on a finished card, from migration 037. */
  completed_at: string | null;
  /** §6.7.1's waiting state — what a waiting task is waiting on. */
  waiting_state: string | null;
  /** WP.6 puts the owner's avatar on every task row. */
  ownerInitials: string | null;
  ownerName: string | null;
  /** Who they are, so their photo can be fetched from our own origin. */
  ownerUserId: string | null;
  /** Whether there is a photo at all — no request where there is nothing to get. */
  ownerHasPhoto: boolean;
  /** WP.6 expands a task that has one into its own card, with a n/N count. */
  checklist: ChecklistItem[];
  /**
   * Everybody the task itself was given to (migration 044).
   *
   * Sharing is decided on the steps, and that is where drafting puts it — but
   * a task handed to two people through the Reassign dialog, or made with two
   * names on it, splits nothing and had nowhere to say so. The plan drew one
   * avatar over a task two people were on.
   */
  assigneeIds: string[];
  /** WP.17's Dependencies panel reads these to say what is blocked by what. */
  blockedByStreamId: string | null;
  blockedByTaskId: string | null;
  /** Migration 074 — what somebody needs in order to actually do this. */
  description: string | null;
  rationale: string | null;
  startDate: string | null;
  estimatedDays: number | null;
  expectedOutput: string | null;
  requiredInputs: TaskRequirement[];
  externalLinks: TaskResource[];
  providerId: string | null;
  /** Migration 075 — the kind of firm this needs, where we have nobody. */
  providerNeed: { category: string; why: string } | null;
  /**
   * Migration 101 — Whitby's first pass at a task it classified `auto`.
   *
   * Written when the plan is adopted, never shown to a client, and never a
   * reason to call the task finished. Null once somebody dismisses it.
   */
  whitbyDraft: WhitbyDraft | null;
  whitbyDraftAt: string | null;
  /**
   * Whether Whitby has had a go at this task, dismissed or not.
   *
   * Separate from `whitbyDraft` because a dismissed draft reads as none, and a
   * screen counting what Whitby could still start would otherwise offer to
   * redo the one thing somebody had just thrown away. The runner skips a task
   * that has been drafted once; this is that same rule, readable.
   */
  whitbyDraftedAlready: boolean;
};

/**
 * What Whitby produced for a task, as it is read back.
 *
 * Declared here rather than imported from the AI module so a screen that
 * renders a plan does not pull in the model client. The shape is the one
 * `auto-draft-guard` guarantees, and `readWhitbyDraft` is what enforces that
 * on the way out of the database: jsonb comes back as whatever was written,
 * including by a version of the code that no longer exists.
 */
export type WhitbyDraft = {
  summary: string;
  sections: { heading: string; body: string }[];
  openPoints: string[];
};

export function readWhitbyDraft(value: unknown): WhitbyDraft | null {
  if (!value || typeof value !== "object") return null;

  const row = value as Partial<WhitbyDraft>;
  const sections = Array.isArray(row.sections)
    ? row.sections.filter(
        (part): part is { heading: string; body: string } =>
          Boolean(part) &&
          typeof (part as { heading?: unknown }).heading === "string" &&
          typeof (part as { body?: unknown }).body === "string",
      )
    : [];

  /* No sections is no draft. An empty panel claiming Whitby did something is
     worse than the panel not being there. */
  if (sections.length === 0) return null;

  return {
    summary: typeof row.summary === "string" ? row.summary : sections[0].heading,
    sections,
    openPoints: Array.isArray(row.openPoints)
      ? row.openPoints.filter((point): point is string => typeof point === "string")
      : [],
  };
}

/** One thing a task needs before it can start, and whether the firm has it. */
export type TaskRequirement = {
  kind: "document" | "information" | "approval" | "account" | "contact";
  label: string;
  alreadyHeld?: boolean | null;
  /**
   * Who it has to come from, so the plan can ask the client for their half
   * without asking them for the firm's. See `DraftedRequirement.from`.
   * Absent on anything drafted before migration 078.
   */
  from?: "client" | "firm" | "third_party" | null;
  /**
   * What the work needs it for, in the client's own terms, and where they
   * hand it over. See `DraftedRequirement.why` and `.where`.
   *
   * Both absent on anything drafted before this existed. A screen says
   * nothing where there is nothing, rather than reaching for a reason.
   */
  why?: string | null;
  where?: NeedPlace | null;
  /**
   * Whether the firm could put a first version to the client rather than
   * asking for it blank. See `DraftedRequirement.proposable`.
   *
   * Absent on everything drafted before this existed, which reads as false.
   * An old plan keeps asking the way it always did, which is the right
   * fallback: the alternative is the product proposing content for a passport.
   */
  proposable?: boolean | null;
};

/**
 * Where something is handed over.
 *
 * Four answers rather than a sentence, because the words a client reads are
 * written here — a model that has never seen this product would send somebody
 * to a screen that does not exist.
 */
export type NeedPlace = "client_portal" | "by_post" | "in_person" | "elsewhere";

/**
 * Somewhere to go or somebody to reach.
 *
 * `verified` is carried through rather than dropped: a detail nobody checked
 * has to say so on the screen, or the screen is asserting something the
 * product does not know.
 */
export type TaskResource = {
  kind: "website" | "booking" | "authority" | "provider" | "emergency" | "contact";
  label: string;
  url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  verified?: boolean;
};

export type PlanWorkstream = {
  id: string;
  name: string;
  purpose: string | null;
  status: string;
  kind: "auto" | "approval" | "manual";
  blocked: boolean;
  /** WP.17 puts the stream's own owner on its row (§6.6.4). */
  ownerName: string | null;
  ownerInitials: string | null;
  ownerUserId: string | null;
  ownerHasPhoto: boolean;
  tasks: PlanTask[];
};

/**
 * What `schedulePlan` concluded, kept as it was written.
 *
 * Recorded rather than recomputed on every render: the dates on the tasks were
 * decided by this answer, and working it out a second time from rows that have
 * since been edited by hand would produce a warning about a plan that no longer
 * exists.
 */
export type PlanFeasibility = {
  fits: boolean;
  shortfallDays: number;
  earliestFinish: string;
  targetDate: string;
  criticalPathDays: number;
  /** Task titles, not ids — the screen says these in a sentence. */
  criticalPath: string[];
  parallelisable: string[];
  blocking: string[];
};

export type PlanRisk = {
  id: string;
  risk: string;
  impact: string;
  mitigation: string;
  backupPlan: string | null;
  trigger: string | null;
  status: string;
  workstreamId: string;
};

export type WorkPlanDetail = {
  id: string;
  request_id: string;
  request_title: string;
  client_name: string;
  /**
   * Null on the firm's own work (migration 099).
   *
   * `client_name` reads "No client" for one of those, which is a label and
   * not an answer — a screen deciding whether there is anybody to send
   * something to cannot do it by comparing against a phrase.
   */
  client_id: string | null;
  name: string;
  desired_outcome: string | null;
  status: string;
  urgency: Urgency;
  health: Health;
  location: string | null;
  /** Migration 076 — whether the web lookup behind the draft ran. */
  researchState: "ok" | "empty" | "failed" | "skipped" | null;
  /**
   * Whether the plan is still being written — 097.
   *
   * Drafting runs after the professional has been sent on their way, so a
   * plan can exist with nothing in it yet. Null on every plan made by hand
   * and every one that predates this, which read as ready.
   */
  draftingState: "asking" | "drafting" | "ready" | "failed" | null;
  /**
   * What Whitby wants to know before it drafts, and everything the drafting
   * will need once it is told. Written once, read once, cleared by nothing:
   * a scratchpad between two steps of the wizard.
   */
  draftingQuestions: DraftedQuestion[];
  /** Anything typed against those questions and left for later. */
  draftingAnswers: { question: string; answer: string }[];
  /** Why it failed, where it did. */
  draftingError: string | null;
  /** When the asking started, so a job nobody finished can be told apart. */
  draftingStartedAt: string | null;
  start_date: string | null;
  target_date: string | null;
  /** Set while the plan is filed away — the screen says so rather than hiding it. */
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  ownerName: string;
  playbookName: string | null;
  workstreams: PlanWorkstream[];
  /** The scheduler's own verdict (074), or null on a plan with no deadline. */
  feasibility: PlanFeasibility | null;
  /** §6.6's single points of failure, at last written by something. */
  risks: PlanRisk[];
  taskDone: number;
  taskTotal: number;
  progress: number;
  approvalsWaiting: number;
  /** The waiting approvals themselves, newest question first. */
  approvalTasks: { id: string; title: string; ownerName: string | null }[];
  documentCount: number;
  worksheetCount: number;
  providerCount: number;
  /** WP.17's Dependencies panel — one line per edge, written out. */
  dependencyLines: PlanDependency[];
  /** WP.17's Considerations panel (SRS §6.8), scoped to this plan. */
  considerations: PlanConsideration[];
};

export type PlanConsideration = {
  id: string;
  /** The stream it belongs to, or null for the whole plan. */
  scope: string | null;
  summary: string;
  /** What sort of thing it is, which decides how urgently it reads. */
  kind: string | null;
  /** Migration 077 — where to go to act on it, where there is such a place. */
  action: { href: string; label: string } | null;
};

/**
 * WP.17 — one plan with its Work Streams and their tasks.
 *
 * Tasks belong to a Work Stream (SRS §6.7.1), so they are fetched for the whole
 * plan in one query and grouped, rather than one query per stream.
 */
export async function getWorkPlan(planId: string): Promise<WorkPlanDetail | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select(
      "id, request_id, name, desired_outcome, status, urgency, health, location, research_state, drafting_state, drafting_error, drafting_started_at, drafting_questions, drafting_answers, start_date, target_date, created_at, updated_at, owner_user_id, source_playbook_id, archived_at, feasibility, request:whitbyos_requests!request_id (id, title, workspace_id, client:whitbyos_clients!client_id (id, name))",
    )
    .eq("id", planId)
    // A deleted plan is not openable by anybody, by link or otherwise. An
    // archived one still is — Settings → Archive restores it, and a restore
    // nobody can look at first is a restore taken on faith.
    .is("deleted_at", null)
    .maybeSingle();

  if (!plan) return null;

  type PlanRequest = {
    id: string;
    title: string;
    workspace_id: string;
    client?: { id: string; name: string } | { id: string; name: string }[];
  };

  const request = firstOf(
    plan.request as unknown as PlanRequest | PlanRequest[] | null,
  );

  // A plan reaches its workspace through its Request; anything else isn't ours.
  if (!request || request.workspace_id !== workspaceId) return null;

  const client = firstOf(request.client ?? null);

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name, purpose, status, kind, blocked, sort_order, owner_user_id")
    .eq("workplan_id", planId)
    .order("sort_order");

  const streamIds = (streams ?? []).map((row) => row.id as string);

  const { data: tasks } = streamIds.length
    ? await supabase
        .from("whitbyos_tasks")
        .select(
          "id, title, status, kind, priority, due_date, completed_at, waiting_state, workstream_id, owner_user_id, dependency_task_id, dependency_workstream_id, description, rationale, start_date, estimated_days, expected_output, required_inputs, external_links, provider_id, provider_need, whitby_draft, whitby_draft_at, whitby_draft_dismissed_at",
        )
        .in("workstream_id", streamIds)
        /* Where somebody has placed a task by hand, that is the order; the
           rest keep the order they were drafted in — 091. */
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at")
    : { data: [] };

  const taskIds = (tasks ?? []).map((task) => task.id as string);

  // Owners, checklists and assignees in one round each, rather than three per
  // task.
  const checklists = await lookupChecklists(taskIds);
  const assignedTo = await lookupAssignees(taskIds);

  // A step can belong to somebody other than the task's owner — that is how a
  // task says it takes two people — so both sets of ids are looked up at once.
  const owners = await lookupOwners([
    ...new Set([
      ...(tasks ?? []).map((t) => t.owner_user_id as string | null),
      ...[...checklists.values()].flatMap((items) =>
        items.map((item) => item.ownerUserId ?? null),
      ),
    ]),
  ]);

  // Names onto the steps, so a screen never has to look one up per row.
  for (const items of checklists.values()) {
    for (const item of items) {
      const who = item.ownerUserId ? owners.get(item.ownerUserId) : null;
      item.ownerName = who?.name ?? null;
      item.ownerInitials = who ? initialsOf(who.name) : null;
      item.ownerHasPhoto = Boolean(who?.avatarUrl);
    }
  }

  const byStream = new Map<string, PlanTask[]>();
  for (const task of tasks ?? []) {
    const list = byStream.get(task.workstream_id as string) ?? [];
    const owner = owners.get(task.owner_user_id as string) ?? null;
    list.push({
      id: task.id as string,
      title: task.title as string,
      status: task.status as string,
      kind: ((task.kind as string) ?? "manual") as PlanTask["kind"],
      priority: (task.priority as string | null) ?? null,
      due_date: task.due_date as string | null,
      completed_at: (task.completed_at as string | null) ?? null,
      waiting_state: (task.waiting_state as string | null) ?? null,
      ownerName: owner?.name ?? null,
      ownerInitials: owner ? initialsOf(owner.name) : null,
      ownerUserId: (task.owner_user_id as string | null) ?? null,
      ownerHasPhoto: Boolean(owner?.avatarUrl),
      checklist: checklists.get(task.id as string) ?? [],
      assigneeIds: assignedTo.get(task.id as string) ?? [],
      blockedByStreamId: (task.dependency_workstream_id as string | null) ?? null,
      blockedByTaskId: (task.dependency_task_id as string | null) ?? null,
      description: (task.description as string | null) ?? null,
      rationale: (task.rationale as string | null) ?? null,
      startDate: (task.start_date as string | null) ?? null,
      estimatedDays:
        task.estimated_days == null ? null : Number(task.estimated_days),
      expectedOutput: (task.expected_output as string | null) ?? null,
      // jsonb comes back parsed; anything that is not a list is treated as none
      // rather than trusted into the UI.
      requiredInputs: Array.isArray(task.required_inputs)
        ? (task.required_inputs as TaskRequirement[])
        : [],
      externalLinks: Array.isArray(task.external_links)
        ? (task.external_links as TaskResource[])
        : [],
      providerId: (task.provider_id as string | null) ?? null,
      providerNeed: readProviderNeed(task.provider_need),
      /* A dismissed draft reads as none. The row is kept so the plan can
         still say the work was done, but nothing offers it again. */
      whitbyDraft:
        task.whitby_draft_dismissed_at == null ? readWhitbyDraft(task.whitby_draft) : null,
      whitbyDraftAt:
        task.whitby_draft_dismissed_at == null
          ? ((task.whitby_draft_at as string | null) ?? null)
          : null,
      whitbyDraftedAlready: task.whitby_draft_at != null,
    });
    byStream.set(task.workstream_id as string, list);
  }

  const streamOwners = await lookupOwners(
    (streams ?? []).map((row) => row.owner_user_id as string | null),
  );

  // §6.6's risks hang off a Work Stream, so they are read with them.
  const { data: riskRows } = streamIds.length
    ? await supabase
        .from("whitbyos_risks")
        .select("id, workstream_id, risk, impact, mitigation, backup_plan, trigger, status")
        .in("workstream_id", streamIds)
        .neq("status", "closed")
    : { data: [] };

  const risks: PlanRisk[] = (riskRows ?? []).map((row) => ({
    id: row.id as string,
    workstreamId: row.workstream_id as string,
    risk: row.risk as string,
    impact: row.impact as string,
    mitigation: row.mitigation as string,
    backupPlan: (row.backup_plan as string | null) ?? null,
    trigger: (row.trigger as string | null) ?? null,
    status: (row.status as string) ?? "open",
  }));

  const workstreams: PlanWorkstream[] = (streams ?? []).map((row) => {
    const owner = streamOwners.get(row.owner_user_id as string) ?? null;
    return {
      id: row.id as string,
      name: row.name as string,
      purpose: row.purpose as string | null,
      status: row.status as string,
      kind: (row.kind as PlanWorkstream["kind"]) ?? "manual",
      blocked: Boolean(row.blocked),
      ownerName: owner?.name ?? null,
      ownerInitials: owner ? initialsOf(owner.name) : null,
      ownerUserId: (row.owner_user_id as string | null) ?? null,
      ownerHasPhoto: Boolean(owner?.avatarUrl),
      tasks: byStream.get(row.id as string) ?? [],
    };
  });

  const allTasks = workstreams.flatMap((stream) => stream.tasks);
  const done = allTasks.filter((task) => DONE.has(task.status.toLowerCase())).length;

  const [ownerName, playbookName, linked] = await Promise.all([
    lookupUserName(plan.owner_user_id as string | null),
    lookupPlaybookName(plan.source_playbook_id as string | null),
    countLinked(request.id, streamIds),
  ]);

  return {
    id: plan.id as string,
    request_id: request.id,
    request_title: request.title,
    client_name: client?.name ?? "No client",
    client_id: (client?.id as string | undefined) ?? null,
    name: plan.name as string,
    desired_outcome: plan.desired_outcome as string | null,
    status: plan.status as string,
    urgency: (plan.urgency as Urgency) ?? "medium",
    health: (plan.health as Health) ?? "on_track",
    location: plan.location as string | null,
    researchState:
      (plan.research_state as "ok" | "empty" | "failed" | "skipped" | null) ?? null,
    draftingState:
      (plan.drafting_state as "asking" | "drafting" | "ready" | "failed" | null) ?? null,
    draftingQuestions:
      ((plan.drafting_questions as { questions?: DraftedQuestion[] } | null)?.questions ?? []),
    draftingAnswers:
      ((plan.drafting_answers as { question: string; answer: string }[] | null) ?? []),
    draftingError: (plan.drafting_error as string | null) ?? null,
    draftingStartedAt: (plan.drafting_started_at as string | null) ?? null,
    start_date: plan.start_date as string | null,
    target_date: plan.target_date as string | null,
    archived_at: (plan.archived_at as string | null) ?? null,
    created_at: plan.created_at as string,
    updated_at: plan.updated_at as string,
    ownerName,
    playbookName,
    workstreams,
    risks,
    feasibility: (plan.feasibility as PlanFeasibility | null) ?? null,
    taskDone: done,
    taskTotal: allTasks.length,
    progress: allTasks.length === 0 ? 0 : Math.round((done / allTasks.length) * 100),
    // Derived in `plan-derive`, which is tested against a plan shaped the way
    // drafting produces one. Counting these here is how they came to be
    // counted on fields nothing writes.
    approvalsWaiting: approvalsWaiting(allTasks).length,
    /** Which ones, so the rail can name them rather than only count them. */
    approvalTasks: approvalsWaiting(allTasks).map((task) => ({
      id: task.id,
      title: task.title,
      ownerName: task.ownerName,
    })),
    ...linked,
    dependencyLines: dependencyLines(workstreams),
    considerations: await listConsiderations(plan.id as string, workstreams),
  };
}

/**
 * WP.17's Dependencies panel, as sentences: "Housing Search blocked by Visa &
 * Immigration". Derived from the tasks rather than stored, so it can never
 * describe an edge the work does not actually have.
 */
/** One thing in the plan waiting on another. */
export type PlanDependency = {
  /** The Work Stream or task that cannot start yet. */
  blocked: string;
  /** Where to go to see it, for a task. */
  blockedId: string | null;
  /** What it is waiting for. */
  on: string;
  onId: string | null;
  /** A whole stream waiting, or one task waiting. */
  scale: "stream" | "task";
};

/**
 * What waits on what, as a relation rather than a sentence.
 *
 * These were strings — "A blocked by B" — which is all a 280px rail box could
 * take. Read as a relation they can be drawn as one: the thing that is stuck,
 * and the thing it is stuck behind.
 */
function dependencyLines(streams: PlanWorkstream[]): PlanDependency[] {
  const names = new Map(streams.map((stream) => [stream.id, stream.name]));
  // A task may be blocked by another task in any stream, so every task in the
  // plan has to be findable by id, not just the ones in the stream being read.
  const taskTitles = new Map(
    streams.flatMap((stream) => stream.tasks.map((task) => [task.id, task.title] as const)),
  );
  const seen = new Map<string, PlanDependency>();

  for (const stream of streams) {
    for (const task of stream.tasks) {
      if (task.blockedByStreamId && names.has(task.blockedByStreamId)) {
        const on = names.get(task.blockedByStreamId)!;
        seen.set(`s:${stream.name}>${on}`, {
          blocked: stream.name,
          blockedId: stream.id,
          on,
          onId: task.blockedByStreamId,
          scale: "stream",
        });
      }

      // Stream-level first: a whole stream waiting on another is the coarser
      // fact and the one WP.17 leads with. This is the finer one, and it was
      // being recorded and then never read.
      if (task.blockedByTaskId && taskTitles.has(task.blockedByTaskId)) {
        const on = taskTitles.get(task.blockedByTaskId)!;
        seen.set(`t:${task.title}>${on}`, {
          blocked: task.title,
          blockedId: task.id,
          on,
          onId: task.blockedByTaskId,
          scale: "task",
        });
      }
    }
  }

  // Whole streams before single tasks: the coarser fact is the one to read
  // first, and it usually explains the finer ones under it.
  return [...seen.values()].sort((a, b) => (a.scale === b.scale ? 0 : a.scale === "stream" ? -1 : 1));
}

/**
 * SRS §6.8.9 — a Consideration's scope may be the whole Workplan or one
 * Workstream, which is why the export now shows them on the plan they are
 * about rather than only under Insights.
 */
async function listConsiderations(
  planId: string,
  streams: PlanWorkstream[],
): Promise<PlanConsideration[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_considerations")
    .select("id, workplan_id, workstream_id, type, body, status, action_href, action_label")
    .eq("workplan_id", planId);

  const names = new Map(streams.map((stream) => [stream.id, stream.name]));

  return (data ?? [])
    .filter((row) => !["dismissed", "resolved"].includes(String(row.status).toLowerCase()))
    /* The web-lookup notice is drawn from `researchState` in a banner that
       carries the button to fix it, so a saved copy can only ever contradict
       it. Plans drafted before it stopped being written still hold one. */
    .filter((row) => String(row.body) !== WEB_UNREACHED)
    .map((row) => ({
      id: row.id as string,
      scope: names.get(row.workstream_id as string) ?? null,
      summary: (row.body as string) ?? "",
      kind: (row.type as string) ?? null,
      action:
        row.action_href && row.action_label
          ? { href: row.action_href as string, label: row.action_label as string }
          : null,
    }))
    .filter((row) => row.summary.length > 0);
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Names and faces for a set of user ids, in one query.
 *
 * The picture comes back with the name because every avatar on these screens
 * falls back to initials, and initials are what somebody who has uploaded a
 * photo sees when nobody fetched it.
 */
async function lookupOwners(ids: (string | null)[]) {
  const real = ids.filter((id): id is string => Boolean(id));
  const names = new Map<string, { name: string; avatarUrl: string | null }>();
  if (real.length === 0) return names;

  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, preferred_name, email, avatar_url")
    .in("id", real);

  for (const user of data ?? []) {
    names.set(user.id as string, {
      name:
        (user.preferred_name as string) ||
        (user.full_name as string) ||
        (user.email as string) ||
        "Teammate",
      avatarUrl: (user.avatar_url as string | null) ?? null,
    });
  }
  return names;
}

/** Task checklists for a whole plan, in one query. */
/** Who each task was handed to, in the order they were handed it. */
async function lookupAssignees(taskIds: string[]) {
  const byTask = new Map<string, string[]>();
  if (taskIds.length === 0) return byTask;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_task_assignees")
    .select("task_id, user_id, sort_order")
    .in("task_id", taskIds)
    .order("sort_order");

  for (const row of data ?? []) {
    const key = row.task_id as string;
    byTask.set(key, [...(byTask.get(key) ?? []), row.user_id as string]);
  }

  return byTask;
}

async function lookupChecklists(taskIds: string[]) {
  const byTask = new Map<string, ChecklistItem[]>();
  if (taskIds.length === 0) return byTask;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_checklists")
    .select("task_id, items")
    .in("task_id", taskIds);

  for (const row of data ?? []) {
    byTask.set(row.task_id as string, readChecklist(row.items));
  }
  return byTask;
}

async function lookupUserName(userId: string | null) {
  if (!userId) return "Unassigned";
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("full_name, preferred_name")
    .eq("id", userId)
    .maybeSingle();
  return (data?.preferred_name as string) || (data?.full_name as string) || "Unassigned";
}

async function lookupPlaybookName(playbookId: string | null) {
  if (!playbookId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_playbooks")
    .select("name")
    .eq("id", playbookId)
    .maybeSingle();
  return (data?.name as string) ?? null;
}

/** WP.17's Linked panel. */
async function countLinked(requestId: string, streamIds: string[]) {
  const supabase = await createClient();

  const documents = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("context_type", "request")
    .eq("context_id", requestId);

  const worksheets = streamIds.length
    ? await supabase
        .from("whitbyos_worksheets")
        .select("id", { count: "exact", head: true })
        .in("workstream_id", streamIds)
    : { count: 0 };

  const providers = await supabase
    .from("whitbyos_provider_options")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId);

  return {
    documentCount: documents.count ?? 0,
    worksheetCount: worksheets.count ?? 0,
    providerCount: providers.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// WP.18 / WP.19 — what the two edit dialogs need
// ---------------------------------------------------------------------------

/** One row of a Task's checklist, as stored in `whitbyos_checklists.items`. */
export type ChecklistItem = {
  text: string;
  done: boolean;
  /**
   * Who does this one, where the task is shared.
   *
   * A task has a single owner, and some tasks genuinely take two people — one
   * arranges access and another attends, one drafts and another approves. The
   * task's owner leads it; this says which steps are somebody else's, so
   * "two people on this" is answerable with who does what rather than a
   * second avatar and a guess. Null means the task's own owner.
   */
  ownerUserId?: string | null;
  ownerName?: string | null;
  ownerInitials?: string | null;
  ownerHasPhoto?: boolean;
};

export type TaskEdit = {
  id: string;
  title: string;
  workstream_id: string | null;
  owner_user_id: string | null;
  /** yyyy-mm-dd, which is what `<input type="date">` reads and writes. */
  due_date: string;
  status: string;
  priority: string | null;
  next_action: string | null;
  /**
   * WP.18's Dependency, as one value the select can hold. `ws:<id>` is a Work
   * Stream, `task:<id>` another Task, empty is None — the field offers one
   * blocker across both kinds, so one string is what the form needs.
   */
  dependency: string;
  checklist: ChecklistItem[];
  /**
   * `visibility_level` — internal, client_visible or restricted. WP.18's
   * "Visible to the client" box reads it, and a client-visible task on a
   * shared plan is the only task the client's portal lists under its stream.
   */
  visibility: string;
};

export type WorkstreamEdit = {
  id: string;
  name: string;
  status: string;
  blocked: boolean;
  /** `yyyy-mm-dd`, ready for a date input. */
  targetDate: string;
  taskCount: number;
};

/** `hasPhoto` so a picker can show the face rather than the initials under it. */
export type Assignee = { id: string; name: string; hasPhoto: boolean };

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Migration 075's column, only where it says something usable. */
function readProviderNeed(value: unknown): { category: string; why: string } | null {
  if (!value || typeof value !== "object") return null;

  const row = value as { category?: unknown; why?: unknown };
  const category = typeof row.category === "string" ? row.category.trim() : "";
  if (!category) return null;

  return { category, why: typeof row.why === "string" ? row.why.trim() : "" };
}

export function readChecklist(items: unknown): ChecklistItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item): ChecklistItem[] => {
    if (typeof item === "string") return [{ text: item, done: false, ownerUserId: null }];
    if (item && typeof item === "object") {
      const row = item as {
        text?: unknown;
        label?: unknown;
        done?: unknown;
        ownerUserId?: unknown;
      };
      const text = String(row.text ?? row.label ?? "").trim();
      if (!text) return [];
      return [
        {
          text,
          done: Boolean(row.done),
          ownerUserId: typeof row.ownerUserId === "string" ? row.ownerUserId : null,
        },
      ];
    }
    return [];
  });
}

/** WP.18 — the Task behind the Edit Task modal, with its checklist. */
export async function getTaskEdit(taskId: string): Promise<TaskEdit | null> {
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("whitbyos_tasks")
    .select(
      "id, title, workstream_id, owner_user_id, due_date, status, priority, next_action, dependency_task_id, dependency_workstream_id, visibility",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return null;

  const { data: checklist } = await supabase
    .from("whitbyos_checklists")
    .select("items")
    .eq("task_id", taskId)
    .maybeSingle();

  return {
    id: task.id as string,
    title: task.title as string,
    workstream_id: task.workstream_id as string | null,
    owner_user_id: task.owner_user_id as string | null,
    due_date: toDateInput(task.due_date as string | null),
    status: task.status as string,
    priority: (task.priority as string | null) ?? null,
    next_action: (task.next_action as string | null) ?? null,
    dependency: task.dependency_workstream_id
      ? `ws:${task.dependency_workstream_id}`
      : task.dependency_task_id
        ? `task:${task.dependency_task_id}`
        : "",
    checklist: readChecklist(checklist?.items),
    visibility: (task.visibility as string | null) ?? "internal",
  };
}

export type DependencyOption = { value: string; label: string };

/**
 * WP.18's Dependency select — the Work Streams and Tasks in this plan that a
 * task can be blocked by, minus itself.
 *
 * The reference also lists a "Blocking:" option. That is the same edge read
 * from the other end, recorded by the task that is blocked, so it is not
 * offered here — storing both directions means two rows that can disagree
 * about one fact.
 */
export async function listDependencyOptions(
  plan: WorkPlanDetail,
  exceptTaskId?: string,
): Promise<DependencyOption[]> {
  const options: DependencyOption[] = [];

  for (const stream of plan.workstreams) {
    options.push({
      value: `ws:${stream.id}`,
      label: `Blocked by: ${stream.name} (Work Stream)`,
    });
  }

  for (const stream of plan.workstreams) {
    for (const task of stream.tasks) {
      if (task.id === exceptTaskId) continue;
      options.push({ value: `task:${task.id}`, label: `Blocked by: ${task.title}` });
    }
  }

  return options;
}

/** WP.19 — the Work Stream behind the Edit Work Stream modal. */
export async function getWorkstreamEdit(
  streamId: string,
): Promise<WorkstreamEdit | null> {
  const supabase = await createClient();

  const { data: stream } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name, status, blocked, target_date")
    .eq("id", streamId)
    .maybeSingle();

  if (!stream) return null;

  // WP.19 warns how much removing the stream would take with it.
  const { count } = await supabase
    .from("whitbyos_tasks")
    .select("id", { count: "exact", head: true })
    .eq("workstream_id", streamId);

  return {
    id: stream.id as string,
    name: stream.name as string,
    status: stream.status as string,
    blocked: Boolean(stream.blocked),
    targetDate: toDateInput(stream.target_date as string | null),
    taskCount: count ?? 0,
  };
}

/**
 * WP.18's Assignee list — the people in this workspace.
 *
 * A Task's owner has to be a member (§5.1), so the list is the membership
 * rather than every user the query can see.
 */
export async function listAssignees(): Promise<Assignee[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  const ids = (members ?? []).map((row) => row.user_id as string);
  if (ids.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, preferred_name, email, avatar_url")
    .in("id", ids);

  return (users ?? [])
    .map((user) => ({
      id: user.id as string,
      name:
        (user.preferred_name as string) ||
        (user.full_name as string) ||
        (user.email as string) ||
        "Teammate",
      hasPhoto: Boolean(user.avatar_url),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}


/** Plans offered when saving one as a Playbook (6.0a's other starting point). */
export async function listWorkPlanOptions(): Promise<{ id: string; title: string }[]> {
  const result = await listWorkPlans();
  return result.ok ? result.rows.map((row) => ({ id: row.id, title: row.name })) : [];
}


export type WorkstreamDetail = {
  id: string;
  planId: string;
  planName: string;
  clientName: string;
  name: string;
  purpose: string | null;
  status: string;
  blocked: boolean;
  ownerName: string | null;
  ownerInitials: string | null;
  ownerUserId: string | null;
  ownerHasPhoto: boolean;
  position: number;
  totalStreams: number;
  targetDate: string | null;
  createdAt: string;
  tasks: PlanTask[];
  /** WP.17g's Dependencies panel — what this stream holds up. */
  blocks: string[];
  blockedBy: string[];
  /** Tasks here that follow other tasks here: the stream's own order. */
  internalWaits: number;
};

/**
 * WP.17g–i — one Work Stream on its own.
 *
 * Read through `getWorkPlan` rather than queried separately: the panels want
 * the stream's place in the plan ("Work Stream 1 of 3") and what it blocks,
 * both of which are facts about the plan rather than the stream. Asking twice
 * is how two screens end up disagreeing about the same number.
 */
export async function getWorkstreamDetail(
  planId: string,
  streamId: string,
): Promise<WorkstreamDetail | null> {
  const plan = await getWorkPlan(planId);
  if (!plan) return null;

  const index = plan.workstreams.findIndex((row) => row.id === streamId);
  if (index === -1) return null;

  const stream = plan.workstreams[index]!;

  // See `plan-derive`: both directions and the stream's own order, worked out
  // from `blockedByTaskId`, which is what drafting writes.
  const { blocks, blockedBy, internalWaits } = streamDependencies(plan.workstreams, streamId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_workstreams")
    .select("target_date, created_at")
    .eq("id", streamId)
    .maybeSingle();

  return {
    id: stream.id,
    planId,
    planName: plan.name,
    clientName: plan.client_name,
    name: stream.name,
    purpose: stream.purpose,
    status: stream.status,
    blocked: stream.blocked,
    ownerName: stream.ownerName,
    ownerInitials: stream.ownerInitials,
    ownerUserId: stream.ownerUserId,
    ownerHasPhoto: stream.ownerHasPhoto,
    position: index + 1,
    totalStreams: plan.workstreams.length,
    targetDate: (data?.target_date as string | null) ?? null,
    createdAt: (data?.created_at as string) ?? plan.created_at,
    tasks: stream.tasks,
    blocks,
    internalWaits,
    blockedBy,
  };
}

export type PlanLinks = {
  streams: number;
  tasks: number;
  documents: number;
  hasRequest: boolean;
};

/**
 * What WP.2c has to name before it deletes anything.
 *
 * The counts are the point of the screen: a Work Plan is rarely on its own,
 * and the difference between the two buttons is exactly what these numbers
 * say. Read at the moment the dialog opens rather than carried on the row,
 * since the row does not need them and there may be many rows.
 */
export async function getPlanLinks(planId: string): Promise<PlanLinks> {
  const workspaceId = await getCurrentWorkspaceId();
  const empty = { streams: 0, tasks: 0, documents: 0, hasRequest: false };
  if (!workspaceId) return empty;

  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, request_id")
    .eq("id", planId)
    .maybeSingle();

  if (!plan) return empty;

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id")
    .eq("workplan_id", planId);

  const streamIds = (streams ?? []).map((row) => row.id as string);

  const [{ count: tasks }, { count: documents }] = await Promise.all([
    streamIds.length > 0
      ? supabase
          .from("whitbyos_tasks")
          .select("id", { count: "exact", head: true })
          .in("workstream_id", streamIds)
      : Promise.resolve({ count: 0 }),
    plan.request_id
      ? supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("context_id", plan.request_id as string)
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    streams: streamIds.length,
    tasks: tasks ?? 0,
    documents: documents ?? 0,
    hasRequest: Boolean(plan.request_id),
  };
}

// ---------------------------------------------------------------------------
// WP.17j — the plan's charts
// ---------------------------------------------------------------------------

// The arithmetic lives in `plan-math.ts`, which touches no database, so the
// Client Portal draws a shared plan's charts from the same functions. The names
// are re-exported so every screen importing them from here still does.
export { CHART_STATES } from "@/whitbyos/lib/plan-math";
export type { ChartState, PlanCharts, StreamCharts } from "@/whitbyos/lib/plan-math";

/**
 * Everything WP.17j draws, in one pass over the plan's tasks.
 *
 * Read here rather than off `getWorkPlan` because the charts need three fields
 * the rest of the screen never shows — when a task was made, when it was
 * finished, and what it is waiting on — and loading those for every visit to
 * WP.17 would be paying for a tab most people do not open.
 */
export async function getPlanCharts(planId: string): Promise<PlanCharts | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name, status")
    .eq("workplan_id", planId)
    .order("sort_order");

  const rows = streams ?? [];
  const streamIds = rows.map((row) => row.id as string);

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("target_date, created_at")
    .eq("id", planId)
    .maybeSingle();

  const { data: tasks } = streamIds.length
    ? await supabase
        .from("whitbyos_tasks")
        .select(
          "id, status, waiting_state, due_date, created_at, completed_at, workstream_id, owner_user_id",
        )
        .in("workstream_id", streamIds)
    : { data: [] };

  const all = tasks ?? [];

  const ownerIds = [
    ...new Set(all.map((row) => row.owner_user_id as string | null).filter(Boolean)),
  ] as string[];

  const names = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: people } = await supabase
      .from("users")
      .select("id, full_name, preferred_name")
      .in("id", ownerIds);
    for (const row of people ?? []) {
      names.set(
        row.id as string,
        (row.preferred_name as string) || (row.full_name as string) || "Someone",
      );
    }
  }

  return computePlanCharts({
    streams: rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      status: String(row.status),
    })),
    tasks: all.map((row) => ({
      status: String(row.status),
      waiting_state: (row.waiting_state as string | null) ?? null,
      due_date: (row.due_date as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
      completed_at: (row.completed_at as string | null) ?? null,
      workstream_id: (row.workstream_id as string | null) ?? null,
      ownerName: names.get(row.owner_user_id as string) ?? null,
    })),
    targetDate: (plan?.target_date as string | null) ?? null,
    createdAt: (plan?.created_at as string | null) ?? null,
  });
}

/**
 * A stream's completions over time, for the spark on WP.17c's card.
 *
 * One query for the whole grid rather than one per card — the plan's tasks are
 * read once and split by stream in `computePlanTrends`.
 */
export async function getPlanTrends(planId: string): Promise<Map<string, number[]>> {
  const supabase = await createClient();
  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id")
    .eq("workplan_id", planId);

  const ids = (streams ?? []).map((row) => row.id as string);
  if (ids.length === 0) return new Map();

  const { data: tasks } = await supabase
    .from("whitbyos_tasks")
    .select("workstream_id, completed_at")
    .in("workstream_id", ids)
    .not("completed_at", "is", null)
    .order("completed_at");

  return computePlanTrends(
    ids,
    (tasks ?? []).map((row) => ({
      workstream_id: (row.workstream_id as string | null) ?? null,
      completed_at: (row.completed_at as string | null) ?? null,
    })),
  );
}

/** WP.17k — the same charts as WP.17j, for one Work Stream. */
export async function getStreamCharts(
  planId: string,
  streamId: string,
): Promise<StreamCharts | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();

  const { data: stream } = await supabase
    .from("whitbyos_workstreams")
    .select("id, target_date, workplan_id")
    .eq("id", streamId)
    .eq("workplan_id", planId)
    .maybeSingle();

  if (!stream) return null;

  const [{ data: tasks }, { count: documents }] = await Promise.all([
    supabase
      .from("whitbyos_tasks")
      .select("id, status, waiting_state, created_at, completed_at, kind, due_date")
      .eq("workstream_id", streamId),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("context_type", "workstream")
      .eq("context_id", streamId),
  ]);

  /**
   * When this stream is due, whether or not anybody set a date on it.
   *
   * `whitbyos_workstreams.target_date` is a field somebody fills in by hand,
   * and on a drafted plan nobody ever does — so "Days remaining" read "Not
   * known" on every Work Stream of every plan, next to tasks that all had
   * dates. A stream finishes when its last task is due. That is derived, not
   * invented, and it is the answer the tile was asking for.
   *
   * Worked out here rather than inside `computeStreamCharts`: that function is
   * shared with the Client Portal, which reads its rows through a database
   * function of its own, and a fallback that depends on a column one caller
   * selects and the other does not belongs with the caller that selects it.
   */
  const latestDue =
    (tasks ?? [])
      .map((row) => (row.due_date as string | null) ?? null)
      .filter((due): due is string => Boolean(due))
      .sort()
      .at(-1) ?? null;

  return computeStreamCharts({
    tasks: (tasks ?? []).map((row) => ({
      status: String(row.status),
      waiting_state: (row.waiting_state as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
      completed_at: (row.completed_at as string | null) ?? null,
      kind: (row.kind as string | null) ?? null,
    })),
    targetDate: (stream.target_date as string | null) ?? latestDue,
    documents: documents ?? 0,
  });
}

export type ExportExtras = {
  /** What a task carries beyond its title, by task id. */
  notes: Map<string, { nextAction: string | null; evidence: string | null }>;
  /** Documents filed against each Work Stream, by stream id. */
  documents: Map<string, string[]>;
};

/**
 * The two things WP.22 can add to the document, fetched only when asked for.
 *
 * "Task notes and attachments" is read as widely as the schema allows and no
 * wider. The notes are the two free-text fields a task actually has — what
 * happens next, and what proved it was done. The attachments are the documents
 * filed against the Work Stream, because `document_context_type` reaches a
 * Work Stream and stops there: nothing in the schema attaches a document to a
 * single task, and pretending otherwise would put files under headings they
 * were never filed under.
 */
export async function getExportExtras(streamIds: string[]): Promise<ExportExtras> {
  const notes = new Map<string, { nextAction: string | null; evidence: string | null }>();
  const documents = new Map<string, string[]>();
  if (streamIds.length === 0) return { notes, documents };

  const supabase = await createClient();

  const [tasks, files] = await Promise.all([
    supabase
      .from("whitbyos_tasks")
      .select("id, next_action, completion_evidence")
      .in("workstream_id", streamIds),
    supabase
      .from("documents")
      .select("title, context_id")
      .eq("context_type", "workstream")
      .in("context_id", streamIds)
      .order("created_at"),
  ]);

  for (const row of tasks.data ?? []) {
    const nextAction = (row.next_action as string | null)?.trim() || null;
    const evidence = (row.completion_evidence as string | null)?.trim() || null;
    if (nextAction || evidence) notes.set(row.id as string, { nextAction, evidence });
  }

  for (const row of files.data ?? []) {
    const streamId = row.context_id as string;
    documents.set(streamId, [...(documents.get(streamId) ?? []), row.title as string]);
  }

  return { notes, documents };
}

export type PlanContextCounts = {
  documents: number;
  contacts: number;
  requests: number;
};

/**
 * What WP.5's first line reports — "12 documents, 3 contacts, 2 related
 * requests".
 *
 * Counted here rather than written into the screen, because the sentence is a
 * claim about this client's file and the screen is in no position to make it.
 * Three head counts, so nothing is loaded that is only going to be tallied.
 */
export async function getPlanContextCounts(clientId: string): Promise<PlanContextCounts> {
  const supabase = await createClient();

  const [documents, contacts, requests] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("context_type", "client")
      .eq("context_id", clientId),
    supabase
      .from("contact_roles")
      .select("id", { count: "exact", head: true })
      .eq("related_type", "client")
      .eq("related_id", clientId),
    supabase
      .from("whitbyos_requests")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
  ]);

  return {
    documents: documents.count ?? 0,
    contacts: contacts.count ?? 0,
    requests: requests.count ?? 0,
  };
}

export type StreamProvider = { id: string; optionId: string; name: string; status: string };

/**
 * WP.17c names the provider on each Work Stream's card, and the stream's own
 * screen lists them.
 *
 * A provider option belongs to the Request; migration 039 records which Work
 * Stream it was brought in for. Options with no stream against them are the
 * engagement's rather than one part of it, and are left out here — the card is
 * asking "who is doing this piece", not "who is on the job".
 */
export async function listStreamProviders(
  streamIds: string[],
): Promise<Map<string, StreamProvider[]>> {
  const byStream = new Map<string, StreamProvider[]>();
  if (streamIds.length === 0) return byStream;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_provider_options")
    .select(
      "id, provider_id, status, workstream_id, provider:whitbyos_providers!provider_id (id, contact:contacts!contact_id (first_name, last_name), company:companies!company_id (name))",
    )
    .in("workstream_id", streamIds);

  for (const row of data ?? []) {
    const provider = firstOf(row.provider) as
      | { id?: string; contact?: unknown; company?: unknown }
      | null;
    if (!provider) continue;

    const company = firstOf(provider.company) as { name?: string } | null;
    const contact = firstOf(provider.contact) as
      | { first_name?: string; last_name?: string }
      | null;

    const name =
      company?.name ||
      [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
      "Provider";

    const streamId = row.workstream_id as string;
    byStream.set(streamId, [
      ...(byStream.get(streamId) ?? []),
      {
        id: provider.id as string,
        optionId: row.id as string,
        name,
        status: String(row.status ?? ""),
      },
    ]);
  }

  return byStream;
}

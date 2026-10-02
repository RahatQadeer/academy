import { createClient } from "@/base/lib/supabase/server";
import { readChecklist, readWhitbyDraft, type ChecklistItem, type TaskRequirement, type TaskResource, type WhitbyDraft } from "@/whitbyos/lib/work-plans";
import { peopleOnTask, type StepOwner } from "@/whitbyos/lib/task-people";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

export type TaskRow = {
  id: string;
  title: string;
  request_id: string | null;
  request_title: string | null;
  priority: string | null;
  status: string;
  due_date: string | null;
  next_action: string | null;
  /** Screen 7's Assignees column, which stacks however many there are. */
  assignees: Array<{
    userId: string;
    name: string | null;
    initials: string;
    hasPhoto: boolean;
  }>;
  /** 16z's "Client / Workspace", which a task may answer with nobody. */
  clientId: string | null;
  clientName: string | null;
  /**
   * The Work Plan this task belongs to, where it belongs to one.
   *
   * A drafted task carries its steps, what it needs first, what it produces
   * and who to ring — all of it written by drafting and all of it reachable
   * only from the plan's own task page. Screen 7 was opening a dialog of eight
   * fields over rows that had four times that much on them, because it had no
   * way of knowing the page existed.
   */
  planId: string | null;
};

export type TaskListResult =
  | { ok: true; rows: TaskRow[] }
  | { ok: false; error: string };

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Screen 7 — My Tasks, across every Request rather than inside one.
 *
 * SRS §6.7.1 says a Task "surfaces in the global My Tasks and Team Tasks
 * views", which is what makes this a screen of its own rather than a tab on a
 * Request. Unfinished work comes first, then by when it is due — an undated
 * task sorts last, since it is the one nothing is waiting on.
 */
export async function listTasks(): Promise<TaskListResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [] };

  const supabase = await createClient();
  const query = supabase
    .from("whitbyos_tasks")
    .select(
      "id, title, request_id, client_id, owner_user_id, priority, status, due_date, next_action, request:whitbyos_requests!request_id (id, title, client_id, client:whitbyos_clients!client_id (id, name)), client:whitbyos_clients!client_id (id, name), stream:whitbyos_workstreams!workstream_id (workplan_id)",
    )
    .eq("workspace_id", workspaceId);

  const { data, error } = await query;

  if (error) return { ok: false, error: error.message };

  /*
   * A plan that is put away takes its tasks with it.
   *
   * Deleting or archiving a Work Plan writes a date on the plan and leaves its
   * workstreams and their tasks exactly where they were, so tasks belonging to
   * plans nobody is working on were still counted in My Tasks and chased in
   * Overdue. A deleted plan's tasks opened nothing at all, since the plan's
   * own page refuses a deleted plan: every press was a 404.
   *
   * Archived counts too, because that is what filing a plan away means. The
   * plan stays readable and restorable from Settings; its work is not work
   * anybody is being asked to do this week.
   *
   * Filtered on read rather than written onto the tasks. Nothing is destroyed,
   * restoring a plan brings its work back with it, and the one place that
   * decides what "live work" means is the one place that lists it.
   *
   * And a task on no plan at all does not appear here.
   *
   * This screen is the work of the plans being worked on. 87 of this
   * workspace's tasks belong to no Work Stream — made by hand, or by a path
   * that predates plans carrying their own work — and none of them has a step
   * written down, so opening one shows a title and nothing to do.
   *
   * The consequence is worth naming: a task made with "+ New Task" here has no
   * Work Stream either, so it will not appear in this list. That button needs
   * to either attach what it makes to a plan or go.
   */
  const planOf = (row: { stream?: unknown }) =>
    firstOf(
      row.stream as unknown as
        | { workplan_id: string | null }
        | { workplan_id: string | null }[]
        | null,
    )?.workplan_id ?? null;

  const referenced = [
    ...new Set((data ?? []).map(planOf).filter((id): id is string => Boolean(id))),
  ];

  const openable = new Set<string>();
  if (referenced.length > 0) {
    const { data: plans } = await supabase
      .from("whitbyos_workplans")
      .select("id")
      .in("id", referenced)
      .is("deleted_at", null)
      .is("archived_at", null);

    for (const plan of plans ?? []) openable.add(plan.id as string);
  }

  /* Whose work this is, decided once on Workspace Overview — and asked of the
     Request where the task itself does not say. */
  const openClient = await getOpenClientId();

  const clientOf = (row: { client_id?: unknown; request?: unknown }) =>
    (row.client_id as string | null) ??
    firstOf(row.request as unknown as { client_id: string | null } | { client_id: string | null }[] | null)
      ?.client_id ??
    null;

  const running = (data ?? []).filter((row) => {
    const plan = planOf(row);
    if (!plan || !openable.has(plan)) return false;
    return !openClient || clientOf(row) === openClient;
  });

  const taskIds = running.map((row) => row.id as string);

  // Who is on each task. owner_user_id is the first of them and is written
  // from the same place, so a task that predates migration 044 — and has a
  // column but no rows — still shows its person.
  const assignedTo = new Map<string, string[]>();
  if (taskIds.length > 0) {
    const { data: links } = await supabase
      .from("whitbyos_task_assignees")
      .select("task_id, user_id, sort_order")
      .in("task_id", taskIds)
      .order("sort_order");

    for (const link of links ?? []) {
      const key = link.task_id as string;
      assignedTo.set(key, [...(assignedTo.get(key) ?? []), link.user_id as string]);
    }
  }

  /*
   * The people a drafted task is actually shared between.
   *
   * `whitbyos_task_assignees` is written by the Reassign dialog and by nothing
   * else: three rows across three hundred tasks. Drafting splits a task by
   * putting a person on each *step*, which is where "two people on this task"
   * genuinely lives — and Screen 7 was reading neither, falling back to
   * `owner_user_id` and drawing one avatar over a task three people are on.
   * The plan's own task page has read the steps all along, so the two screens
   * answered the same question differently.
   *
   * Owner first, since they lead it, then whoever else holds a step.
   */
  const stepOwners = new Map<string, StepOwner[]>();
  if (taskIds.length > 0) {
    const { data: lists } = await supabase
      .from("whitbyos_checklists")
      .select("task_id, items")
      .in("task_id", taskIds);

    for (const row of lists ?? []) {
      stepOwners.set(
        row.task_id as string,
        (Array.isArray(row.items) ? row.items : []).map((item) => ({
          ownerUserId:
            typeof (item as { ownerUserId?: unknown })?.ownerUserId === "string"
              ? ((item as { ownerUserId: string }).ownerUserId ?? null)
              : null,
        })),
      );
    }
  }

  for (const row of running) {
    const key = row.id as string;
    if (assignedTo.has(key)) continue;

    const people = peopleOnTask(
      (row.owner_user_id as string | null) ?? null,
      stepOwners.get(key) ?? [],
    );

    if (people.length > 0) assignedTo.set(key, people.map((person) => person.userId));
  }

  const ownerIds = [...new Set([...assignedTo.values()].flat())];

  const owners = new Map<string, { name: string; avatar: boolean }>();
  if (ownerIds.length > 0) {
    const { data: people } = await supabase
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", ownerIds);

    for (const person of people ?? []) {
      owners.set(person.id as string, {
        name: (person.full_name as string | null) ?? "",
        avatar: Boolean(person.avatar_url),
      });
    }
  }

  const rows: TaskRow[] = running.map((row) => {
    const request = firstOf(
      row.request as unknown as
        | { id: string; title: string; client_id: string | null; client: unknown }
        | { id: string; title: string; client_id: string | null; client: unknown }[]
        | null,
    );

    /*
     * Whose work it is, which is mostly not written on the task.
     *
     * 340 of this workspace's 353 tasks carry no `client_id` at all: drafting
     * writes a task under a Work Stream and the client is a fact about the
     * plan's Request, not about the row. Reading the column alone meant that
     * with a client workspace open, My Tasks showed the two tasks somebody had
     * typed by hand and none of the sixteen on their plan.
     *
     * So the Request answers it where the task does not. Nothing is written
     * back: the Request is the record either way, and a copy on the task is a
     * second version of one fact.
     */
    const viaRequest = firstOf(
      request?.client as unknown as { id: string; name: string } | { id: string; name: string }[] | null,
    );

    const clientId = (row.client_id as string | null) ?? request?.client_id ?? null;
    const clientName =
      firstOf(row.client as unknown as { name: string } | { name: string }[] | null)?.name ??
      viaRequest?.name ??
      null;

    return {
      id: row.id as string,
      title: row.title as string,
      request_id: (row.request_id as string | null) ?? null,
      request_title: request?.title ?? null,
      priority: (row.priority as string | null) ?? null,
      status: (row.status as string) ?? "not_started",
      due_date: (row.due_date as string | null) ?? null,
      next_action: (row.next_action as string | null) ?? null,
      assignees: (assignedTo.get(row.id as string) ?? []).map((userId) => {
        const person = owners.get(userId);
        return {
          userId,
          name: person?.name || null,
          initials: initialsOf(person?.name ?? null) ?? "··",
          hasPhoto: person?.avatar ?? false,
        };
      }),
      clientId,
      clientName,
      // Every plan still on this list is one being worked on; the deleted and
      // archived ones went with their tasks above.
      planId: planOf(row),
    };
  });

  const DONE = new Set(["complete", "completed", "done"]);
  const rank = (task: TaskRow) => (DONE.has(task.status.toLowerCase()) ? 1 : 0);
  const when = (task: TaskRow) =>
    task.due_date ? new Date(task.due_date).getTime() : Number.MAX_SAFE_INTEGER;

  rows.sort((a, b) => rank(a) - rank(b) || when(a) - when(b) || a.title.localeCompare(b.title));

  return { ok: true, rows };
}

/** Two letters at most, from whatever the name gives up. */
function initialsOf(name: string | null) {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

export type TaskDetail = {
  id: string;
  title: string;
  request_id: string | null;
  request_title: string | null;
  workstream_name: string | null;
  /** 16a writes them out in full under the stacked avatars, joined by commas. */
  ownerName: string;
  /**
   * The same people, one at a time, with what it takes to draw each of them.
   *
   * `ownerName` is every assignee's name joined into one string, which is what
   * 16a's line under the avatars wants and is useless to anything drawing a
   * person: the task page put "Sabahat Qadeer, Hazel Summers" beside a single
   * blank avatar, because a joined string has no initials and no photo.
   */
  people: { userId: string; name: string; initials: string; hasPhoto: boolean }[];
  owner_user_id: string | null;
  assigneeIds: string[];
  priority: string | null;
  status: string;
  due_date: string | null;
  dependency: string | null;
  visibility: string;
  next_action: string | null;
  completion_evidence: string | null;
  /**
   * What drafting worked out about how to do it (migration 074), and the
   * steps somebody works through.
   *
   * Only a task a Work Plan drafted carries any of this — 72 of this
   * workspace's 269 have steps, 115 a description — which is why every one of
   * these is optional and every screen drawing them draws nothing where there
   * is nothing.
   */
  description: string | null;
  rationale: string | null;
  expected_output: string | null;
  estimated_days: number | null;
  requiredInputs: TaskRequirement[];
  externalLinks: TaskResource[];
  steps: ChecklistItem[];
  /**
   * The kind of outside firm this takes, where the directory has nobody, and
   * whatever firms a search named. `suggestions` is absent on anything drafted
   * before they were asked for, which is every plan so far.
   */
  providerNeed: {
    category: string;
    why: string;
    suggestions?: { name: string; note: string; url: string | null; phone: string | null }[];
  } | null;
  /** The plan this belongs to, where it belongs to one that still exists. */
  planId: string | null;
  workstreamId: string | null;
  /**
   * Migration 101 — Whitby's first pass, where it made one.
   *
   * Read here as well as in `lib/work-plans.ts` because this task opens on two
   * screens and they have to show the same thing. The last time one of them
   * knew something the other did not, the client's requirements could be asked
   * for from inside a plan and not from the task that needed them.
   */
  whitbyDraft: WhitbyDraft | null;
  whitbyDraftAt: string | null;
};

/** Screen 7.1 — Task Detail, showing the eight fields SRS §6.7.1 names. */
export async function getTask(taskId: string): Promise<TaskDetail | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_tasks")
    .select(
      "id, title, workspace_id, request_id, workstream_id, owner_user_id, priority, status, due_date, dependency_task_id, visibility, next_action, completion_evidence, description, rationale, expected_output, estimated_days, required_inputs, external_links, provider_need, whitby_draft, whitby_draft_at, whitby_draft_dismissed_at, request:whitbyos_requests!request_id (id, title), stream:whitbyos_workstreams!workstream_id (workplan_id, plan:whitbyos_workplans!workplan_id (id, deleted_at))",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (!data || data.workspace_id !== workspaceId) return null;

  const request = firstOf(
    data.request as unknown as { id: string; title: string } | { id: string; title: string }[] | null,
  );

  const { data: links } = await supabase
    .from("whitbyos_task_assignees")
    .select("user_id, sort_order")
    .eq("task_id", taskId)
    .order("sort_order");

  // Falling back to the column keeps a task that predates migration 044 —
  // assigned, but with no rows in the join table — showing its person.
  const assigneeIds =
    (links ?? []).length > 0
      ? (links ?? []).map((row) => row.user_id as string)
      : data.owner_user_id
        ? [data.owner_user_id as string]
        : [];

  const [workstream, ownerName, people, dependency, list] = await Promise.all([
    lookupWorkstream(data.workstream_id as string | null),
    lookupOwners(assigneeIds),
    lookupPeople(assigneeIds),
    lookupDependency(data.dependency_task_id as string | null),
    supabase.from("whitbyos_checklists").select("items").eq("task_id", taskId).maybeSingle(),
  ]);

  // A deleted plan is not openable by anybody, so a task on one has nowhere to
  // link even though it still knows which plan it was.
  const stream = firstOf(
    data.stream as unknown as
      | { workplan_id: string | null; plan: unknown }
      | { workplan_id: string | null; plan: unknown }[]
      | null,
  );
  const plan = firstOf(
    stream?.plan as unknown as
      | { id: string; deleted_at: string | null }
      | { id: string; deleted_at: string | null }[]
      | null,
  );

  return {
    id: data.id as string,
    title: data.title as string,
    request_id: (data.request_id as string | null) ?? null,
    request_title: request?.title ?? null,
    workstream_name: workstream,
    ownerName,
    people,
    owner_user_id: (data.owner_user_id as string | null) ?? null,
    assigneeIds,
    priority: (data.priority as string | null) ?? null,
    status: (data.status as string) ?? "not_started",
    due_date: (data.due_date as string | null) ?? null,
    dependency,
    visibility: (data.visibility as string) ?? "internal",
    next_action: (data.next_action as string | null) ?? null,
    completion_evidence: (data.completion_evidence as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    rationale: (data.rationale as string | null) ?? null,
    expected_output: (data.expected_output as string | null) ?? null,
    estimated_days: (data.estimated_days as number | null) ?? null,
    requiredInputs: Array.isArray(data.required_inputs)
      ? (data.required_inputs as TaskRequirement[])
      : [],
    externalLinks: Array.isArray(data.external_links)
      ? (data.external_links as TaskResource[])
      : [],
    steps: readChecklist(list?.data?.items),
    providerNeed:
      data.provider_need && typeof data.provider_need === "object"
        ? (data.provider_need as TaskDetail["providerNeed"])
        : null,
    planId: plan && !plan.deleted_at ? plan.id : null,
    workstreamId: (data.workstream_id as string | null) ?? null,
    /* Dismissed reads as none, the same rule `lib/work-plans.ts` applies. */
    whitbyDraft:
      data.whitby_draft_dismissed_at == null ? readWhitbyDraft(data.whitby_draft) : null,
    whitbyDraftAt:
      data.whitby_draft_dismissed_at == null
        ? ((data.whitby_draft_at as string | null) ?? null)
        : null,
  };
}

async function lookupWorkstream(id: string | null) {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_workstreams")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return (data?.name as string) ?? null;
}

/**
 * The people on a task, written out the way 16a does: "Jordan Hartwell, Tom
 * Chen". In the order they were assigned, which is the order the avatars
 * stack in, so the list and the row read the same way round.
 */
/** The same people `lookupOwners` names, each one drawable on its own. */
async function lookupPeople(ids: string[]) {
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, preferred_name, email, avatar_url")
    .in("id", ids);

  const rows = new Map((data ?? []).map((row) => [row.id as string, row]));

  // In the order they were assigned, since the first of them is the owner.
  return ids.flatMap((id) => {
    const row = rows.get(id);
    if (!row) return [];

    const name =
      ((row.preferred_name as string) ||
        (row.full_name as string) ||
        (row.email as string) ||
        "").trim();

    return [
      {
        userId: id,
        name: name || "Unnamed",
        initials: initialsOf(name) ?? "··",
        hasPhoto: Boolean(row.avatar_url),
      },
    ];
  });
}

async function lookupOwners(ids: string[]) {
  if (ids.length === 0) return "Unassigned";

  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, preferred_name, email")
    .in("id", ids);

  const names = new Map(
    (data ?? []).map((row) => [
      row.id as string,
      ((row.preferred_name as string) || (row.full_name as string) || (row.email as string) || "").trim(),
    ]),
  );

  const written = ids.map((id) => names.get(id)).filter(Boolean) as string[];
  return written.length > 0 ? written.join(", ") : "Unassigned";
}

/** 7.1's Dependency line reads as prose, so the blocking task lends its title. */
async function lookupDependency(id: string | null) {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_tasks")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return data?.title ? `Waiting on ${data.title}` : null;
}

/** 7.0's Linked Request select. */
export async function listRequestOptions() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_requests")
    .select("id, title, client_id, client:whitbyos_clients!client_id (name)")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  return (data ?? []).map((row) => {
    const client = row.client as unknown as { name: string } | { name: string }[] | null;
    const named = Array.isArray(client) ? client[0] ?? null : client;

    return {
      id: row.id as string,
      title: row.title as string,
      // Additive: every existing caller reads id and title. The Calendar shows
      // it so that picking a Request also says whose work it is, and New Task
      // narrows to it so the form cannot offer one client's work under
      // another client's name.
      clientName: named?.name ?? null,
      clientId: (row.client_id as string | null) ?? null,
    };
  });
}

/** The statuses that count as finished, wherever a task can be ticked. */
const DONE = new Set(["complete", "completed", "done"]);

export function isTaskDone(status: string | null | undefined) {
  return DONE.has(String(status ?? "").toLowerCase());
}

/**
 * What `completed_at` should be for a status.
 *
 * One helper rather than four write sites each deciding, because a task can be
 * finished from the Work Plan, from My Tasks, from the Edit Task dialog, or by
 * closing the Request it belongs to — and a column that only some of them
 * write is worse than one nobody does.
 *
 * An existing stamp is kept. Editing a finished task should not move the day
 * it was finished; only reopening it clears the date, because a completion
 * that was undone did not happen.
 */
export function completionStamp(status: string, existing?: string | null) {
  if (!isTaskDone(status)) return null;
  return existing ?? new Date().toISOString();
}

/**
 * Every plan being worked on, with its own Work Streams under it.
 *
 * Grouped rather than flattened. Nineteen plans of five streams each is
 * ninety-five lines of "Plan · Stream" in one list, which is a list nobody
 * reads: the picker asks for the plan first and offers that plan's streams
 * second, which is also the order somebody thinks in.
 *
 * Only plans being worked on: a task added to an archived plan would not
 * appear on the Tasks screen, which is the screen it was added from.
 */
export type PlanStreams = {
  id: string;
  name: string;
  /** Whose work it is, so the picker can narrow to the client chosen above. */
  clientId: string | null;
  /** Which Request it is for, so a task opened from one can find its plan. */
  requestId: string | null;
  streams: { id: string; name: string }[];
};

export async function listWorkstreamOptions(): Promise<PlanStreams[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  // A plan reaches its workspace through its Request, the same way every other
  // read of a plan does.
  const { data: plans } = await supabase
    .from("whitbyos_workplans")
    .select("id, name, request_id, request:whitbyos_requests!request_id (workspace_id, client_id)")
    .is("deleted_at", null)
    .is("archived_at", null);

  type PlanRequest = { workspace_id: string; client_id: string | null };

  const mine = (plans ?? []).filter((plan) => {
    const request = firstOf(plan.request as unknown as PlanRequest | PlanRequest[] | null);
    return request?.workspace_id === workspaceId;
  });

  if (mine.length === 0) return [];

  const names = new Map(
    mine.map((plan) => [
      plan.id as string,
      {
        name: plan.name as string,
        clientId:
          firstOf(plan.request as unknown as PlanRequest | PlanRequest[] | null)?.client_id ??
          null,
        requestId: (plan.request_id as string | null) ?? null,
      },
    ]),
  );

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name, workplan_id")
    .in("workplan_id", [...names.keys()])
    .order("sort_order");

  const byPlan = new Map<string, { id: string; name: string }[]>();
  for (const stream of streams ?? []) {
    const key = stream.workplan_id as string;
    byPlan.set(key, [
      ...(byPlan.get(key) ?? []),
      { id: stream.id as string, name: stream.name as string },
    ]);
  }

  // A plan with no streams on it has nowhere to put a task, so it is not
  // offered: choosing it would leave the second select empty with nothing
  // saying why.
  return [...names.entries()]
    .map(([id, plan]) => ({
      id,
      name: plan.name,
      clientId: plan.clientId,
      requestId: plan.requestId,
      streams: byPlan.get(id) ?? [],
    }))
    .filter((plan) => plan.streams.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

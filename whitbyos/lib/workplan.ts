import { createClient } from "@/base/lib/supabase/server";
import { assignRole, listAssignable, type Assignable } from "@/whitbyos/lib/assign";
import { schedulePlan } from "@/whitbyos/lib/schedule";
import { listDraftableProviders, type DraftableProvider } from "@/whitbyos/lib/providers";
import type {
  DraftedPlan,
  DraftedStep,
  DraftedStream,
} from "@/whitbyos/lib/ai/draft-workplan";

export type WorkstreamKind = "auto" | "approval" | "manual";

export type PlanStep = {
  id: string;
  title: string;
  kind: WorkstreamKind;
  status: string;
};

export type WorkstreamRow = {
  id: string;
  name: string;
  purpose: string | null;
  kind: WorkstreamKind;
  status: string;
  sort_order: number;
  /** The drafted steps inside it — Tasks, as §6.7.1 has them. */
  steps: PlanStep[];
};

export type WorkplanRow = {
  id: string;
  request_id: string;
  name: string;
  desired_outcome: string | null;
  definition_of_done: string | null;
  status: string;
  version: number;
  workstreams: WorkstreamRow[];
  created_at: string;
};

/**
 * Saves a drafted plan as a real Workplan and its Workstreams.
 *
 * Written as Draft (SRS §6.4.6) — Whitby proposes, the professional adopts.
 * A drafted Work Stream becomes a Workstream and each of its steps a Task, which
 * is what screen 3.2 draws and what §6.6 and §6.7.1 describe. Nothing is stored
 * as a line of text: the fields those objects will need later — owners, dates,
 * dependencies, progress — already have somewhere to live.
 */
/**
 * A drafted step's offset, as a date.
 *
 * The model proposes whole days from today; this is where they become
 * something the Timeline and the burn-down can read. A step with no offset
 * stays undated rather than being given today's date, because an invented
 * deadline is worse than a missing one.
 */
export function dueFromOffset(offset: number | undefined) {
  if (typeof offset !== "number" || !Number.isFinite(offset)) return null;

  const days = Math.max(0, Math.round(offset));
  const due = new Date();
  due.setUTCHours(12, 0, 0, 0);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString();
}

/**
 * The tasks of a drafted plan, written with everything the drafter worked out.
 *
 * Pulled out because there were two paths writing tasks and only one of them
 * did this. A refinement inserted a title, a kind and a date, and put every
 * task on whoever pressed the button — so asking Whitby to change one thing
 * silently stripped the plan of its steps, its durations, its dependencies,
 * its providers and its assignment. The plan looked rewritten and was
 * hollowed out.
 *
 * One path now. Both callers get the assignment, the steps, the schedule and
 * the check that it all landed.
 */
export async function writeDraftedTasks(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  requestId: string;
  workplanId: string;
  plan: DraftedPlan;
  /** The saved Work Stream rows, in the drafted order. */
  streams: { id: string }[];
  targetDate: string | null;
}): Promise<{ ok: true; gaps: PlanGap[] } | { ok: false; error: string }> {
  const { supabase, workspaceId, requestId, workplanId, plan, streams, targetDate } = input;

  const people = await listAssignable(workspaceId);
  const taken = new Map<string, number>();

  /**
   * The firm's own providers, matched to the names the drafter chose.
   *
   * Keyed on a folded name because the model retypes the name rather than
   * returning an id, and "Kensington Lettings" and "kensington lettings" are
   * the same firm. A name that matches nothing is simply not linked — the step
   * keeps the category it was given, which reads as "go and find one of
   * these", and that is the honest answer.
   */
  const directory = new Map(
    (await listDraftableProviders()).map((provider) => [fold(provider.name), provider]),
  );

  const planned = plan.workStreams.flatMap((stream, index) =>
    stream.steps.map((step, order) => {
      const owner = assignRole(step.assigneeRole, people, taken);
      if (owner) taken.set(owner, (taken.get(owner) ?? 0) + 1);

      return {
        step,
        phase: index,
        order,
        row: {
          workspace_id: workspaceId,
          request_id: requestId,
          workstream_id: streams[index]!.id,
          title: step.name,
          kind: step.kind,
          status: "not_started",
          // Null rather than the drafter: unassigned is answerable, and wrongly
          // assigned is ignored by the person it was meant for and never seen
          // by the one it landed on.
          owner_user_id: owner,
          visibility: "internal",
          description: said(step.description),
          rationale: said(step.rationale),
          estimated_days: typeof step.estimatedDays === "number" ? step.estimatedDays : null,
          required_inputs: step.requiredInputs ?? [],
          expected_output: said(step.expectedOutput),
          provider_id: matched(step, directory)?.id ?? null,
          // What kind of firm this needs, where the directory has none. The
          // drafter's answer used to be dropped here, so a plan asked somebody
          // to "appoint a property valuation provider" and never said what
          // kind, why, or that the firm has nobody for it.
          provider_need: matched(step, directory) ? null : providerNeed(step),
          // The firm's own number first, and marked verified because it is the
          // firm's own record rather than something read off a search result.
          external_links: [...providerResource(matched(step, directory)), ...(step.resources ?? [])],
          // Until the scheduler has run, which needs the ids these rows do not
          // have yet.
          due_date: dueFromOffset(step.dueOffsetDays),
        },
      };
    }),
  );

  let saved: { id: string; title: string }[] = [];

  if (planned.length > 0) {
    const { data: inserted, error: taskError } = await supabase
      .from("whitbyos_tasks")
      .insert(planned.map((entry) => entry.row))
      .select("id, title");

    if (taskError) return { ok: false, error: taskError.message };
    saved = (inserted ?? []) as { id: string; title: string }[];
  }

  await saveDraftedSteps(supabase, planned, saved, streams, people, ownerByTask(planned, saved));

  await scheduleSavedPlan({
    supabase,
    workplanId: workplanId,
    planned,
    saved,
    targetDate: targetDate ?? null,
  });


  /**
   * Check what landed, not what was sent.
   *
   * Everything after the tasks are inserted is best effort and cannot fail the
   * save: the steps, the dates, the dependencies, the risks. That is right —
   * a plan with rough dates beats no plan — but it means a write that was
   * refused leaves a plan that looks finished and is not, and nothing says so.
   *
   * One repair pass, then report. The professional is still on the Generating
   * screen while this runs, which is the moment to fix it rather than three
   * days later when somebody notices a task with no steps.
   */
  let gaps = await checkSavedPlan(supabase, workplanId, planned, saved, streams);

  if (gaps.length > 0) {
    if (gaps.includes("steps")) await saveDraftedSteps(supabase, planned, saved, streams, people, ownerByTask(planned, saved));
    if (gaps.includes("dates") || gaps.includes("dependencies")) {
      await scheduleSavedPlan({
        supabase,
        workplanId: workplanId,
        planned,
        saved,
        targetDate: targetDate,
      });
    }

    gaps = await checkSavedPlan(supabase, workplanId, planned, saved, streams);
  }

  return { ok: true, gaps };
}

export async function saveDraftedPlan({
  requestId,
  ownerUserId,
  plan,
  name,
  replaceDraft = false,
  targetDate,
  intoWorkplanId,
}: {
  requestId: string;
  ownerUserId: string;
  plan: DraftedPlan;
  /**
   * What the person called it, where they said.
   *
   * Written at insert rather than corrected afterwards. Applying it in a
   * second update leaves a window in which the plan is called whatever the
   * model decided, and anything reading the row in between records that name
   * instead.
   */
  name?: string | null;
  /**
   * Whether an existing draft on this Request is being redrafted rather than
   * joined. A Request drafting its own plan again means "do that over"; the
   * Work Plans wizard pointing a second plan at the same Request means "and
   * also this", which migration 038 made possible by dropping the unique
   * constraint on request_id. Only the first replaces anything.
   */
  replaceDraft?: boolean;
  /**
   * yyyy-mm-dd. What the whole plan is due by, and the only thing the
   * scheduler needs that the draft cannot supply — the model gives durations
   * and order, never dates.
   */
  targetDate?: string | null;
  /**
   * A row that already exists, to be filled rather than a new one inserted.
   *
   * Drafting runs after the professional has been sent on their way, so the
   * plan has to exist before it is written — there has to be somewhere for
   * them to come back to. Everything below is the same either way; only
   * whether the first statement is an insert or an update changes.
   */
  intoWorkplanId?: string | null;
}): Promise<
  | { ok: true; workplanId: string; gaps: PlanGap[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  // Tasks carry the workspace directly, so it has to come off the Request.
  const { data: parent } = await supabase
    .from("whitbyos_requests")
    .select("workspace_id")
    .eq("id", requestId)
    .maybeSingle();

  const workspaceId = parent?.workspace_id as string | undefined;
  if (!workspaceId) return { ok: false, error: "That request no longer exists." };

  if (replaceDraft) {
    // The newest plan still standing, not "the" plan: a Request may carry
    // several, so maybeSingle() would now throw on the very Requests this is
    // meant to serve.
    const { data: existing } = await supabase
      .from("whitbyos_workplans")
      .select("id, status")
      .eq("request_id", requestId)
      .is("archived_at", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.status === "active") {
      return { ok: false, error: "This request already has an active workplan." };
    }

    // Marked, not deleted. WP.2c settled that a plan never leaves the table,
    // and a draft being replaced is no different — it is simply the version
    // nobody chose.
    if (existing) {
      await supabase
        .from("whitbyos_workplans")
        .update({ deleted_at: new Date().toISOString(), deleted_by_user_id: ownerUserId })
        .eq("id", existing.id);
    }
  }

  // Migration 010 put urgency and health on the Request, where they are set
  // before any plan exists. The plan starts from the Request's answer and may
  // diverge later — a plan can be at risk while the Request is still on track.
  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select("urgency, health")
    .eq("id", requestId)
    .maybeSingle();

  const fields = {
    request_id: requestId,
    name: name?.trim() || plan.planName,
    desired_outcome: plan.desiredOutcome,
    definition_of_done: plan.definitionOfDone,
    owner_user_id: ownerUserId,
    urgency: (request?.urgency as string) ?? "medium",
    health: (request?.health as string) ?? "on_track",
    status: "draft",
    version: 1,
    // Migration 076 — whether the web lookup behind this draft happened, so
    // the plan can say so rather than the reader guessing from an absence.
    research_state: plan.researchState ?? null,
  };

  const { data: workplan, error } = intoWorkplanId
    ? await supabase
        .from("whitbyos_workplans")
        .update(fields)
        .eq("id", intoWorkplanId)
        .select("id")
        .single()
    : await supabase.from("whitbyos_workplans").insert(fields).select("id").single();

  if (error || !workplan) {
    return { ok: false, error: error?.message ?? "Could not save the plan." };
  }

  const { data: streams, error: streamError } = await supabase
    .from("whitbyos_workstreams")
    .insert(
      plan.workStreams.map((stream, index) => ({
        workplan_id: workplan.id,
        name: stream.name,
        purpose: stream.purpose,
        status: "not_started",
        sort_order: index,
        owner_user_id: ownerUserId,
      })),
    )
    .select("id");

  if (streamError || !streams) {
    return { ok: false, error: streamError?.message ?? "Could not save the plan." };
  }

  /**
   * A drafted step is a Task (§6.7.1), and now carries what somebody needs in
   * order to do it: what it is, why, what it needs first, what it produces and
   * where to go.
   *
   * Assignment is by role, matched against the workspace. Every task used to be
   * owned by whoever pressed the button however many people were in the firm,
   * which is a default wearing an assignment's clothes. Where nothing suitable
   * exists the task is left unassigned on purpose — see `lib/assign.ts`.
   */
  const written = await writeDraftedTasks({
    supabase,
    workspaceId,
    requestId,
    workplanId: workplan.id as string,
    plan,
    streams: (streams ?? []) as { id: string }[],
    targetDate: targetDate ?? null,
  });

  if (!written.ok) return { ok: false, error: written.error };
  const gaps = written.gaps;

  await saveConsiderations(workplan.id as string, plan, streams);
  await saveRisks(supabase, plan, streams);

  return { ok: true, workplanId: workplan.id, gaps };
}

/**
 * Dependencies, dates and the verdict on whether they fit.
 *
 * All three at once because they are one answer: a dependency is what makes a
 * date late, and the dates are what make the plan feasible or not. Doing them
 * apart would mean walking the same graph three times and getting three
 * chances to disagree with itself.
 *
 * The drafter names dependencies by title, which is the only handle that
 * exists before anything is saved. A title that matches nothing is dropped
 * rather than guessed at — a wrong edge moves real dates.
 *
 * Best effort throughout. A plan with rough dates is worth more than no plan,
 * so nothing here can fail the save.
 */
/**
 * The steps a drafted task is done by, written where the Task screen reads
 * them.
 *
 * `whitbyos_checklists` has held a task's steps since migration 008 and only
 * the Edit dialog ever wrote to it, by hand, one row at a time. So a drafted
 * plan arrived with twenty tasks and not one of them said how to do the work —
 * the professional opened a task and found a title and a date.
 *
 * Best effort, like everything else after the plan itself is saved: a task
 * without its steps is a smaller task, not a failed save.
 */
async function saveDraftedSteps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planned: { step: DraftedStep; phase: number; order: number }[],
  saved: { id: string; title: string }[],
  /** In plan order; a step's `phase` is its index here. */
  streams: { id: string }[],
  /** Everyone who can be given work, for resolving a step's own role. */
  people: Assignable[],
  /** Who each task was given to, by task id — a step's default. */
  ownerByTask: Map<string, string | null>,
) {
  try {
    // Steps within a task are load-balanced among themselves, so a task whose
    // five steps all want a coordinator does not name the same one five times
    // when the firm has two.
    const taken = new Map<string, number>();

    const idByTitle = new Map<string, string>();
    for (const row of saved) {
      if (!idByTitle.has(row.title)) idByTitle.set(row.title, row.id);
    }

    const rows = planned.flatMap((entry) => {
      const taskId = idByTitle.get(entry.step.name);
      // `workstream_id` stays NOT NULL by design — migration 008 leaves it so
      // that the RLS policy, which scopes through it, does not have to change.
      const streamId = streams[entry.phase]?.id;
      if (!taskId || !streamId) return [];

      const lead = ownerByTask.get(taskId) ?? null;

      const items = (entry.step.steps ?? [])
        .map((item) => {
          const text = typeof item?.text === "string" ? item.text.trim() : "";
          if (!text) return null;

          /**
           * Whose step this is.
           *
           * "same" — and anything the model leaves blank — is the task's own
           * owner, which is nearly every step. A named role different from the
           * task's is what makes a task two people's work, and it is resolved
           * to a person here rather than left as a word nobody can ring.
           */
          const role = typeof item?.role === "string" ? item.role : "same";
          if (role === "same" || role === entry.step.assigneeRole) {
            return { text, done: false, ownerUserId: lead };
          }

          const who = assignRole(role, people, taken);
          if (who) taken.set(who, (taken.get(who) ?? 0) + 1);
          return { text, done: false, ownerUserId: who ?? lead };
        })
        .filter((item): item is { text: string; done: boolean; ownerUserId: string | null } =>
          item !== null,
        );

      if (items.length === 0) return [];

      return [{ task_id: taskId, workstream_id: streamId, title: "Steps", items }];
    });

    if (rows.length === 0) return;

    await supabase.from("whitbyos_checklists").insert(rows);
  } catch {
    // The plan is the thing that was asked for.
  }
}

/**
 * The outside firm a step asked for, where the firm has nobody matching.
 *
 * Only where the drafter actually named a category: an empty object would be
 * a task claiming to need somebody it never asked for.
 */
function providerNeed(step: DraftedStep): { category: string; why: string } | null {
  const category = step.providerNeeded?.category?.trim();
  if (!category) return null;

  return { category, why: step.providerNeeded?.why?.trim() ?? "" };
}

/** What a plan can be missing after a write that was refused or dropped. */
export type PlanGap = "steps" | "dates" | "dependencies";

/** Who each saved task was given to, by task id. */
function ownerByTask(
  planned: { step: DraftedStep; row: { owner_user_id: string | null } }[],
  saved: { id: string; title: string }[],
): Map<string, string | null> {
  return new Map(
    planned.flatMap((entry) => {
      const id = saved.find((row) => row.title === entry.step.name)?.id;
      return id ? [[id, entry.row.owner_user_id] as const] : [];
    }),
  );
}

/**
 * What the drafter asked for against what the database now holds.
 *
 * Only where the draft actually had something to write: a plan whose steps
 * carry no predecessors is not missing its dependencies, and a plan drafted
 * with no target date was never going to be scheduled.
 */
async function checkSavedPlan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workplanId: string,
  planned: { step: DraftedStep }[],
  saved: { id: string; title: string }[],
  streams: { id: string }[],
): Promise<PlanGap[]> {
  try {
    void workplanId;
    void streams;
    if (saved.length === 0) return [];

    const ids = saved.map((row) => row.id);

    const [{ data: tasks }, { count: checklists }] = await Promise.all([
      supabase.from("whitbyos_tasks").select("id, due_date, dependency_task_id").in("id", ids),
      supabase
        .from("whitbyos_checklists")
        .select("id", { count: "exact", head: true })
        .in("task_id", ids),
    ]);

    const gaps: PlanGap[] = [];

    const wantedSteps = planned.filter((entry) => (entry.step.steps?.length ?? 0) > 0).length;
    if (wantedSteps > 0 && (checklists ?? 0) < wantedSteps) gaps.push("steps");

    const rows = tasks ?? [];
    if (rows.length > 0 && rows.every((row) => !row.due_date)) gaps.push("dates");

    const wantedEdges = planned.filter((entry) => Boolean(entry.step.dependsOn?.trim())).length;
    if (wantedEdges > 0 && rows.every((row) => !row.dependency_task_id)) {
      gaps.push("dependencies");
    }

    return gaps;
  } catch {
    // A check that cannot run is not a finding.
    return [];
  }
}

/** Names as they compare, not as they were typed. */
function fold(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The provider a step asked for, if the firm actually has it. */
function matched(
  step: DraftedStep,
  directory: Map<string, DraftableProvider>,
): DraftableProvider | null {
  const named = step.providerNeeded?.useProvider;
  if (!named || !named.trim()) return null;
  return directory.get(fold(named)) ?? null;
}

/**
 * A provider the firm knows, as a resource on the step that needs it.
 *
 * This is the better half of "where to go": a number somebody here has already
 * dialled, against one a search turned up. It is marked verified because the
 * firm wrote it down — that is what the mark means — and it is left out
 * entirely when the record holds no way to reach them, since a resource with
 * no contact details and no link is just the name again.
 */
function providerResource(provider: DraftableProvider | null) {
  if (!provider) return [];
  if (!provider.phone && !provider.email) return [];

  return [
    {
      kind: "provider" as const,
      label: provider.specialty ? `${provider.name}, ${provider.specialty}` : provider.name,
      phone: provider.phone,
      email: provider.email,
      address: provider.location,
      verified: true,
    },
  ];
}

/**
 * The text if there is any, null if there is not.
 *
 * These fields are required of the model now, and a required field the model
 * has nothing to say for comes back as an empty string. Stored as "" it is a
 * value the screens then render as an empty paragraph; stored as null it is
 * absent, which is what it is.
 */
function said(value: string | undefined | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

async function scheduleSavedPlan(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workplanId: string;
  planned: { step: DraftedStep; phase: number; order: number }[];
  saved: { id: string; title: string }[];
  targetDate: string | null;
}) {
  try {
    if (input.saved.length === 0) return;

    // Titles are unique enough within one plan to be a handle, and where they
    // are not, the first wins — which is the same step twice as far as a
    // dependency is concerned.
    const idByTitle = new Map<string, string>();
    for (const row of input.saved) {
      if (!idByTitle.has(row.title)) idByTitle.set(row.title, row.id);
    }

    const edges = new Map<string, string>();
    for (const entry of input.planned) {
      const self = idByTitle.get(entry.step.name);
      const parent = entry.step.dependsOn ? idByTitle.get(entry.step.dependsOn) : undefined;
      if (self && parent && parent !== self) edges.set(self, parent);
    }

    // Without a deadline there is nothing to plan backwards from, so the
    // offsets the drafter gave stand and only the dependencies are written.
    if (!input.targetDate) {
      await writeDependencies(input.supabase, edges);
      return;
    }

    const { tasks, feasibility } = schedulePlan({
      targetDate: input.targetDate,
      tasks: input.planned.flatMap((entry) => {
        const id = idByTitle.get(entry.step.name);
        if (!id) return [];
        return [
          {
            key: id,
            estimatedDays: entry.step.estimatedDays ?? null,
            dependsOn: edges.get(id) ?? null,
            phase: entry.phase,
            order: entry.order,
          },
        ];
      }),
    });

    await writeDependencies(input.supabase, edges);

    for (const task of tasks) {
      await input.supabase
        .from("whitbyos_tasks")
        .update({
          start_date: task.startDate,
          due_date: task.dueDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.key);
    }

    // Named rather than by id, so the warning reads as a sentence on the screen
    // without a second query to find out what the ids were.
    const titleById = new Map(input.saved.map((row) => [row.id, row.title]));
    const name = (id: string) => titleById.get(id) ?? id;

    await input.supabase
      .from("whitbyos_workplans")
      .update({
        target_date: input.targetDate,
        start_date: tasks.reduce<string | null>(
          (soonest, task) => (!soonest || task.startDate < soonest ? task.startDate : soonest),
          null,
        ),
        feasibility: {
          ...feasibility,
          criticalPath: feasibility.criticalPath.map(name),
          parallelisable: feasibility.parallelisable.map(name),
          blocking: feasibility.blocking.map(name),
        },
        /**
         * The scheduler's answer, both ways.
         *
         * `health` starts as a copy of the Request's, and the scheduler used
         * to overwrite it only when the plan did not fit. So a plan inheriting
         * "needs attention" from its Request showed a Health pill saying
         * exactly that, two lines above a banner saying "On track" — two
         * claims about whether the plan reaches its date, disagreeing, side by
         * side. Once the dates have actually been worked out, this is the one
         * that knows.
         */
        health: feasibility.fits ? "on_track" : "at_risk",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.workplanId);
  } catch {
    // See above: the plan is the thing that was asked for.
  }
}

async function writeDependencies(
  supabase: Awaited<ReturnType<typeof createClient>>,
  edges: Map<string, string>,
) {
  for (const [taskId, dependsOn] of edges) {
    await supabase
      .from("whitbyos_tasks")
      .update({ dependency_task_id: dependsOn })
      .eq("id", taskId);
  }
}

/**
 * §6.6 — a single point of failure, and what happens if it fails.
 *
 * `whitbyos_risks` has existed since the schema was written and nothing has
 * ever written to it, so every Work Plan in the product has had an empty
 * answer to "what could go wrong". Same rule as Considerations: a failure here
 * does not fail the plan.
 */
async function saveRisks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  plan: DraftedPlan,
  streams: { id: string }[],
) {
  try {
    const risks = plan.risks ?? [];
    if (risks.length === 0) return;

    const idByName = new Map(
      plan.workStreams.map((stream, index) => [stream.name, streams[index]?.id]),
    );

    const rows = risks.flatMap((risk) => {
      // A risk belongs to a Work Stream by the schema, so one that names none
      // — or names one that is not here — goes on the first.
      const workstreamId = (risk.workStream ? idByName.get(risk.workStream) : undefined)
        ?? streams[0]?.id;
      if (!workstreamId) return [];

      return [
        {
          workstream_id: workstreamId,
          risk: risk.risk,
          impact: risk.impact,
          mitigation: risk.mitigation,
          backup_plan: risk.backupPlan ?? null,
          trigger: risk.trigger ?? null,
          status: "open",
        },
      ];
    });

    if (rows.length > 0) await supabase.from("whitbyos_risks").insert(rows);
  } catch {
    // Deliberately silent, as above.
  }
}

/**
 * §6.4.10 and §6.5.1 — a drafted plan carries Whitby's Considerations with it.
 *
 * They open rather than acting: §6.8.1 is explicit that a Consideration is
 * something to notice, and §6.4.10 that the system never turns one into work
 * without the professional. So these are written open, and Insights is where
 * they are dismissed, resolved or turned into a Task by hand.
 *
 * A failure here does not fail the plan. The plan is the thing that was asked
 * for; losing the notes about it is worth less than losing the plan, and
 * refusing to save a good plan over them would be the wrong trade.
 */
async function saveConsiderations(
  workplanId: string,
  plan: DraftedPlan,
  streams: { id: string }[],
) {
  const considerations = plan.considerations ?? [];
  if (considerations.length === 0) return;

  const supabase = await createClient();

  // The model names the stream rather than pointing at one — nothing had an id
  // when it was drafting. Matched by name, and left against the plan as a whole
  // when the name does not resolve, since §6.4.10 has plan-level ones too.
  const byName = new Map(
    plan.workStreams.map((stream, index) => [stream.name, streams[index]?.id ?? null]),
  );

  await supabase.from("whitbyos_considerations").insert(
    considerations.map((consideration) => ({
      workplan_id: workplanId,
      workstream_id: consideration.workStream
        ? (byName.get(consideration.workStream) ?? null)
        : null,
      type: consideration.type,
      body: consideration.body,
      source_reference: "Whitby, when this plan was drafted",
      // Migration 077. Null on most of them: a Consideration is usually a
      // judgement for a person to make rather than a button to press.
      action_href: consideration.action?.href ?? null,
      action_label: consideration.action?.label ?? null,
      status: "open",
    })),
  );
}

export async function getWorkplan(
  requestId: string,
): Promise<WorkplanRow | null> {
  const supabase = await createClient();

  // A request can hold more than one plan: refining it writes a new version,
  // and one request in this workspace has four. `maybeSingle()` treats a second
  // row as an error and returns nothing, so the plan screen 404'd for exactly
  // the requests whose plan had been worked on most. The current one is the
  // highest version, and the newest of those if a version repeats.
  const { data: workplans } = await supabase
    .from("whitbyos_workplans")
    .select(
      "id, request_id, name, desired_outcome, definition_of_done, status, version, created_at",
    )
    .eq("request_id", requestId)
    .order("version", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const workplan = workplans?.[0];
  if (!workplan) return null;

  const { data: workstreams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name, purpose, kind, status, sort_order")
    .eq("workplan_id", workplan.id)
    .order("sort_order");

  const ids = (workstreams ?? []).map((row) => row.id as string);

  const { data: steps } = ids.length
    ? await supabase
        .from("whitbyos_tasks")
        .select("id, title, kind, status, workstream_id, created_at")
        .in("workstream_id", ids)
        .order("created_at")
    : { data: [] };

  const byStream = new Map<string, PlanStep[]>();
  for (const step of steps ?? []) {
    const list = byStream.get(step.workstream_id as string) ?? [];
    list.push({
      id: step.id as string,
      title: step.title as string,
      kind: ((step.kind as string) ?? "manual") as WorkstreamKind,
      status: (step.status as string) ?? "not_started",
    });
    byStream.set(step.workstream_id as string, list);
  }

  return {
    ...(workplan as Omit<WorkplanRow, "workstreams">),
    workstreams: (workstreams ?? []).map((row) => ({
      ...(row as Omit<WorkstreamRow, "steps">),
      steps: byStream.get(row.id as string) ?? [],
    })),
  };
}

export type RefineTurn = {
  id: string;
  /** What the professional asked, and what came back. */
  instruction: string;
  stepCount: number;
  at: string;
  /** Step titles as they stood in this version, so the next one can be diffed. */
  stepNames: string[];
  /** What Whitby said it did to each step it touched, by title. */
  changes: Record<string, "new" | "merged" | "reworded">;
  /** The work streams it touched, by name. */
  changedStreams: string[];
};

/**
 * Screen 3.2.1's conversation.
 *
 * Every refinement already writes a version with the instruction as its
 * change reason, so the thread is the version history read back rather than a
 * second record of the same exchange that could drift out of step with it.
 */
export async function listRefineTurns(workplanId: string): Promise<RefineTurn[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_workplan_versions")
    .select("id, version_number, snapshot, change_reason, created_at")
    .eq("workplan_id", workplanId)
    .order("version_number");

  return (data ?? [])
    .filter((row) => Boolean(row.change_reason))
    .map((row) => {
      const snapshot = row.snapshot as
        | {
            workStreams?: {
              name?: string;
              steps?: { name?: string; change?: string }[];
            }[];
          }
        | null;

      const names: string[] = [];
      const changes: Record<string, "new" | "merged" | "reworded"> = {};
      const changedStreams: string[] = [];

      for (const stream of snapshot?.workStreams ?? []) {
        let touched = false;
        for (const step of stream.steps ?? []) {
          const title = String(step?.name ?? "");
          names.push(title);
          if (step?.change === "new" || step?.change === "merged" || step?.change === "reworded") {
            changes[title] = step.change;
            touched = true;
          }
        }
        if (touched && stream.name) changedStreams.push(String(stream.name));
      }

      return {
        id: row.id as string,
        instruction: row.change_reason as string,
        stepCount: names.length,
        at: row.created_at as string,
        stepNames: names,
        changes,
        changedStreams,
      };
    });
}

/** The plan as Whitby last drafted it, for refining rather than restarting. */
/** The inverse of `dueFromOffset`, for reading a plan back to the model. */
function offsetFromDue(due: string | null) {
  if (!due) return undefined;

  const then = new Date(due);
  if (Number.isNaN(then.getTime())) return undefined;

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  then.setUTCHours(12, 0, 0, 0);

  return Math.round((then.getTime() - today.getTime()) / 86_400_000);
}

export async function currentSteps(workplanId: string): Promise<DraftedStream[]> {
  const supabase = await createClient();

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name, purpose, sort_order")
    .eq("workplan_id", workplanId)
    .order("sort_order");

  if (!streams || streams.length === 0) return [];

  const { data: tasks } = await supabase
    .from("whitbyos_tasks")
    .select("title, kind, due_date, workstream_id, created_at")
    .in("workstream_id", streams.map((s) => s.id as string))
    .order("created_at");

  const byStream = new Map<string, DraftedStep[]>();
  for (const task of tasks ?? []) {
    const list = byStream.get(task.workstream_id as string) ?? [];
    list.push({
      name: task.title as string,
      kind: ((task.kind as string) ?? "manual") as DraftedStep["kind"],
      // Back into the offset the model speaks in, so a refinement is told what
      // the dates already are. Without this it is asked to keep every step it
      // was not asked about and given no way to keep its date.
      dueOffsetDays: offsetFromDue(task.due_date as string | null),
    });
    byStream.set(task.workstream_id as string, list);
  }

  return streams.map((row) => ({
    name: row.name as string,
    purpose: (row.purpose as string) ?? "",
    steps: byStream.get(row.id as string) ?? [],
  }));
}

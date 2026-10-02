import type {
  Health,
  PlanTask,
  PlanWorkstream,
  Urgency,
  WorkPlanDetail,
} from "@/whitbyos/lib/work-plans";
import type { ChartTask } from "@/whitbyos/lib/plan-math";
import type { PortalPlan, PortalPlanTask } from "@/client-portal/types";

/**
 * A shared plan in the shape Whitby's own plan screens read.
 *
 * The portal draws a shared Work Plan with the professional's components —
 * `GridView`, `KanbanView`, `TimelineView`, `PlanTable`, `ChartsView`, the rails
 * — in their `clientView` mode, rather than with copies of them, so the two
 * sides cannot drift into describing one plan differently. Those components
 * read a `WorkPlanDetail`.
 *
 * Every field `portal_request_plans()` does not send is filled with nothing
 * rather than a guess: no priority, no checklist, no dependency, no waiting
 * reason, no photo, no linked documents, providers or considerations. The views
 * draw an absence for each, which is the truth about what this reader was given.
 *
 * Only type imports here, so this runs under `node --test`.
 */

const DONE = new Set(["complete", "completed", "done"]);
const URGENCIES = new Set(["critical", "high", "medium", "low"]);
const HEALTHS = new Set(["on_track", "needs_attention", "at_risk"]);

/** The same initials `lib/work-plans.ts` draws on a professional's avatar. */
export function initialsOf(name: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function isDone(status: string) {
  return DONE.has(String(status).toLowerCase());
}

function toWhitbyTask(task: PortalPlanTask): PlanTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    kind: task.kind,
    priority: null,
    due_date: task.dueAt,
    completed_at: task.completedAt,
    // Whitby's card writes "Waiting on <this>". The portal knows only that a
    // task is waiting, never on what, so there is no text to hand it.
    waiting_state: null,
    ownerName: task.ownerName,
    ownerInitials: initialsOf(task.ownerName),
    ownerUserId: null,
    ownerHasPhoto: false,
    checklist: [],
    // Who a task was handed to is the firm's own business. The portal is told
    // the owner's name and nothing about how the work is divided inside.
    assigneeIds: [],
    blockedByStreamId: null,
    blockedByTaskId: null,
    // The briefing Whitby drafts for its own people: never sent, so never drawn.
    description: null,
    rationale: null,
    startDate: null,
    estimatedDays: null,
    expectedOutput: null,
    requiredInputs: [],
    externalLinks: [],
    providerId: null,
    // A gap in the firm's own directory, which is the firm's business and not
    // something to show a client about their own work.
    providerNeed: null,
    // Whitby's first pass at the firm's own internal work. SRS 12.1.4 allows
    // it to be written without anybody approving it precisely because nothing
    // leaves the firm; the portal is where it would, so it stops here. The
    // portal's own query never selects these columns either, so this is the
    // second of two locks rather than the only one.
    whitbyDraft: null,
    whitbyDraftAt: null,
    // False rather than the truth: this only feeds a panel offering to run
    // the drafting, which is the firm's own button on the firm's own screen.
    whitbyDraftedAlready: false,
  };
}

export function toWhitbyPlan(plan: PortalPlan, requestTitle: string): WorkPlanDetail {
  const workstreams: PlanWorkstream[] = plan.streams.map((stream) => ({
    id: stream.id,
    name: stream.name,
    purpose: stream.purpose,
    status: stream.status,
    kind: stream.kind,
    blocked: stream.blocked,
    ownerName: stream.ownerName,
    ownerInitials: initialsOf(stream.ownerName),
    ownerUserId: null,
    ownerHasPhoto: false,
    tasks: stream.tasks.map(toWhitbyTask),
  }));

  const tasks = workstreams.flatMap((stream) => stream.tasks);
  const done = tasks.filter((task) => isDone(task.status)).length;

  /*
   * The same rule as `approvalsWaiting` in whitbyos/lib/plan-derive.ts, and
   * repeated rather than imported: this file takes only type imports so that
   * it runs under `node --test`, where the app's path aliases do not exist.
   * Two lines of duplication is the price of that, and it is worth paying.
   */
  const waiting = tasks.filter((task) => task.kind === "approval" && !isDone(task.status));

  return {
    id: plan.id,
    request_id: plan.requestId,
    request_title: requestTitle,
    client_name: "",
    /* The portal is read as a client, so the plan it is reading is theirs by
       construction. The id is the professional side's question. */
    client_id: null,
    name: plan.name,
    desired_outcome: plan.desiredOutcome,
    status: plan.status,
    urgency: (plan.urgency && URGENCIES.has(plan.urgency) ? plan.urgency : "medium") as Urgency,
    health: (plan.health && HEALTHS.has(plan.health) ? plan.health : "on_track") as Health,
    location: null,
    start_date: plan.startDate,
    target_date: plan.targetDate,
    archived_at: null,
    created_at: plan.createdAt ?? plan.updatedAt,
    updated_at: plan.updatedAt,
    ownerName: plan.ownerName ?? "Your team",
    // Whether the lookup behind the draft reached the web is a note to the
    // people who drafted it. `portal_request_plans()` does not send it and the
    // client has nothing to do about it either way.
    researchState: null,
    playbookName: null,
    draftingState: null,
    draftingError: null,
    /* The portal never sees a plan mid-draft: a plan reaches a client once
       it is shared, which cannot happen before it exists. */
    draftingQuestions: [],
    draftingAnswers: [],
    draftingStartedAt: null,
    workstreams,
    // The professional's own read on whether the dates hold, and what could go
    // wrong: working judgement, not something shared with the plan.
    feasibility: null,
    risks: [],
    taskDone: done,
    taskTotal: tasks.length,
    progress: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
    /*
     * Counted on the tasks, not on the streams.
     *
     * A Work Stream's own `kind` exists in the schema and drafting never sets
     * it, so counting approval *streams* returns zero on every drafted plan —
     * the fault `plan-derive` was written for, which said "No approvals
     * waiting" over five tasks visibly marked as approvals. The portal reads
     * the same tasks the professional does and must not answer differently.
     */
    approvalsWaiting: waiting.length,
    approvalTasks: waiting.map((task) => ({
      id: task.id,
      title: task.title,
      ownerName: task.ownerName,
    })),
    documentCount: 0,
    worksheetCount: 0,
    providerCount: 0,
    dependencyLines: [],
    considerations: [],
  };
}

/** The rows `computePlanCharts` counts, as `getPlanCharts` hands them over. */
export function chartInput(plan: PortalPlan): {
  streams: Array<{ id: string; name: string; status: string }>;
  tasks: ChartTask[];
  targetDate: string | null;
  createdAt: string | null;
} {
  return {
    streams: plan.streams.map((stream) => ({
      id: stream.id,
      name: stream.name,
      status: stream.status,
    })),
    tasks: plan.streams.flatMap((stream) =>
      stream.tasks.map((task) => ({
        status: task.status,
        // The charts only ask whether a task is waiting, so a placeholder is
        // enough — and it never reaches the screen as words.
        waiting_state: task.waiting ? "waiting" : null,
        due_date: task.dueAt,
        created_at: task.createdAt,
        completed_at: task.completedAt,
        workstream_id: stream.id,
        ownerName: task.ownerName,
      })),
    ),
    targetDate: plan.targetDate,
    createdAt: plan.createdAt,
  };
}

/** The rows `computePlanTrends` reads for the Grid's sparks. */
export function trendRows(plan: PortalPlan) {
  return plan.streams.flatMap((stream) =>
    stream.tasks.map((task) => ({ workstream_id: stream.id, completed_at: task.completedAt })),
  );
}

/** "Step 3 of 7" — Whitby's count of a Request's plan tasks, over the shared plans. */
export function planTotals(plans: PortalPlan[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const plan of plans) {
    for (const stream of plan.streams) {
      for (const task of stream.tasks) {
        total += 1;
        if (isDone(task.status)) done += 1;
      }
    }
  }
  return { done, total };
}

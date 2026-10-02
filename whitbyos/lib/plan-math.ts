/**
 * WP.17j and WP.17k's arithmetic, with no database in it.
 *
 * `getPlanCharts`, `getPlanTrends` and `getStreamCharts` in `work-plans.ts`
 * read the rows and hand them here. The Client Portal reads a shared plan
 * through `portal_request_plans()` (client-portal/014) and hands its rows here
 * too, so a plan's charts cannot tell the professional one thing and the client
 * another.
 *
 * Nothing in this file imports a value, which is also what lets it run under
 * `node --test` without the app's path aliases.
 */

const DONE = new Set(["complete", "completed", "done"]);

/** The four states WP.17j colours a task by, in the order it stacks them. */
export const CHART_STATES = ["complete", "running", "waiting", "planned"] as const;
export type ChartState = (typeof CHART_STATES)[number];

export type PlanCharts = {
  totalTasks: number;
  doneTasks: number;
  /** Completed in the last seven days, for the tile's own line. */
  doneThisWeek: number;
  streamsTotal: number;
  streamsOnTrack: number;
  overdue: number;
  daysToTarget: number | null;
  /** One bar per stream: its name and how many tasks sit in each state. */
  byStream: { name: string; counts: Record<ChartState, number> }[];
  byState: Record<ChartState, number>;
  byOwner: { name: string; done: number; open: number }[];
  /** Ages in days of the tasks still open, for the age chart. */
  openAges: number[];
  /**
   * Completions per day, oldest first — the cumulative line. Only tasks with a
   * recorded completion appear: a task finished before the column existed has
   * no honest date and is counted in the totals but left off the curve.
   */
  completions: { day: string; count: number }[];
  datedCompletions: number;
  /** yyyy-mm-dd. Where the burn-up's plan line starts and where it should land. */
  startedOn: string | null;
  targetOn: string | null;
  /**
   * WP.17j draws a spark on each of its four tiles. Eight weekly readings each,
   * oldest first, worked out from the dates the tasks carry: when each was due
   * and when it was finished. Nothing here is a stored history — a task due in
   * March and completed in May says where it stood every week in between.
   */
  trends: {
    complete: number[];
    onTrack: number[];
    overdue: number[];
    daysToTarget: number[];
  };
  /** The stream carrying the most late work, for the on-track tile's line. */
  slipping: string | null;
  /** Overdue a week ago, so the tile can say which way it is going. */
  overdueLastWeek: number;
  /** Where the current pace lands, against the target. */
  forecastFinish: string | null;
};

export type StreamCharts = {
  total: number;
  done: number;
  doneThisWeek: number;
  byState: Record<ChartState, number>;
  /** Days from a task being made to being finished, for the cycle-time tile. */
  cycleDays: number[];
  daysRemaining: number | null;
  targetDate: string | null;
  /** Open tasks left after each day something was finished — the burn-down. */
  burndown: { day: string; open: number }[];
  /**
   * WP.17k's activity card, as far as anything records it per stream.
   *
   * Documents can be filed against a Work Stream — `document_context_type`
   * has carried `workstream` all along — and a task can be an approval, since
   * migration 012. Messages and provider calls cannot: neither knows what a
   * Work Stream is.
   */
  documents: number;
  approvals: number;
  approvalsOpen: number;
};

/** Which of WP.17j's four states a task's status belongs to. */
export function chartStateOf(status: string, waiting: string | null): ChartState {
  const key = String(status ?? "").toLowerCase();
  if (DONE.has(key)) return "complete";
  if (waiting || key === "waiting" || key === "blocked") return "waiting";
  if (key === "in_progress" || key === "running" || key === "open") return "running";
  return "planned";
}

function emptyCounts(): Record<ChartState, number> {
  return { complete: 0, running: 0, waiting: 0, planned: 0 };
}

/** One task, as the charts need it — its owner already resolved to a name. */
export type ChartTask = {
  status: string;
  waiting_state: string | null;
  due_date: string | null;
  created_at: string | null;
  completed_at: string | null;
  workstream_id: string | null;
  /** Null for nobody, which the charts file under "Unassigned". */
  ownerName: string | null;
};

/** Everything WP.17j draws, in one pass over the plan's tasks. */
export function computePlanCharts({
  streams,
  tasks,
  targetDate,
  createdAt,
}: {
  /** In the plan's own order. */
  streams: Array<{ id: string; name: string; status: string }>;
  tasks: ChartTask[];
  targetDate: string | null;
  createdAt: string | null;
}): PlanCharts {
  const all = tasks;

  const byStreamMap = new Map<string, Record<ChartState, number>>(
    streams.map((row) => [row.id, emptyCounts()]),
  );
  const byState = emptyCounts();
  const byOwnerMap = new Map<string, { done: number; open: number }>();
  const openAges: number[] = [];
  const perDay = new Map<string, number>();

  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  let doneThisWeek = 0;
  let overdue = 0;
  let datedCompletions = 0;

  for (const row of all) {
    const state = chartStateOf(String(row.status), row.waiting_state ?? null);

    byState[state] += 1;
    const bucket = row.workstream_id ? byStreamMap.get(row.workstream_id) : undefined;
    if (bucket) bucket[state] += 1;

    const ownerName = row.ownerName ?? "Unassigned";
    const owner = byOwnerMap.get(ownerName) ?? { done: 0, open: 0 };
    if (state === "complete") owner.done += 1;
    else owner.open += 1;
    byOwnerMap.set(ownerName, owner);

    if (state === "complete") {
      const at = row.completed_at;
      if (at) {
        datedCompletions += 1;
        const day = at.slice(0, 10);
        perDay.set(day, (perDay.get(day) ?? 0) + 1);
        if (new Date(at).getTime() >= weekAgo) doneThisWeek += 1;
      }
    } else {
      const made = row.created_at;
      if (made) openAges.push(Math.max(0, Math.round((now - new Date(made).getTime()) / 86_400_000)));

      const due = row.due_date;
      if (due && new Date(due).getTime() < now) overdue += 1;
    }
  }

  const target = targetDate;

  return {
    totalTasks: all.length,
    doneTasks: byState.complete,
    doneThisWeek,
    streamsTotal: streams.length,
    streamsOnTrack: streams.filter((row) => {
      const key = String(row.status).toLowerCase();
      return key !== "blocked" && key !== "at_risk";
    }).length,
    overdue,
    daysToTarget: target
      ? Math.round((new Date(target).getTime() - now) / 86_400_000)
      : null,
    byStream: streams.map((row) => ({
      name: row.name,
      counts: byStreamMap.get(row.id) ?? emptyCounts(),
    })),
    byState,
    byOwner: [...byOwnerMap.entries()]
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.done + b.open - (a.done + a.open)),
    openAges,
    completions: [...perDay.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    datedCompletions,
    startedOn: createdAt ? String(createdAt).slice(0, 10) : null,
    targetOn: target ? String(target).slice(0, 10) : null,
    ...weeklyTrends(
      all,
      streams,
      target ? new Date(target).getTime() : null,
      new Map(streams.map((row) => [row.id, row.name])),
    ),
  };
}

/**
 * The eight weekly readings behind WP.17j's four sparks.
 *
 * Every one is worked back out of two dates a task already carries: when it was
 * due, and when it was finished. So "how many were overdue six weeks ago" is
 * answered by asking, of each task, whether it was past due then and not yet
 * done — not by a history nobody kept.
 *
 * A task completed before `completed_at` existed has no date to place it by. It
 * counts in today's totals and sits out of the weekly readings, which is the
 * same bargain the burn-up makes.
 */
function weeklyTrends(
  tasks: Array<{ status: string; due_date: string | null; completed_at: string | null; workstream_id: string | null }>,
  streams: Array<{ id: string; name: string }>,
  target: number | null,
  streamNames: Map<string, string>,
) {
  const WEEKS = 8;
  const DAY = 86_400_000;
  const now = Date.now();
  const weekEnds = Array.from({ length: WEEKS }, (_, i) => now - (WEEKS - 1 - i) * 7 * DAY);

  const doneAt = (task: { completed_at: string | null }) =>
    task.completed_at ? new Date(task.completed_at).getTime() : null;
  const dueAt = (task: { due_date: string | null }) =>
    task.due_date ? new Date(task.due_date).getTime() : null;

  const complete: number[] = [];
  const overdue: number[] = [];
  const onTrack: number[] = [];

  for (const at of weekEnds) {
    complete.push(tasks.filter((task) => (doneAt(task) ?? Infinity) <= at).length);

    const late = tasks.filter((task) => {
      const due = dueAt(task);
      if (due === null || due > at) return false;
      const done = doneAt(task);
      return done === null || done > at;
    });
    overdue.push(late.length);

    const lateStreams = new Set(late.map((task) => task.workstream_id));
    onTrack.push(streams.filter((row) => !lateStreams.has(row.id)).length);
  }

  const daysToTarget = weekEnds.map((at) =>
    target === null ? 0 : Math.max(0, Math.round((target - at) / DAY)),
  );

  // Which stream is carrying the most late work right now.
  const lateNow = new Map<string, number>();
  for (const task of tasks) {
    const due = dueAt(task);
    if (due === null || due > now) continue;
    if (DONE.has(String(task.status).toLowerCase())) continue;
    const id = task.workstream_id ?? "";
    lateNow.set(id, (lateNow.get(id) ?? 0) + 1);
  }
  const worst = [...lateNow.entries()].sort((a, b) => b[1] - a[1])[0];

  // Where today's pace lands, if it holds.
  const doneNow = complete[complete.length - 1] ?? 0;
  const firstDone = tasks
    .map(doneAt)
    .filter((at): at is number => at !== null)
    .sort((a, b) => a - b)[0];
  const elapsed = firstDone ? Math.max(Math.round((now - firstDone) / DAY), 1) : null;
  const perDay = elapsed && doneNow > 0 ? doneNow / elapsed : 0;
  const left = tasks.length - doneNow;
  const forecast =
    perDay > 0 && left > 0 ? new Date(now + (left / perDay) * DAY) : left === 0 ? new Date(now) : null;

  return {
    trends: { complete, onTrack, overdue, daysToTarget },
    slipping: worst ? (streamNames.get(worst[0]) ?? null) : null,
    overdueLastWeek: overdue[WEEKS - 2] ?? 0,
    forecastFinish: forecast ? forecast.toISOString().slice(0, 10) : null,
  };
}

/**
 * A stream's completions over time, for the spark on WP.17c's card.
 *
 * Eight buckets across the plan's own run of completions, so every card is
 * drawn against the same clock and two sparks can be compared.
 */
export function computePlanTrends(
  streamIds: string[],
  tasks: Array<{ workstream_id: string | null; completed_at: string | null }>,
): Map<string, number[]> {
  const byStream = new Map<string, number[]>();
  if (streamIds.length === 0) return byStream;

  const ids = new Set(streamIds);
  const finished = tasks
    .filter((row) => row.completed_at && row.workstream_id && ids.has(row.workstream_id))
    .sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at)));

  const stamps = finished.map((row) => new Date(row.completed_at as string).getTime());
  if (stamps.length === 0) return byStream;

  const first = Math.min(...stamps);
  const last = Math.max(...stamps);
  const width = Math.max(last - first, 1);
  const BUCKETS = 8;

  for (const id of streamIds) byStream.set(id, new Array(BUCKETS).fill(0));

  for (const row of finished) {
    const id = row.workstream_id as string;
    const at = new Date(row.completed_at as string).getTime();
    const slot = Math.min(BUCKETS - 1, Math.floor(((at - first) / width) * BUCKETS));
    const series = byStream.get(id);
    if (series) series[slot] += 1;
  }

  // Cumulative: a spark of a stream's progress, not of its busy days.
  for (const [id, series] of byStream) {
    let running = 0;
    byStream.set(
      id,
      series.map((count) => (running += count)),
    );
  }

  return byStream;
}

/** WP.17k — the same charts as WP.17j, for one Work Stream. */
export function computeStreamCharts({
  tasks,
  targetDate,
  documents,
}: {
  tasks: Array<{
    status: string;
    waiting_state: string | null;
    created_at: string | null;
    completed_at: string | null;
    kind: string | null;
  }>;
  targetDate: string | null;
  documents: number;
}): StreamCharts {
  const all = tasks;
  const byState = emptyCounts();

  const cycleDays: number[] = [];
  let approvals = 0;
  let approvalsOpen = 0;
  const finished: string[] = [];
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  let doneThisWeek = 0;

  for (const row of all) {
    const state = chartStateOf(String(row.status), row.waiting_state ?? null);
    byState[state] += 1;

    if (row.kind === "approval") {
      approvals += 1;
      if (state !== "complete") approvalsOpen += 1;
    }

    if (state !== "complete") continue;

    const at = row.completed_at;
    if (!at) continue;

    finished.push(at);
    if (new Date(at).getTime() >= weekAgo) doneThisWeek += 1;

    const made = row.created_at;
    if (made) {
      cycleDays.push(
        Math.max(0, (new Date(at).getTime() - new Date(made).getTime()) / 86_400_000),
      );
    }
  }

  // Open tasks left after each completion, oldest first.
  finished.sort();
  let open = all.length;
  const burndown = finished.map((at) => {
    open -= 1;
    return { day: at.slice(0, 10), open };
  });

  return {
    total: all.length,
    done: byState.complete,
    doneThisWeek,
    byState,
    cycleDays,
    daysRemaining: targetDate
      ? Math.round((new Date(targetDate).getTime() - now) / 86_400_000)
      : null,
    targetDate,
    burndown,
    documents,
    approvals,
    approvalsOpen,
  };
}

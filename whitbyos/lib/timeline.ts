import type { PlanTask, PlanWorkstream, WorkPlanDetail } from "@/whitbyos/lib/work-plans";

/**
 * WP.17e's arithmetic, kept out of the view.
 *
 * The Timeline is the one screen that makes claims about the future — when the
 * plan will finish, how much room is left, what is holding up what — so the
 * claims are worked out in one place where they can be read and checked,
 * rather than inside the markup that draws them.
 */

const DONE = new Set(["complete", "completed", "done"]);
const DAY = 86_400_000;

export type TimelineScale = "week" | "month" | "quarter";

export const TIMELINE_SCALES: Array<{ value: TimelineScale; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

export type TimelineTask = {
  task: PlanTask;
  /** null when the task has no due date — it is listed, not placed. */
  at: number | null;
  done: boolean;
  running: boolean;
  overdue: boolean;
  /** WP.17e's diamond: the point work stops at until somebody decides. */
  milestone: boolean;
};

export type TimelineRow = {
  stream: PlanWorkstream;
  from: number | null;
  to: number | null;
  done: number;
  total: number;
  percent: number;
  tasks: TimelineTask[];
};

export type TimelineColumn = { label: string; at: number; until: number };

/** The finer lines inside the columns — weeks under a month, months under a quarter. */
export type TimelineTick = { at: number };

export type TimelineEdge = {
  fromRow: number;
  toRow: number;
  at: number;
  until: number;
};

export type TimelineModel = {
  rows: TimelineRow[];
  columns: TimelineColumn[];
  ticks: TimelineTick[];
  from: number;
  to: number;
  /** 0–100 along the track, or null when today falls outside the plan. */
  today: number | null;
  edges: TimelineEdge[];
  /** The longest chain of blocked-by edges, in days, and the streams on it. */
  criticalPath: { days: number; through: string[] } | null;
  /** Days between the last dated work and the plan's target. Negative is over. */
  float: number | null;
  forecastFinish: number | null;
  targetDate: number | null;
  atRisk: TimelineRow[];
  place: (value: number) => number;
};

export function buildTimeline(
  plan: WorkPlanDetail,
  scale: TimelineScale,
): TimelineModel | null {
  const now = Date.now();

  const rows: TimelineRow[] = plan.workstreams.map((stream) => {
    const tasks: TimelineTask[] = stream.tasks.map((task) => {
      const at = task.due_date ? new Date(task.due_date).getTime() : null;
      const done = DONE.has(task.status.toLowerCase());
      return {
        task,
        at,
        done,
        running: !done && task.status.toLowerCase() !== "not_started" && task.status.toLowerCase() !== "open",
        overdue: !done && at !== null && at < now,
        milestone: task.kind === "approval",
      };
    });

    const dates = tasks.map((row) => row.at).filter((at): at is number => at !== null);
    const complete = tasks.filter((row) => row.done).length;

    return {
      stream,
      from: dates.length ? Math.min(...dates) : null,
      to: dates.length ? Math.max(...dates) : null,
      done: complete,
      total: tasks.length,
      percent: tasks.length === 0 ? 0 : Math.round((complete / tasks.length) * 100),
      tasks,
    };
  });

  const dated = rows.flatMap((row) => [row.from, row.to]).filter((x): x is number => x !== null);
  if (dated.length === 0) return null;

  const target = plan.target_date ? new Date(plan.target_date).getTime() : null;
  // The target belongs on the scale even when no work reaches it — a plan due
  // in December whose last task is in September should show that gap. So does
  // today: a plan that has not started yet is read for how far off it is, and
  // a chart that begins after today cannot say.
  const bounds = [...dated, now, ...(target === null ? [] : [target])];

  const { columns, from, to } = columnsFor(Math.min(...bounds), Math.max(...bounds), scale);

  const width = Math.max(to - from, 1);
  const place = (value: number) => ((value - from) / width) * 100;

  const index = new Map(rows.map((row, i) => [row.stream.id, i]));
  const edges = buildEdges(plan, rows, index);

  const forecastFinish = Math.max(...dated);

  return {
    rows,
    columns,
    ticks: ticksFor(from, to, scale),
    from,
    to,
    today: now >= from && now <= to ? place(now) : null,
    edges,
    criticalPath: criticalPath(rows, index, edges),
    float: target === null ? null : Math.round((target - forecastFinish) / DAY),
    forecastFinish,
    targetDate: target,
    // A stream is at risk if it is blocked, or carries work already late.
    atRisk: rows.filter(
      (row) => row.stream.blocked || row.tasks.some((task) => task.overdue),
    ),
    place,
  };
}

/**
 * The columns the scale asks for.
 *
 * Each runs to the start of the next one, so a date on the final day of the
 * span lands inside its own column rather than at 100% — which is off the end
 * of the track, where nothing is drawn.
 */
function columnsFor(first: number, last: number, scale: TimelineScale) {
  const cursor = new Date(first);
  cursor.setHours(0, 0, 0, 0);

  if (scale === "week") {
    // Monday, so the columns line up with how a week is spoken about.
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  } else if (scale === "month") {
    cursor.setDate(1);
  } else {
    cursor.setDate(1);
    cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
  }

  const from = cursor.getTime();
  const columns: TimelineColumn[] = [];

  while (cursor.getTime() <= last || columns.length === 0) {
    const at = cursor.getTime();

    if (scale === "week") cursor.setDate(cursor.getDate() + 7);
    else if (scale === "month") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setMonth(cursor.getMonth() + 3);

    columns.push({ label: labelFor(at, scale), at, until: cursor.getTime() });
  }

  return { columns, from, to: cursor.getTime() };
}

/**
 * The lighter rules between the labelled columns.
 *
 * The reference draws two weights: a week inside a month, a month inside a
 * quarter, and nothing extra inside a week. It is what turns a bar's length
 * into something readable without having to measure it against the axis.
 */
function ticksFor(from: number, to: number, scale: TimelineScale): TimelineTick[] {
  if (scale === "week") return [];

  const ticks: TimelineTick[] = [];
  const cursor = new Date(from);

  if (scale === "month") {
    // Weeks, from the first Monday inside the span.
    cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7 || 7));
    while (cursor.getTime() < to) {
      ticks.push({ at: cursor.getTime() });
      cursor.setDate(cursor.getDate() + 7);
    }
    return ticks;
  }

  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() + 1);
  while (cursor.getTime() < to) {
    ticks.push({ at: cursor.getTime() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

function labelFor(at: number, scale: TimelineScale) {
  const date = new Date(at);
  if (scale === "week") {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  if (scale === "month") {
    return date.toLocaleDateString("en-GB", { month: "long" }).toUpperCase();
  }
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
}

/**
 * One arrow per pair of streams, however many tasks record the edge.
 *
 * Three tasks in Housing waiting on Visa is one dependency, not three, and a
 * stream never points at itself.
 */
function buildEdges(
  plan: WorkPlanDetail,
  rows: TimelineRow[],
  index: Map<string, number>,
): TimelineEdge[] {
  const pairs = new Set<string>();

  for (const stream of plan.workstreams) {
    for (const task of stream.tasks) {
      const blocker = task.blockedByStreamId;
      if (blocker && blocker !== stream.id && index.has(blocker)) {
        pairs.add(`${blocker}|${stream.id}`);
      }
    }
  }

  return [...pairs]
    .map((pair) => {
      const [fromId, toId] = pair.split("|");
      const a = rows[index.get(fromId!)!];
      const b = rows[index.get(toId!)!];
      if (!a?.to || !b?.from) return null;
      return {
        fromRow: index.get(fromId!)!,
        toRow: index.get(toId!)!,
        at: a.to,
        until: b.from,
      };
    })
    .filter((edge): edge is TimelineEdge => edge !== null);
}

/**
 * The longest chain of dependencies, measured end to end.
 *
 * The reference calls this the critical path and gives it in days with the
 * streams it runs through. It is the real thing only as far as the recorded
 * dependencies go — nothing infers an edge nobody entered — so a plan with no
 * dependencies has no critical path rather than a made-up one.
 */
function criticalPath(
  rows: TimelineRow[],
  index: Map<string, number>,
  edges: TimelineEdge[],
): { days: number; through: string[] } | null {
  if (edges.length === 0) return null;

  const successors = new Map<number, number[]>();
  for (const edge of edges) {
    successors.set(edge.fromRow, [...(successors.get(edge.fromRow) ?? []), edge.toRow]);
  }

  let best: { days: number; through: string[] } | null = null;

  const walk = (row: number, chain: number[], seen: Set<number>) => {
    const next = successors.get(row) ?? [];
    const unseen = next.filter((id) => !seen.has(id));

    if (unseen.length === 0) {
      const dates = chain
        .flatMap((id) => [rows[id]!.from, rows[id]!.to])
        .filter((x): x is number => x !== null);
      if (chain.length > 1 && dates.length > 0) {
        const days = Math.round((Math.max(...dates) - Math.min(...dates)) / DAY) + 1;
        if (!best || days > best.days) {
          best = { days, through: chain.map((id) => rows[id]!.stream.name) };
        }
      }
      return;
    }

    for (const id of unseen) walk(id, [...chain, id], new Set([...seen, id]));
  };

  for (const start of new Set(edges.map((edge) => edge.fromRow))) {
    walk(start, [start], new Set([start]));
  }

  void index;
  return best;
}

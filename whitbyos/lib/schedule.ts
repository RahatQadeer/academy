/**
 * Turning a plan's shape into dates, backwards from the deadline.
 *
 * Whitby drafts the work: what has to happen, in what order, and roughly how
 * long each piece takes. It does not decide when any of it happens. That is
 * arithmetic on a calendar, which a model is poor at and a function is not —
 * the drafter's own comment has said so since it was written, and the product
 * then scheduled everything as "today plus N" and ignored the deadline
 * entirely.
 *
 * This is the other half. Given durations, an order, and the date the work is
 * due, it walks the graph backwards from the deadline and gives every task a
 * start and a finish. Where the work does not fit, it says so, says what is in
 * the way, and says how many days short it is, rather than quietly producing a
 * plan that was never going to land.
 *
 * Business days throughout. A plan that has somebody obtaining a document on a
 * Sunday is a plan nobody believes.
 */

export type PlannedTask = {
  /** Stable within one plan — the drafter's own key, or a saved task id. */
  key: string;
  /** Whole or half days of work. Anything absent is treated as one day. */
  estimatedDays?: number | null;
  /** The one task that must finish before this can start. */
  dependsOn?: string | null;
  /** Which phase it belongs to, so untangled tasks still run in order. */
  phase: number;
  /** Position within the phase, for the same reason. */
  order: number;
};

export type ScheduledTask = {
  key: string;
  /** yyyy-mm-dd. */
  startDate: string;
  dueDate: string;
  /** Days between this task's finish and the latest it could have finished. */
  slackDays: number;
  /** On the chain that decides the finish date. Zero slack. */
  critical: boolean;
};

export type Feasibility = {
  fits: boolean;
  /** Business days by which the plan misses its target. Zero when it fits. */
  shortfallDays: number;
  /** The earliest the work could finish if it started today. */
  earliestFinish: string;
  targetDate: string;
  /**
   * Business days of work on the longest run of tasks that must happen in
   * order. Not the textbook critical path: that is tasks with no slack, and
   * a plan with a distant deadline has slack everywhere, which once had this
   * reporting zero days of work on a plan with thirty-one.
   */
  criticalPathDays: number;
  /** The tasks on that chain, in order — the run that sets the finish. */
  criticalPath: string[];
  /** Tasks with slack, which is what can move or run alongside something else. */
  parallelisable: string[];
  /** Depended on by the most others: unblocking these unblocks the most work. */
  blocking: string[];
};

export type Schedule = {
  tasks: ScheduledTask[];
  feasibility: Feasibility;
};

function atNoon(value: string | Date): Date {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00Z`);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** The same day if it is a working one, otherwise the next Monday. */
function nextBusinessDay(date: Date): Date {
  const out = new Date(date);
  while (isWeekend(out)) out.setUTCDate(out.getUTCDate() + 1);
  return out;
}

/** The same day if it is a working one, otherwise the previous Friday. */
function previousBusinessDay(date: Date): Date {
  const out = new Date(date);
  while (isWeekend(out)) out.setUTCDate(out.getUTCDate() - 1);
  return out;
}

export function addBusinessDays(from: Date, days: number): Date {
  const out = nextBusinessDay(new Date(from));
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    out.setUTCDate(out.getUTCDate() + 1);
    if (!isWeekend(out)) left -= 1;
  }
  return out;
}

export function subtractBusinessDays(from: Date, days: number): Date {
  const out = previousBusinessDay(new Date(from));
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    out.setUTCDate(out.getUTCDate() - 1);
    if (!isWeekend(out)) left -= 1;
  }
  return out;
}

export function businessDaysBetween(a: Date, b: Date): number {
  const from = a <= b ? new Date(a) : new Date(b);
  const to = a <= b ? new Date(b) : new Date(a);
  let count = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor)) count += 1;
  }
  return a <= b ? count : -count;
}

/** A day of work unless told otherwise, and never less than half. */
function durationOf(task: PlannedTask): number {
  const days = task.estimatedDays;
  if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) return 1;
  return Math.max(0.5, Math.min(days, 120));
}

/**
 * The order to walk them in, with every task after the one it depends on.
 *
 * A cycle is possible — the model names dependencies by title and can name two
 * that point at each other. The edge that closes the loop is dropped rather
 * than the whole plan being refused, and the task keeps its phase ordering, so
 * a bad edge costs one dependency rather than a schedule.
 */
function topological(tasks: PlannedTask[]): { order: PlannedTask[]; broken: string[] } {
  const byKey = new Map(tasks.map((task) => [task.key, task]));
  const order: PlannedTask[] = [];
  const state = new Map<string, "visiting" | "done">();
  const broken: string[] = [];

  const sorted = [...tasks].sort((a, b) => a.phase - b.phase || a.order - b.order);

  const visit = (task: PlannedTask) => {
    const seen = state.get(task.key);
    if (seen === "done") return;
    if (seen === "visiting") {
      broken.push(task.key);
      return;
    }

    state.set(task.key, "visiting");
    const parent = task.dependsOn ? byKey.get(task.dependsOn) : undefined;
    if (parent && parent.key !== task.key) visit(parent);
    state.set(task.key, "done");
    order.push(task);
  };

  for (const task of sorted) visit(task);
  return { order, broken };
}

/**
 * Schedule a plan against the date it is due.
 *
 * Two passes. Forward from today gives the earliest the work can possibly
 * finish, which is what decides whether the target is reachable at all.
 * Backward from the target gives every task the latest it could start without
 * moving the deadline, which is the plan that actually gets written down:
 * finishing early is not the goal, finishing in time is, and slack belongs at
 * the front where it can absorb a late document rather than at the end.
 *
 * Where the work does not fit, the backward pass would put tasks in the past.
 * The whole plan then shifts forward to start today — so the dates are always
 * ones somebody can act on — and `feasibility` carries the shortfall.
 */
export function schedulePlan(input: {
  tasks: PlannedTask[];
  /** yyyy-mm-dd. The date the whole thing has to be done by. */
  targetDate: string;
  /** Defaults to today. */
  from?: string;
}): Schedule {
  const today = nextBusinessDay(atNoon(input.from ?? new Date()));
  const target = previousBusinessDay(atNoon(input.targetDate));

  const { order } = topological(input.tasks);
  const byKey = new Map(order.map((task) => [task.key, task]));

  // Forward: the earliest each task can start, given what must precede it.
  const earliestStart = new Map<string, Date>();
  const earliestFinish = new Map<string, Date>();

  for (const task of order) {
    const parent = task.dependsOn ? byKey.get(task.dependsOn) : undefined;
    const after = parent ? earliestFinish.get(parent.key) : undefined;
    const start = after ? addBusinessDays(after, 1) : today;
    earliestStart.set(task.key, start);
    // A one-day task starts and finishes on the same day, so the span is the
    // duration less one.
    earliestFinish.set(task.key, addBusinessDays(start, Math.ceil(durationOf(task)) - 1));
  }

  const projectFinish = order.reduce<Date>((latest, task) => {
    const finish = earliestFinish.get(task.key)!;
    return finish > latest ? finish : latest;
  }, today);

  const shortfall = Math.max(0, businessDaysBetween(target, projectFinish));
  const fits = shortfall === 0;

  // Backward: the latest each task can finish without moving the deadline.
  const children = new Map<string, PlannedTask[]>();
  for (const task of order) {
    if (!task.dependsOn) continue;
    const list = children.get(task.dependsOn) ?? [];
    list.push(task);
    children.set(task.dependsOn, list);
  }

  const latestFinish = new Map<string, Date>();
  const latestStart = new Map<string, Date>();

  for (const task of [...order].reverse()) {
    const mine = children.get(task.key) ?? [];
    const finish = mine.length
      ? mine.reduce<Date>((soonest, child) => {
          const before = subtractBusinessDays(latestStart.get(child.key)!, 1);
          return before < soonest ? before : soonest;
        }, target)
      : target;

    latestFinish.set(task.key, finish);
    latestStart.set(task.key, subtractBusinessDays(finish, Math.ceil(durationOf(task)) - 1));
  }

  // If the backward plan starts before today, move the whole thing forward by
  // the same amount — the shape is right, the calendar was simply too short.
  const earliestPlanned = order.reduce<Date | null>((soonest, task) => {
    const start = latestStart.get(task.key)!;
    return !soonest || start < soonest ? start : soonest;
  }, null);

  const shift =
    earliestPlanned && earliestPlanned < today
      ? businessDaysBetween(earliestPlanned, today)
      : 0;

  const tasks: ScheduledTask[] = order.map((task) => {
    const start = shift
      ? addBusinessDays(latestStart.get(task.key)!, shift)
      : latestStart.get(task.key)!;
    const due = shift
      ? addBusinessDays(latestFinish.get(task.key)!, shift)
      : latestFinish.get(task.key)!;
    const slack = businessDaysBetween(earliestFinish.get(task.key)!, latestFinish.get(task.key)!);

    return {
      key: task.key,
      startDate: iso(start),
      dueDate: iso(due),
      slackDays: Math.max(0, slack),
      critical: slack <= 0,
    };
  });

  /*
   * The longest chain, measured in work rather than in pressure.
   *
   * This used to walk back from the last task with no slack, which is the
   * textbook critical path and the wrong answer to the question the screen
   * asks. A plan due in March and finishing in November has slack on every
   * task, so nothing was critical, the chain came out empty, and the plan
   * reported "0 working days of work on the longest chain" over eleven tasks
   * and thirty-one days of work.
   *
   * Slack still decides whether a task is tight, and `critical` on each task
   * still means exactly what it did. This is the other question: how long is
   * the longest run of work that has to happen in order.
   */
  const chainDays = new Map<string, number>();
  for (const task of order) {
    /* Never its own parent. `order` is topological, so a parent is already
       measured by the time its child is reached — unless the edge points at
       the task itself, which is the one case topology cannot sort out. */
    const parent =
      task.dependsOn && task.dependsOn !== task.key ? byKey.get(task.dependsOn) : undefined;
    const before = parent ? (chainDays.get(parent.key) ?? 0) : 0;
    chainDays.set(task.key, before + durationOf(task));
  }

  const criticalPath: string[] = [];
  /* A task that depends on itself, or on something that depends back on it,
     walks this loop forever. The drafter names dependencies by title and the
     titles are its own, so it can and does point one at itself. */
  const walked = new Set<string>();
  let cursor: PlannedTask | undefined = [...order].sort(
    (a, b) => (chainDays.get(b.key) ?? 0) - (chainDays.get(a.key) ?? 0),
  )[0];

  while (cursor && !walked.has(cursor.key)) {
    walked.add(cursor.key);
    criticalPath.unshift(cursor.key);
    const parentKey: string | null | undefined = cursor.dependsOn;
    cursor = parentKey ? byKey.get(parentKey) : undefined;
  }

  const criticalPathDays = criticalPath.reduce(
    (sum, key) => sum + durationOf(byKey.get(key)!),
    0,
  );

  // Depended on by the most others — unblocking one of these frees the most.
  const blocking = [...children.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .filter(([, list]) => list.length > 1)
    .slice(0, 3)
    .map(([key]) => key);

  return {
    tasks,
    feasibility: {
      fits,
      shortfallDays: shortfall,
      earliestFinish: iso(projectFinish),
      targetDate: iso(target),
      criticalPathDays,
      criticalPath,
      parallelisable: tasks.filter((task) => task.slackDays > 0).map((task) => task.key),
      blocking,
    },
  };
}

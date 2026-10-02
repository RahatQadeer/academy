import type { PlanTask, PlanWorkstream } from "@/whitbyos/lib/work-plans";

/**
 * What a plan says about itself, worked out from its own rows.
 *
 * Pulled out of the screens because of a fault that has now happened three
 * times and was found each time by somebody looking at a page and saying
 * "that is not true":
 *
 *   - "No approvals waiting", counted on a Work Stream's `kind`, over five
 *     tasks of kind "approval".
 *   - "Nothing depends on this one", counted on `blockedByStreamId`, over two
 *     rows visibly marked as waiting.
 *
 * Both the same shape: a screen reading a column that nothing writes. Whitby
 * classifies *tasks* and links *tasks*; the stream-level fields exist in the
 * schema and are never set by drafting. Nothing in the types says so, because
 * a column that is always null is still a column.
 *
 * So the derivations live here, in one place, tested against a plan shaped the
 * way drafting actually produces one.
 */

const DONE = new Set(["complete", "completed", "done"]);

export function isDone(status: string): boolean {
  return DONE.has(status.toLowerCase());
}

/** Tasks that need somebody to approve them and have not been approved. */
export function approvalsWaiting(tasks: PlanTask[]): PlanTask[] {
  return tasks.filter((task) => task.kind === "approval" && !isDone(task.status));
}

export type StreamDependencies = {
  /** Streams holding this one up. */
  blockedBy: string[];
  /** Streams this one holds up. */
  blocks: string[];
  /** Tasks here that follow other tasks here: the stream's own order. */
  internalWaits: number;
};

/**
 * How one Work Stream sits against the rest of the plan.
 *
 * Read off `blockedByTaskId`, which is what drafting writes, rather than
 * `blockedByStreamId`, which it does not.
 */
export function streamDependencies(
  streams: PlanWorkstream[],
  streamId: string,
): StreamDependencies {
  const stream = streams.find((row) => row.id === streamId);
  if (!stream) return { blockedBy: [], blocks: [], internalWaits: 0 };

  const streamOfTask = new Map<string, string>();
  for (const row of streams) {
    for (const task of row.tasks) streamOfTask.set(task.id, row.name);
  }

  const mine = new Set(stream.tasks.map((task) => task.id));

  const blocks = [
    ...new Set(
      streams
        .filter((other) => other.id !== streamId)
        .filter((other) =>
          other.tasks.some((task) => task.blockedByTaskId && mine.has(task.blockedByTaskId)),
        )
        .map((other) => other.name),
    ),
  ];

  const blockedBy = [
    ...new Set(
      stream.tasks
        .map((task) => task.blockedByTaskId)
        .filter((id): id is string => typeof id === "string" && !mine.has(id))
        .map((id) => streamOfTask.get(id))
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  const internalWaits = stream.tasks.filter(
    (task) => task.blockedByTaskId && mine.has(task.blockedByTaskId),
  ).length;

  return { blockedBy, blocks, internalWaits };
}

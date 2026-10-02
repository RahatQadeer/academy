/**
 * Who is on a task, worked out one way.
 *
 * Two screens answered this differently. Screen 7 read `owner_user_id` and
 * drew one avatar; the plan's own task page read the steps and said "3 people
 * on this task". Both were looking at the same row.
 *
 * The split lives on the steps, because that is where drafting puts it: a task
 * of six steps spanning a fortnight is rarely one person's, and each step
 * carries whoever does that part. `whitbyos_task_assignees` is a different
 * fact — who somebody reassigned it to by hand — and where it exists it wins,
 * because a person overruling the draft means it.
 *
 * Pure, and tested, so the two screens cannot drift apart again.
 */

/** A step's owner, or null where it is the task's own. */
export type StepOwner = { ownerUserId?: string | null };

export type TaskShare = {
  userId: string;
  /** Which steps are theirs, numbered from 1 as the screen numbers them. */
  steps: number[];
  /** True for the person the task itself belongs to. */
  leads: boolean;
};

/**
 * The people on one task, the leader first.
 *
 * A step with no owner of its own belongs to the task's owner, which is what
 * makes a task with no split at all come back as one person holding every
 * step rather than as nobody.
 */
export function peopleOnTask(
  ownerUserId: string | null,
  steps: StepOwner[],
): TaskShare[] {
  const found = new Map<string, TaskShare>();

  if (ownerUserId) {
    found.set(ownerUserId, { userId: ownerUserId, steps: [], leads: true });
  }

  steps.forEach((step, index) => {
    const id = step?.ownerUserId ?? ownerUserId;
    if (!id) return;

    const already = found.get(id);
    if (already) {
      already.steps.push(index + 1);
      return;
    }

    found.set(id, { userId: id, steps: [index + 1], leads: id === ownerUserId });
  });

  return [...found.values()];
}

/**
 * How the steps read beside somebody's name: "step 3", "steps 1 to 4",
 * "steps 2, 5 and 6".
 *
 * Runs are collapsed because a person holding the first four steps of six is
 * doing one stretch of the work, and "steps 1, 2, 3, 4" makes the reader do
 * the collapsing themselves.
 */
export function stepsLabel(steps: number[]): string {
  if (steps.length === 0) return "";
  if (steps.length === 1) return `step ${steps[0]}`;

  const runs: string[] = [];
  let start = steps[0];
  let last = steps[0];

  for (const step of steps.slice(1)) {
    if (step === last + 1) {
      last = step;
      continue;
    }
    runs.push(start === last ? `${start}` : `${start} to ${last}`);
    start = step;
    last = step;
  }
  runs.push(start === last ? `${start}` : `${start} to ${last}`);

  if (runs.length === 1) return `steps ${runs[0]}`;
  return `steps ${runs.slice(0, -1).join(", ")} and ${runs[runs.length - 1]}`;
}

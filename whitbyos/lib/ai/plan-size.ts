/**
 * How big a plan is allowed to be, and the code that makes it so.
 *
 * WP.4 has asked for a Plan Size since it was built, and the drafter has been
 * told the answer in its prompt ever since. Nothing enforced it. "Standard"
 * did not even carry a number: it said "size it to the work, as many Work
 * Streams and steps as it actually needs, no more", which is an opinion
 * rather than a limit, and plans came back with twelve and fifteen tasks on
 * them whatever anybody chose.
 *
 * The same lesson as every other guard in this folder. The prompt asks; this
 * decides.
 *
 * Nothing is thrown away quietly. `trimPlan` reports what it cut so the
 * caller can raise it on the plan as something somebody chose to leave out,
 * which is the difference between a plan that is short and a plan that is
 * missing a third of itself.
 */

/** The shape this works on: the little of a drafted plan that has a size. */
type Sized<Step> = {
  workStreams: { steps: Step[] }[];
};

export type PlanLimits = {
  /** Work Streams. */
  streams: number;
  /** Steps inside each one. */
  steps: number;
};

/**
 * What each choice on WP.4 actually means, in numbers.
 *
 * Lean is a plan you can hold in your head. Standard is a working plan for
 * ordinary work. Comprehensive is for the engagement that genuinely has six
 * strands, and it is a choice somebody has to make rather than the default
 * the model drifts into.
 */
const LIMITS: Record<string, PlanLimits> = {
  lean: { streams: 3, steps: 3 },
  standard: { streams: 4, steps: 4 },
  comprehensive: { streams: 6, steps: 6 },
};

export function limitsFor(size: string | null | undefined): PlanLimits {
  return LIMITS[String(size ?? "").toLowerCase()] ?? LIMITS.standard;
}

/** The sentence the drafter is given, built from the same numbers. */
export function sizeInstruction(size: string | null | undefined): string {
  const { streams, steps } = limitsFor(size);

  return `Write at most ${streams} Work Streams and at most ${steps} steps in each one. This is a hard limit, not a target: anything beyond it is cut before the plan is saved, so a step you think matters is better written inside the limit than appended past it. Fewer is allowed and often right. Where the work genuinely does not fit, say so in a Consideration rather than writing more.`;
}

export type Trimmed = {
  /** Work Streams removed from the end. */
  streams: number;
  /** Steps removed, across all the streams that were kept. */
  steps: number;
};

/**
 * Cut a drafted plan down to the size that was asked for.
 *
 * Steps go before Work Streams. A stream that loses its fourth step is still
 * that piece of work; a plan that loses its fourth stream has lost a piece of
 * work entirely, so that is the last thing to give.
 *
 * From the end in both cases. The drafter is told to order its output by what
 * has to happen first, so the end is where the least load-bearing material
 * is, and taking from the middle would break the dependencies that reference
 * steps by name.
 */
export function trimPlan<Step, Plan extends Sized<Step>>(
  plan: Plan,
  size: string | null | undefined,
): { plan: Plan; trimmed: Trimmed } {
  const limits = limitsFor(size);
  const streams = Array.isArray(plan.workStreams) ? plan.workStreams : [];

  const kept = streams.slice(0, limits.streams);
  let cutSteps = 0;

  const resized = kept.map((stream) => {
    const steps = Array.isArray(stream.steps) ? stream.steps : [];
    if (steps.length <= limits.steps) return stream;

    cutSteps += steps.length - limits.steps;
    return { ...stream, steps: steps.slice(0, limits.steps) };
  });

  return {
    plan: { ...plan, workStreams: resized },
    trimmed: {
      streams: Math.max(0, streams.length - kept.length),
      steps: cutSteps,
    },
  };
}

/**
 * What to say on the plan about what was cut, or nothing.
 *
 * Written here so the words and the numbers cannot drift apart. Null where
 * nothing was trimmed, which is the normal case once the drafter respects
 * the limit it is given.
 */
export function trimNote(trimmed: Trimmed, size: string | null | undefined): string | null {
  if (trimmed.streams === 0 && trimmed.steps === 0) return null;

  const limits = limitsFor(size);
  const parts: string[] = [];

  if (trimmed.streams > 0) {
    parts.push(
      `${trimmed.streams} Work ${trimmed.streams === 1 ? "Stream" : "Streams"}`,
    );
  }
  if (trimmed.steps > 0) {
    parts.push(`${trimmed.steps} ${trimmed.steps === 1 ? "step" : "steps"}`);
  }

  return `Whitby drafted more than this plan's size allows, and ${parts.join(" and ")} were left out. The size chosen was at most ${limits.streams} Work Streams of ${limits.steps} steps. Change the size and ask Whitby to redo it if the work genuinely needs more room.`;
}

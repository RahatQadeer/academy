/**
 * One set of colours for a plan, read the same way in every view.
 *
 * The List, the Table, the Kanban and the Charts each chose their own greys
 * for the same four states, so a plan that had just been drafted — where every
 * task is "Not Started" — came out colourless everywhere: a chart legend
 * showing four colours above bars drawn in the page's own divider grey, a
 * Kanban of one warm-grey column, a table of chips the colour of the canvas.
 *
 * "Not started" should be quiet, not invisible — and the slate it was first
 * given still read as washed out on a plan where every task is planned, which
 * is every plan on the day it is drafted. It is a cornflower now: plainly a
 * blue, warm enough to carry a whole chart on its own.
 *
 * Deliberately not the accent. "Running" is the accent blue, and a plan where
 * planned and running are the same hue at the same weight is a plan where the
 * two readings that matter most cannot be told apart. This one is lighter and
 * a touch violet; the accent stays the stronger, truer blue, so work that has
 * actually begun is still the thing that stands out.
 */

/** The four readings of a task, in the order work moves through them. */
export const PLAN_INK = {
  planned: "#6c8ae4",
  running: "var(--accent)",
  waiting: "var(--avatar-tan-fg)",
  complete: "var(--success-fg)",
} as const;

/** The same four as a chip: a tint to sit on and an ink to write in. */
export const PLAN_CHIP = {
  planned: { bg: "rgba(108,138,228,.13)", fg: "#3f5db0" },
  running: { bg: "var(--info-bg)", fg: "var(--info-fg)" },
  waiting: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  complete: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
} as const;

/**
 * A colour per Work Stream, by its position in the plan.
 *
 * Position rather than name, so the same plan is the same colours every time
 * it is opened, and two streams never collide because their names happen to
 * hash alike. Six hues before it repeats, which is more streams than a plan
 * has had.
 */
const STREAM = [
  "#2383e2",
  "#0f9d58",
  "#b08240",
  "#8b5cf6",
  "#d9483b",
  "#0f9aa8",
] as const;

export function streamInk(index: number): string {
  return STREAM[((index % STREAM.length) + STREAM.length) % STREAM.length]!;
}

/** The same hue at the weight of a background tint. */
export function streamTint(index: number): string {
  return `${streamInk(index)}1f`;
}

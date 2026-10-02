import type { WorkPlanDetail } from "@/whitbyos/lib/work-plans";

/**
 * Openings for Ask Whitby, written from the plan in front of you.
 *
 * The reference fills this space with examples — "Family relocation to Austin
 * with school enrolment" — which is a good way to show what a product does to
 * somebody who has never used it, and no use at all to somebody looking at
 * their own plan. These name this plan's Work Streams, its unassigned tasks
 * and its own deadline, so pressing one does something here.
 *
 * Only what the plan actually has. A suggestion to reassign work on a plan
 * where everything is assigned is a line nobody would press.
 */
export function whitbySuggestions(plan: WorkPlanDetail): string[] {
  const out: string[] = [];
  const tasks = plan.workstreams.flatMap((stream) => stream.tasks);

  const last = plan.workstreams.at(-1);
  if (last) {
    out.push(`Move everything in ${last.name} a week later.`);
  }

  const unassigned = tasks.find((task) => !task.ownerName);
  if (unassigned) {
    out.push(`Give "${unassigned.title}" to somebody and say who.`);
  }

  // A stream with one task is usually a stream that was not thought through.
  const thin = plan.workstreams.find((stream) => stream.tasks.length === 1);
  if (thin) {
    out.push(`Break ${thin.name} into the steps it actually takes.`);
  }

  const noSteps = tasks.find((task) => task.checklist.length === 0);
  if (noSteps) {
    out.push(`Write the steps for "${noSteps.title}".`);
  }

  const needsFirm = tasks.find((task) => task.providerNeed);
  if (needsFirm) {
    out.push(
      `We have no ${needsFirm.providerNeed!.category.toLowerCase()}, so add a task to find one.`,
    );
  }

  if (plan.feasibility && !plan.feasibility.fits) {
    out.push(`This does not fit the deadline. Shorten it so it does.`);
  }

  const first = plan.workstreams[0];
  if (out.length < 3 && first) {
    out.push(`Add a task to ${first.name} for anything we have missed.`);
  }

  /*
   * One of these is something to make, not something to move.
   *
   * Every line above asks Whitby to redraw part of the plan, because that
   * was all the panel could do. It can make things now — a task, a request,
   * a group, a message — and nobody discovers a capability that is never
   * shown. Last in the list, so the suggestions that are about this plan
   * still come first.
   */
  const stream = plan.workstreams[0];
  if (stream) {
    out.push(`Create a task in ${stream.name} and assign it to me.`);
  }

  return out.slice(0, 4);
}

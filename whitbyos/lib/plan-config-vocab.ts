import { limitsFor } from "@/whitbyos/lib/ai/plan-size";

/**
 * WP.4's configuration — the dials that shape what Whitby drafts.
 *
 * No server imports: the Configure step is a client component, because it has
 * to show WP.5's Generating screen while its own submit is in flight.
 */

export const URGENCIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const COMPLEXITIES = [
  { value: "simple", label: "Simple" },
  { value: "moderate", label: "Moderate" },
  { value: "complex", label: "Complex" },
];

/**
 * How long the plan may be, said in the numbers it is actually held to.
 *
 * The hints used to be "auto-sized to scope", "essentials only" and "max
 * detail", none of which says how much work you are about to be given. A
 * professional read past the control without seeing it was a control, and
 * every plan came out Standard.
 *
 * The numbers come from `limitsFor`, which is the same function that cuts
 * the plan afterwards, so the promise on this screen and what arrives cannot
 * drift apart.
 */
export const PLAN_SIZES = [
  { value: "lean", label: "Lean", hint: planSizeHint("lean") },
  { value: "standard", label: "Standard", hint: planSizeHint("standard") },
  { value: "comprehensive", label: "Comprehensive", hint: planSizeHint("comprehensive") },
];

function planSizeHint(size: string) {
  const { streams, steps } = limitsFor(size);
  return `up to ${streams} work streams of ${steps} steps, ${streams * steps} tasks at most`;
}


/**
 * WP.4 shows an estimated cost before spending anything.
 *
 * Worked out from the dials rather than measured, because the only honest
 * measure arrives after the call. It is labelled an estimate and rounded, so
 * nobody reads it as a quote — its job is to say "this one is bigger than that
 * one" before somebody commits to it.
 *
 * This is the cost of drafting one plan, between 60 and 330 credits. It is not
 * a monthly allowance and must not be read as one — no per-plan allowance is
 * defined, and AI is billed from actual LLM cost with a markup. Which is also
 * why WP.4a, the Out of AI Credits modal, is not built: it fires when an
 * estimate exceeds a remaining balance, and there is no balance to exceed.
 */
export function estimateCredits(complexity: string, size: string) {
  const byComplexity: Record<string, number> = { simple: 80, moderate: 140, complex: 220 };
  const bySize: Record<string, number> = { lean: 0.7, standard: 1, comprehensive: 1.5 };

  const base = byComplexity[complexity] ?? 140;
  const factor = bySize[size] ?? 1;

  return Math.round((base * factor) / 10) * 10;
}

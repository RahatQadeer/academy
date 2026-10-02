import "server-only";
import Stripe from "stripe";
import { PLANS } from "@/whitbyos/lib/billing-vocab";

/**
 * Whitby's own Stripe wiring.
 *
 * Separate from Academy's, deliberately. They share the Right Tail account but
 * not their catalogue, their webhook or their secret: Academy prices a course
 * with dynamic `price_data`, Whitby sells four fixed plans plus a meter, and
 * mixing them would mean one endpoint guessing which product an event belongs
 * to. The handover note says the same thing.
 */

let client: Stripe | null = null;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/**
 * Every signing secret this deployment will verify a Whitby billing event
 * against, in the order they are tried.
 *
 * More than one, because the endpoint in the Stripe dashboard is not the only
 * thing that has ever pointed at this URL. `STRIPE_WHITBY_WEBHOOK_SECRET` is
 * the one that was already set; `STRIPE_PORTAL_WEBHOOK_SECRET` is a second
 * endpoint added later for client invoice payments. Neither has to be
 * retired for the other to work, and rotating a secret is the same motion:
 * add the new one, wait for deliveries to move, remove the old.
 *
 * A signature is only ever valid for the endpoint that produced it, so trying
 * both weakens nothing — a forged event fails against every secret here just
 * as it would against one.
 */
export function webhookSecrets(): string[] {
  const named = [
    process.env.STRIPE_WHITBY_WEBHOOK_SECRET,
    process.env.STRIPE_PORTAL_WEBHOOK_SECRET,
  ];
  return Array.from(
    new Set(named.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

export function webhookConfigured() {
  return webhookSecrets().length > 0;
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  if (!client) client = new Stripe(key);
  return client;
}

/**
 * The two prices a plan is bought with: the plan itself, and the metered AI
 * price that rides alongside it.
 *
 * Enterprise has no self-serve plan price, only the meter, because it is sold
 * by hand. Trial is not a product: the fourteen days are `trial_period_days`
 * on the plan the person actually chooses.
 */
const PRICE_ENV: Record<string, { plan?: string; ai: string }> = {
  standard: { plan: "STRIPE_PRICE_STANDARD", ai: "STRIPE_PRICE_STANDARD_AI" },
  professional: { plan: "STRIPE_PRICE_PROFESSIONAL", ai: "STRIPE_PRICE_PROFESSIONAL_AI" },
  teams: { plan: "STRIPE_PRICE_TEAMS", ai: "STRIPE_PRICE_TEAMS_AI" },
  enterprise: { ai: "STRIPE_PRICE_ENTERPRISE_AI" },
};

export type PlanPrices = { planPrice: string | null; aiPrice: string | null };

export function pricesFor(plan: string): PlanPrices {
  const names = PRICE_ENV[plan];
  if (!names) return { planPrice: null, aiPrice: null };
  return {
    planPrice: names.plan ? (process.env[names.plan]?.trim() ?? null) : null,
    aiPrice: process.env[names.ai]?.trim() ?? null,
  };
}

/** Which plan a Stripe price id belongs to, for reading a subscription back. */
export function planForPrice(priceId: string | null): string | null {
  if (!priceId) return null;
  for (const [plan, names] of Object.entries(PRICE_ENV)) {
    if (names.plan && process.env[names.plan]?.trim() === priceId) return plan;
  }
  return null;
}

/** A plan that can actually be bought without talking to somebody. */
export function selfServe(plan: string) {
  return Boolean(pricesFor(plan).planPrice) && PLANS.some((p) => p.value === plan);
}

export const AI_METER_EVENT = "ai_usage";

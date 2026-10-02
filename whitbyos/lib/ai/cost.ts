/**
 * What AI generation costs us, and what it costs the customer.
 *
 * The client settled the model on 2026-09-08. It is cost-plus: we bill the
 * actual LLM cost with a markup, and the profit is half that cost.
 *
 *   cost 100  ->  profit 50  ->  customer 150
 *
 * which is `cost + (cost / 2)`, or `cost x 1.5`. Both readings are the same
 * arithmetic; the first is the one the client described, so it is the one the
 * code performs.
 *
 * THE RATE LIVES HERE AND NOWHERE ELSE.
 * It is the one number in this model that is a commercial decision rather than
 * a measurement, and it has already changed once — the earlier "$1 to $1.50"
 * was an illustration before it was a rate. So it is read from configuration
 * with a documented default, and every caller asks this module rather than
 * multiplying by 1.5 of its own accord. Changing the rate is then an
 * environment variable, not a search across the codebase.
 *
 * WHAT IS STILL NOT DECIDED, and must not be invented here:
 *   - No per-plan monthly allowance exists, for Trial, Standard, Professional
 *     or Teams. The pricing document's "Limited" through "Higher pooled"
 *     describe expected volume, not a quantity anyone has sized.
 *   - What a "credit" is worth in cents. This module deals in cents of real
 *     cost, which is the only figure that is measured.
 *   - `estimateCredits` in `plan-config-vocab` (60-330) is the cost of drafting
 *     one Work Plan. It is not a monthly allowance and is not connected to any
 *     of this.
 */

/**
 * Profit as a fraction of cost. 0.5 means the profit is half the cost, so the
 * customer pays one and a half times what we paid.
 *
 * `WHITBY_AI_MARKUP_RATE` overrides it. Set `0` to bill at cost, `1` to double.
 * A value that is not a number, or is negative, is ignored in favour of the
 * default rather than silently pricing everything at zero.
 */
export const DEFAULT_AI_MARKUP_RATE = 0.5;

export function aiMarkupRate(): number {
  const raw = process.env.WHITBY_AI_MARKUP_RATE?.trim();
  if (!raw) return DEFAULT_AI_MARKUP_RATE;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_AI_MARKUP_RATE;

  return parsed;
}

export type AiCharge = {
  /** What the generation actually cost us, in cents. The measured figure. */
  costCents: number;
  /** The margin on top, in whole cents. */
  profitCents: number;
  /** What the customer is billed, in cents. Always `costCents + profitCents`. */
  chargeCents: number;
  /** The rate this charge was computed at, to be stored beside it. */
  markupRate: number;
};

/**
 * The charge for one generation.
 *
 * Money is whole cents throughout, so the rounding happens once, on the profit,
 * and the charge is then an exact sum of two integers. Rounding the total
 * instead would let `chargeCents - costCents` disagree with `profitCents` by a
 * cent, and those two numbers appear side by side on an invoice.
 *
 * A cost we could not measure is not a charge: a negative or non-finite cost
 * returns zero rather than guessing, because the alternative is billing
 * somebody for a number nobody computed.
 */
export function aiCharge(costCents: number, rate = aiMarkupRate()): AiCharge {
  if (!Number.isFinite(costCents) || costCents <= 0) {
    return { costCents: 0, profitCents: 0, chargeCents: 0, markupRate: rate };
  }

  const cost = Math.round(costCents);
  const profitCents = Math.round(cost * rate);

  return {
    costCents: cost,
    profitCents,
    chargeCents: cost + profitCents,
    markupRate: rate,
  };
}

/** "Cost $1.00 + $0.50 margin = $1.50", for a screen that has to explain itself. */
export function describeAiCharge(charge: AiCharge, currency = "USD"): string {
  const money = (cents: number) =>
    (cents / 100).toLocaleString("en-US", { style: "currency", currency });

  return `${money(charge.costCents)} cost + ${money(charge.profitCents)} margin = ${money(charge.chargeCents)}`;
}

/**
 * The same formula, in micro-dollars.
 *
 * One generation costs a fraction of a cent, so `aiCharge` above — which deals
 * in whole cents, the unit an invoice and the Stripe meter speak — cannot
 * represent it. This is the per-call form. The arithmetic is identical and the
 * rate comes from the same place; only the unit differs, and both round the
 * profit once so `charge === cost + profit` exactly.
 *
 * Kept beside `aiCharge` rather than in the pricing module on purpose: the
 * markup lives in this file and nowhere else, whatever unit it is applied in.
 */
export type AiChargeMicros = {
  costMicros: number;
  profitMicros: number;
  chargeMicros: number;
  markupRate: number;
};

export function aiChargeMicros(
  costMicros: number | null,
  rate = aiMarkupRate(),
): AiChargeMicros | null {
  // Null in, null out: an unpriced call has no charge, and zero would claim it
  // was free rather than admit it was never priced.
  if (costMicros === null) return null;

  if (!Number.isFinite(costMicros) || costMicros <= 0) {
    return { costMicros: 0, profitMicros: 0, chargeMicros: 0, markupRate: rate };
  }

  const cost = Math.round(costMicros);
  const profitMicros = Math.round(cost * rate);

  return {
    costMicros: cost,
    profitMicros,
    chargeMicros: cost + profitMicros,
    markupRate: rate,
  };
}

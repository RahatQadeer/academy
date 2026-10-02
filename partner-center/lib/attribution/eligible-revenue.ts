/**
 * Eligible revenue + refund rule stored on commission rules (§17.7.5, §17.14.8, §17.14.12).
 */

export type RevenueComponent =
  | "tax"
  | "refunds"
  | "credits"
  | "overages"
  | "pass_through";

export type RefundRule =
  | "full"
  | "proportional"
  | "future_negative_after_payout";

export type EligibleRevenueRules = {
  new_customer_period_days?: number;
  exclude?: RevenueComponent[];
  include?: string[];
  refund_rule?: RefundRule;
  /** Optional breakdown of collected payment components in cents. */
  components?: Partial<Record<RevenueComponent, number>>;
};

export const ALL_REVENUE_EXCLUSIONS: RevenueComponent[] = [
  "tax",
  "refunds",
  "credits",
  "overages",
  "pass_through",
];

export function parseEligibleRevenueRules(
  raw: unknown,
): EligibleRevenueRules {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const exclude = Array.isArray(obj.exclude)
    ? (obj.exclude.filter((x): x is RevenueComponent =>
        ALL_REVENUE_EXCLUSIONS.includes(x as RevenueComponent),
      ) as RevenueComponent[])
    : undefined;
  const include = Array.isArray(obj.include)
    ? obj.include.filter((x): x is string => typeof x === "string")
    : undefined;
  const refund =
    obj.refund_rule === "full" ||
    obj.refund_rule === "proportional" ||
    obj.refund_rule === "future_negative_after_payout"
      ? obj.refund_rule
      : undefined;
  const period =
    typeof obj.new_customer_period_days === "number"
      ? obj.new_customer_period_days
      : undefined;
  const components =
    obj.components && typeof obj.components === "object"
      ? (obj.components as EligibleRevenueRules["components"])
      : undefined;

  return {
    new_customer_period_days: period,
    exclude,
    include,
    refund_rule: refund,
    components,
  };
}

/**
 * Net commissionable collected amount in cents after exclusions.
 * When component breakdown is provided, subtract excluded components.
 * Otherwise return the full amount (exclusions are policy metadata until breakdown exists).
 */
export function netEligibleCollectedCents(
  amountCollectedCents: number | undefined,
  rules: EligibleRevenueRules,
  componentCents?: Partial<Record<RevenueComponent, number>>,
): number | null {
  if (amountCollectedCents == null || !Number.isFinite(amountCollectedCents)) {
    return null;
  }
  const breakdown = componentCents ?? rules.components;
  const exclude = rules.exclude ?? [];
  if (!breakdown || exclude.length === 0) {
    return Math.max(0, Math.round(amountCollectedCents));
  }
  let net = amountCollectedCents;
  for (const key of exclude) {
    const part = breakdown[key];
    if (typeof part === "number" && Number.isFinite(part)) {
      net -= part;
    }
  }
  return Math.max(0, Math.round(net));
}

export function resolveRefundRule(
  rules: EligibleRevenueRules,
  platformDefault: RefundRule = "proportional",
): RefundRule {
  return rules.refund_rule ?? platformDefault;
}

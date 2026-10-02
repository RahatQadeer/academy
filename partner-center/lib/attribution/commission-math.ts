import type { CommissionRuleRow } from "@/partner-center/lib/attribution/types";

export function computeCommissionAmount(
  rule: Pick<CommissionRuleRow, "rate_type" | "rate_value">,
  amountCollectedCents?: number,
): number | null {
  const rateValue = Number(rule.rate_value);
  if (rule.rate_type === "flat") {
    return Number.isFinite(rateValue) ? rateValue : null;
  }

  if (amountCollectedCents == null || !Number.isFinite(amountCollectedCents)) {
    return null;
  }

  const collectedDollars = amountCollectedCents / 100;
  const amount = (collectedDollars * rateValue) / 100;
  return Math.round(amount * 100) / 100;
}

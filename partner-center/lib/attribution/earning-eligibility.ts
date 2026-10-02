/**
 * Earning basis + eligible period enforcement (§17.7.3–4).
 */

export type EarningBasis =
  | "first_collected_payment"
  | "each_collected_payment"
  | "collected_revenue_period"
  | "fixed_amount"
  | "custom";

export function normalizeEarningBasis(
  value: string | null | undefined,
): EarningBasis {
  const v = (value ?? "").trim().toLowerCase();
  if (
    v === "each_collected_payment" ||
    v === "each_payment" ||
    v === "each"
  ) {
    return "each_collected_payment";
  }
  if (
    v === "collected_revenue_period" ||
    v === "revenue_period" ||
    v === "period"
  ) {
    return "collected_revenue_period";
  }
  if (v === "fixed_amount" || v === "fixed") return "fixed_amount";
  if (v === "custom") return "custom";
  return "first_collected_payment";
}

/**
 * Parse eligible period strings into days after conversion (null = unlimited).
 * Examples: one_payment / one_event → 0 days after first (basis handles count);
 * 30d, 90 days, 3 months, 6 months, 12 months, custom:N
 */
export function eligiblePeriodToDays(
  value: string | null | undefined,
): number | null {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return 0; // default one_payment → only first event window
  if (
    v === "one_payment" ||
    v === "one_event" ||
    v === "one" ||
    v === "first_only"
  ) {
    return 0;
  }
  if (v === "unlimited" || v === "ongoing" || v === "custom") return null;

  const customMatch = v.match(/^custom[:\s_-]?(\d+)/);
  if (customMatch) {
    const n = Number.parseInt(customMatch[1] ?? "", 10);
    return Number.isFinite(n) ? n : 0;
  }

  const monthMatch = v.match(/(\d+)\s*months?/);
  if (monthMatch) {
    const n = Number.parseInt(monthMatch[1] ?? "", 10);
    return Number.isFinite(n) ? n * 30 : 0;
  }

  const dayMatch = v.match(/(\d+)\s*d(?:ays?)?/);
  if (dayMatch) {
    const n = Number.parseInt(dayMatch[1] ?? "", 10);
    return Number.isFinite(n) ? n : 0;
  }

  if (v === "30" || v === "60" || v === "90") {
    return Number.parseInt(v, 10);
  }

  return 0;
}

export type BasisCheckInput = {
  basis: string | null | undefined;
  /** Prior commissionable earnings / events count for this referral or opportunity. */
  priorCommissionableCount: number;
  /** Days since conversion (or referral conversion_event_date). */
  daysSinceConversion: number | null;
  eligiblePeriod: string | null | undefined;
};

export type BasisCheckResult =
  | { ok: true }
  | { ok: false; reason: string; ineligible: true };

export function checkEarningBasisAndPeriod(
  input: BasisCheckInput,
): BasisCheckResult {
  const basis = normalizeEarningBasis(input.basis);
  const periodDays = eligiblePeriodToDays(input.eligiblePeriod);

  if (
    basis === "first_collected_payment" ||
    basis === "fixed_amount"
  ) {
    if (input.priorCommissionableCount > 0) {
      return {
        ok: false,
        ineligible: true,
        reason: "Earning basis allows first collected payment only.",
      };
    }
  }

  // Eligible period: for one_payment (0 days) with each_payment basis, still allow
  // only within same conversion "event" — treat 0 as first-payment-only for period.
  if (periodDays === 0 && input.priorCommissionableCount > 0) {
    return {
      ok: false,
      ineligible: true,
      reason: "Eligible period is one payment only.",
    };
  }

  if (
    periodDays != null &&
    periodDays > 0 &&
    input.daysSinceConversion != null &&
    input.daysSinceConversion > periodDays
  ) {
    return {
      ok: false,
      ineligible: true,
      reason: `Outside eligible commission period (${periodDays} days).`,
    };
  }

  return { ok: true };
}

export function daysBetween(fromIso: string, toDate: Date): number {
  const from = Date.parse(fromIso.includes("T") ? fromIso : `${fromIso}T00:00:00.000Z`);
  if (Number.isNaN(from)) return 0;
  const ms = toDate.getTime() - from;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

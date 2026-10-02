export const ELIGIBLE_OPPORTUNITY_STATUSES = [
  "accepted",
  "in_progress",
  "converted",
] as const;

export type EligibleOpportunityStatus =
  (typeof ELIGIBLE_OPPORTUNITY_STATUSES)[number];

export const ENTERPRISE_PAYMENT_QUALIFYING_ACTION =
  "enterprise_payment_collected";

export function isEligibleOpportunityStatus(
  status: string,
): status is EligibleOpportunityStatus {
  return (ELIGIBLE_OPPORTUNITY_STATUSES as readonly string[]).includes(status);
}

export function isWithinProtectionPeriod(
  protectedUntil: string | null,
  eventTime: Date,
): boolean {
  if (!protectedUntil) return false;
  const untilMs = Date.parse(protectedUntil);
  if (Number.isNaN(untilMs)) return false;
  return eventTime.getTime() <= untilMs;
}

export function validateOpportunityPaymentEligibility(input: {
  status: string;
  protectedUntil: string | null;
  eventTime: Date;
}): { ok: true } | { ok: false; error: string } {
  if (!isEligibleOpportunityStatus(input.status)) {
    return {
      ok: false,
      error: `Opportunity status "${input.status}" is not eligible for payment attribution.`,
    };
  }

  if (!isWithinProtectionPeriod(input.protectedUntil, input.eventTime)) {
    return {
      ok: false,
      error: "Payment is outside the protected attribution period.",
    };
  }

  return { ok: true };
}

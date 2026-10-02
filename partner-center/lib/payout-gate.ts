export type PayoutGate =
  | "on_hold"
  | "needs_tax_setup"
  | "needs_payment_setup"
  | "eligible";

export type PayoutGateProfile = {
  payout_eligibility: string;
  tax_profile_status: string;
  payment_setup_status: string | null;
};

/**
 * Single payout-readiness determination for Home and Earnings.
 * Priority: account hold, then tax, then payment setup.
 */
export function resolvePayoutGate(profile: PayoutGateProfile): PayoutGate {
  if (profile.payout_eligibility === "on_hold") return "on_hold";
  if (profile.tax_profile_status !== "complete") return "needs_tax_setup";
  if (profile.payment_setup_status !== "ready") return "needs_payment_setup";
  return "eligible";
}

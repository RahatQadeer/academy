import type { EngagedReferralProgram } from "@/partner-center/lib/referral-capture/infer-program";

export type AttributionProduct = EngagedReferralProgram;

/** Partner commission program family (enrollment / rules), not referral row values. */
export type CommissionProgram = "academy" | "platform" | "enterprise";

export type AttributionEventSource = "stripe" | "manual" | "quickbooks";

export type QualifyingActionInput = {
  referredUserId: string;
  product: AttributionProduct;
  qualifyingAction: string;
  /** When false, only advances to in_progress — no earning. */
  commissionable: boolean;
  eventSource: AttributionEventSource;
  externalPaymentId?: string;
  eventTimestamp?: string;
  productId?: string;
  /** Collected payment in cents — required for percentage commissions. */
  amountCollectedCents?: number;
};

export type QualifyingActionResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  eventId?: string;
  referralId?: string;
  earningId?: string;
  referralStatus?: string;
  /** Set when conversion succeeded but commission earning failed. */
  earningError?: string;
};

export type CommissionRuleRow = {
  id: string;
  partner_profile_id: string | null;
  program: string;
  rate_type: string;
  rate_value: number | string;
  earning_basis: string | null;
  eligible_period: string | null;
  attribution_window_days: number;
  eligible_revenue_rules: unknown;
  payment_terms: string | null;
  effective_start: string | null;
  effective_end: string | null;
};

export type OpenReferralRow = {
  id: string;
  partner_profile_id: string;
  program: string;
  status: string;
  referral_date: string;
  product: string | null;
};

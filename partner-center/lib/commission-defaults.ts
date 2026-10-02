/**
 * SRS assumed defaults for partner commission display and incomplete rule rows.
 * §24.8 / §25.6 rate · §17.7.3 basis · §17.7.4 eligible period · §17.7.6 payment terms.
 */

/** §25.6 — fifteen percent across Academy, Whitby, and Enterprise. */
export const DEFAULT_COMMISSION_RATE_PERCENT = 15;

/** §17.7.3 / §17.5.13–14 — first collected payment by default. */
export const DEFAULT_EARNING_BASIS = "first_collected_payment";

/** §17.7.4 — one payment only as the working default with first-payment basis. */
export const DEFAULT_ELIGIBLE_PERIOD = "one_payment";

import { paymentTermsDisplayLabel } from "@/partner-center/lib/attribution/payment-terms";

/** §17.7.6 — Net 30 as the working payable schedule default (stored). */
export const DEFAULT_PAYMENT_TERMS = "Net 30";

/** §24.9 / §25.6 — attribution window for Academy and Whitby. */
export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 90;

/** §17.6.9 / §25.6 — Enterprise protected attribution period. */
export const DEFAULT_ENTERPRISE_ATTRIBUTION_WINDOW_DAYS = 180;

export function coalesceEarningBasis(
  value: string | null | undefined,
): string {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_EARNING_BASIS;
}

export function coalesceEligiblePeriod(
  value: string | null | undefined,
): string {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_ELIGIBLE_PERIOD;
}

export function coalescePaymentTerms(
  value: string | null | undefined,
): string {
  return paymentTermsDisplayLabel(value?.trim() || DEFAULT_PAYMENT_TERMS);
}

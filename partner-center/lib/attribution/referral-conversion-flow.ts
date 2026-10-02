/**
 * Pure helpers for referral conversion vs earning (SRS §17.5.14).
 * Kept free of path aliases so node --test can load them.
 */

export function shouldHealConvertedStatus(status: string): boolean {
  return status === "referred" || status === "in_progress";
}

export type ConvertThenEarnInput = {
  ok: boolean;
  skipped?: boolean;
  earningId?: string;
  error?: string;
};

export type ConvertThenEarnOutcome = {
  referralStatus: "converted";
  earningId?: string;
  earningError?: string;
};

/**
 * After a commissionable conversion event is recorded, status is always
 * Converted. Earning failure is surfaced separately and must not undo status.
 */
export function outcomeAfterConvertThenEarn(
  earning: ConvertThenEarnInput,
): ConvertThenEarnOutcome {
  if (!earning.ok && !earning.skipped) {
    return {
      referralStatus: "converted",
      earningError: earning.error ?? "Could not create earning.",
    };
  }
  return {
    referralStatus: "converted",
    earningId: earning.earningId,
  };
}

export function buildConvertedReferralUpdate(
  eventTime: Date,
  productId?: string,
): {
  status: "converted";
  conversion_event_date: string;
  product?: string;
} {
  return {
    status: "converted",
    conversion_event_date: eventTime.toISOString().slice(0, 10),
    ...(productId ? { product: productId } : {}),
  };
}

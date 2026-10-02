/** Proportional reversal delta for cumulative refund/chargeback amounts. */
export function computeReversalDelta(
  earningAmount: number,
  refundCents: number,
  originalCollectedCents: number,
  existingAdjustmentTotal: number,
): number {
  if (
    !Number.isFinite(earningAmount) ||
    earningAmount <= 0 ||
    !Number.isFinite(refundCents) ||
    refundCents <= 0 ||
    !Number.isFinite(originalCollectedCents) ||
    originalCollectedCents <= 0
  ) {
    return 0;
  }

  const refundRatio = Math.min(refundCents / originalCollectedCents, 1);
  const targetDelta = -Math.round(earningAmount * refundRatio * 100) / 100;
  const incremental = targetDelta - existingAdjustmentTotal;
  if (incremental >= 0) return 0;
  return incremental;
}

export function isFullReversal(
  refundCents: number,
  originalCollectedCents: number,
): boolean {
  if (originalCollectedCents <= 0) return false;
  return refundCents >= originalCollectedCents;
}

export function effectiveEarningAmount(
  baseAmount: number,
  adjustmentTotal: number,
): number {
  return Math.round((baseAmount + adjustmentTotal) * 100) / 100;
}

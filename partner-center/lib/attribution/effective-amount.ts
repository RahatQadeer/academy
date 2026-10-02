import { effectiveEarningAmount } from "@/partner-center/lib/attribution/reversal-math";

export type EarningWithAdjustments = {
  id: string;
  amount: number | string;
  status: string;
  adjustments?: { amount_delta: number | string }[];
};

export function sumAdjustmentDeltas(
  adjustments: { amount_delta: number | string }[] | null | undefined,
): number {
  if (!adjustments?.length) return 0;
  return adjustments.reduce(
    (sum, row) => sum + (Number(row.amount_delta) || 0),
    0,
  );
}

export function getEffectiveAmount(earning: EarningWithAdjustments): number {
  const base = Number(earning.amount) || 0;
  const adj = sumAdjustmentDeltas(earning.adjustments);
  return effectiveEarningAmount(base, adj);
}

export function groupAdjustmentsByEarningId<
  T extends { earning_id: string; amount_delta: number | string; applied_at?: string | null },
>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.earning_id) ?? [];
    list.push(row);
    map.set(row.earning_id, list);
  }
  return map;
}

/** Pending clawbacks: negative adjustments on paid earnings not yet applied to a payout. */
export function sumPendingClawbacks(
  adjustments: {
    amount_delta: number | string;
    applied_at?: string | null;
  }[],
): number {
  let total = 0;
  for (const row of adjustments) {
    if (row.applied_at) continue;
    const delta = Number(row.amount_delta) || 0;
    if (delta < 0) total += delta;
  }
  return total;
}

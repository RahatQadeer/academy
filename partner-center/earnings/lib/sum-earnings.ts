import {
  getEffectiveAmount,
  type EarningWithAdjustments,
} from "@/partner-center/lib/attribution/effective-amount";

export type EarningRowForSum = {
  id: string;
  amount: number | string;
  status: string;
};

export type AdjustmentDeltaRow = {
  earning_id: string;
  amount_delta: number | string;
};

export type EarningsSumTotals = {
  pending: number;
  payable: number;
  held: number;
  paid: number;
  reversed: number;
};

const EMPTY_TOTALS: EarningsSumTotals = {
  pending: 0,
  payable: 0,
  held: 0,
  paid: 0,
  reversed: 0,
};

export function sumEarningsWithAdjustments(
  rows: EarningRowForSum[],
  adjustmentsByEarningId: Map<string, { amount_delta: number | string }[]>,
): EarningsSumTotals {
  const totals = { ...EMPTY_TOTALS };

  for (const row of rows) {
    const effective = getEffectiveAmount({
      ...row,
      adjustments: adjustmentsByEarningId.get(row.id),
    });
    const status = row.status;

    if (status === "reversed") {
      totals.reversed += effective;
    } else if (status === "pending" || status === "approved") {
      totals.pending += effective;
    } else if (status === "payable" || status === "payout_locked") {
      totals.payable += effective;
    } else if (status === "held") {
      totals.held += effective;
    } else if (status === "paid") {
      totals.paid += effective;
    }
  }

  return totals;
}

export function mapAdjustmentsByEarningId(
  rows: AdjustmentDeltaRow[],
): Map<string, { amount_delta: number | string }[]> {
  const map = new Map<string, { amount_delta: number | string }[]>();
  for (const row of rows) {
    const list = map.get(row.earning_id) ?? [];
    list.push({ amount_delta: row.amount_delta });
    map.set(row.earning_id, list);
  }
  return map;
}

export function effectiveAmountForRow(
  row: EarningRowForSum,
  adjustmentsByEarningId: Map<string, { amount_delta: number | string }[]>,
): number {
  return getEffectiveAmount({
    ...row,
    adjustments: adjustmentsByEarningId.get(row.id),
  } satisfies EarningWithAdjustments);
}

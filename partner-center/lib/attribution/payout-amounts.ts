import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEffectiveAmount,
  sumPendingClawbacks,
} from "@/partner-center/lib/attribution/effective-amount";

export type EarningAmountRow = {
  id: string;
  amount: number | string;
  status: string;
};

export type AdjustmentRow = {
  id: string;
  earning_id: string;
  amount_delta: number | string;
  applied_at?: string | null;
};

export async function loadAdjustmentsForEarnings(
  supabase: SupabaseClient,
  earningIds: string[],
): Promise<AdjustmentRow[]> {
  if (earningIds.length === 0) return [];
  const { data } = await supabase
    .from("partner_earning_adjustments")
    .select("id, earning_id, amount_delta, applied_at")
    .in("earning_id", earningIds);
  return (data ?? []) as AdjustmentRow[];
}

export async function loadPendingClawbacksForPartner(
  supabase: SupabaseClient,
  partnerProfileId: string,
): Promise<{ adjustments: AdjustmentRow[]; totalDollars: number }> {
  const { data: paidEarnings } = await supabase
    .from("partner_earnings")
    .select("id")
    .eq("partner_profile_id", partnerProfileId)
    .eq("status", "paid");

  const paidIds = (paidEarnings ?? []).map((row) => row.id as string);
  if (paidIds.length === 0) {
    return { adjustments: [], totalDollars: 0 };
  }

  const { data: adjustments } = await supabase
    .from("partner_earning_adjustments")
    .select("id, earning_id, amount_delta, applied_at")
    .in("earning_id", paidIds)
    .is("applied_at", null)
    .lt("amount_delta", 0);

  const rows = (adjustments ?? []) as AdjustmentRow[];
  const totalDollars = Math.abs(sumPendingClawbacks(rows));
  return { adjustments: rows, totalDollars };
}

export function effectiveAmountsForEarnings(
  earnings: EarningAmountRow[],
  adjustments: AdjustmentRow[],
): Map<string, number> {
  const byEarning = new Map<string, AdjustmentRow[]>();
  for (const adj of adjustments) {
    const list = byEarning.get(adj.earning_id) ?? [];
    list.push(adj);
    byEarning.set(adj.earning_id, list);
  }

  const result = new Map<string, number>();
  for (const earning of earnings) {
    result.set(
      earning.id,
      getEffectiveAmount({
        ...earning,
        adjustments: byEarning.get(earning.id),
      }),
    );
  }
  return result;
}

export async function markClawbacksApplied(
  supabase: SupabaseClient,
  adjustmentIds: string[],
  appliedAt: string,
): Promise<void> {
  if (adjustmentIds.length === 0) return;
  await supabase
    .from("partner_earning_adjustments")
    .update({ applied_at: appliedAt })
    .in("id", adjustmentIds)
    .is("applied_at", null);
}

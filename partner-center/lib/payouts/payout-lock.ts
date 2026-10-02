import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** In-flight payout batch lock — distinct from SRS §17.1.12 `held`. */
export const PAYOUT_LOCK_STATUS = "payout_locked" as const;

export async function releasePayoutLockedEarnings(
  supabase: SupabaseClient,
  earningIds: string[],
) {
  if (earningIds.length === 0) return;
  await supabase
    .from("partner_earnings")
    .update({ status: "payable", updated_at: new Date().toISOString() })
    .in("id", earningIds)
    .eq("status", PAYOUT_LOCK_STATUS);
}

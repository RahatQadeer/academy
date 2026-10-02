import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import type { SupabaseClient } from "@supabase/supabase-js";

/** First staff note in an empty partner thread. */
export const PARTNER_OPENING_MESSAGE =
  "Welcome to Partner Center. This is your secure line with Private Attache - feel free to reach out anytime with questions about your account, referrals, opportunities, or earnings. We're here to help.";

/**
 * Inserts the opening staff message when the partner thread is empty.
 * Idempotent: no-op if any message already exists.
 */
export async function ensureOpeningStaffMessage(
  admin: SupabaseClient,
  profileId: string,
): Promise<{ inserted: boolean; error?: string }> {
  if (!profileId) return { inserted: false, error: "Missing partner profile." };

  const { count, error: countError } = await admin
    .from("partner_messages")
    .select("id", { count: "exact", head: true })
    .eq("partner_profile_id", profileId)
    .eq("channel", "support_billing");

  if (countError) {
    return { inserted: false, error: partnerFacingError("Could not load messages.", countError.message) };
  }
  if ((count ?? 0) > 0) return { inserted: false };

  const { error: insertError } = await admin.from("partner_messages").insert({
    partner_profile_id: profileId,
    sender_type: "staff",
    sender_contact_id: null,
    body: PARTNER_OPENING_MESSAGE,
    channel: "support_billing",
  });

  if (insertError) return { inserted: false, error: partnerFacingError("Could not load messages.", insertError.message) };
  return { inserted: true };
}

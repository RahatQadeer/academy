import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartnerMessageChannel } from "@/partner-center/admin/lib/shared";

/** Fast path: insert only. Status was already gated when the thread opened. */
export async function sendStaffMessage(input: {
  admin: SupabaseClient;
  profileId: string;
  body: string;
  channel?: PartnerMessageChannel;
}): Promise<{ error?: string }> {
  const body = input.body.trim();
  if (!body) return { error: "Write a message before sending." };
  if (!input.profileId) return { error: "Could not send this message." };

  const { error: insertError } = await input.admin.from("partner_messages").insert({
    partner_profile_id: input.profileId,
    sender_type: "staff",
    sender_contact_id: null,
    body,
    channel: input.channel ?? "support_billing",
  });

  if (insertError) return { error: insertError.message };
  return {};
}

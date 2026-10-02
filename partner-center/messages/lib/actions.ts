"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/base/lib/supabase/server";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { contactDisplayName, partnerCanSend } from "@/partner-center/messages/lib/format";
import { notifyPartnerMessage } from "@/super-admin/partner-center/lib/notifications/create-notification";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

const MESSAGES_PATH = "/partner-center/messages";

export async function markMessagesRead(
  profileId: string,
): Promise<{ markedNotifications?: number }> {
  if (!profileId) return {};

  const { user, context } = await requirePartnerAppAccess();
  if (user.id === "preview" || !context?.profile || context.profile.id !== profileId) {
    return {};
  }

  const supabase = await createClient();
  await supabase.rpc("partner_mark_messages_read", { p_profile_id: profileId });

  // Opening Messages also clears "new message" rows in the notification bell.
  const { data: notifications } = await supabase
    .from("partner_notifications")
    .select("id")
    .eq("partner_profile_id", profileId)
    .eq("kind", "new_message")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!notifications?.length) return {};

  const readAt = new Date().toISOString();
  const { error } = await supabase.from("partner_notification_reads").upsert(
    notifications.map((row) => ({
      notification_id: row.id as string,
      user_id: user.id,
      read_at: readAt,
    })),
    { onConflict: "notification_id,user_id" },
  );

  if (error) return {};

  revalidatePath("/partner-center", "layout");
  return { markedNotifications: notifications.length };
}

export async function sendMessage(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  const profileId = String(formData.get("profileId") ?? "").trim();
  const channelRaw = String(formData.get("channel") ?? "partner_manager").trim();
  const channel =
    channelRaw === "support_billing" ? "support_billing" : "partner_manager";

  if (!body) return { error: "Write a message before sending." };
  if (!profileId) return { error: "Could not send this message." };

  const { user, context } = await requirePartnerAppAccess();
  if (user.id === "preview") {
    return { error: "Connect Supabase to send messages." };
  }

  if (!context?.profile || context.profile.id !== profileId) {
    return { error: "Could not send this message." };
  }

  if (!partnerCanSend(context.teamMember?.access_level)) {
    return { error: "Your access level does not allow sending messages." };
  }

  const contactId = context.contact?.id;
  if (!contactId) {
    return { error: "Could not send this message." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("partner_messages").insert({
    partner_profile_id: profileId,
    sender_type: "partner",
    sender_contact_id: contactId,
    body,
    channel,
  });

  if (error) {
    return { error: "Could not send. Please try again." };
  }

  const senderName = contactDisplayName(context.contact);
  const companyName = context.company?.name?.trim() || "Partner";

  // Do not await side work — it was keeping POST at 5–8s.
  after(() => {
    void supabase.rpc("partner_mark_messages_read", { p_profile_id: profileId });
    void notifyPartnerMessage({
      profileId,
      senderName,
      companyName,
      preview: body,
      channel,
    }).catch(() => {
      /* notification is best-effort */
    });
    revalidatePath(PC_ADMIN.messages);
    revalidatePath(PC_ADMIN.message(profileId));
  });

  revalidatePath(MESSAGES_PATH);
  return { ok: true as const };
}

"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { notifyPartnerNewMessage } from "@/partner-center/lib/notifications/create-partner-notification";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { adminWriter } from "@/super-admin/partner-center/lib/admin-writer";
import { sendStaffMessage } from "@/super-admin/partner-center/messages/services/sendStaffMessage";

type ActionResult = { error?: string; ok?: boolean };

export async function sendStaffMessageAction(input: {
  profileId: string;
  body: string;
  channel?: "partner_manager" | "support_billing";
}): Promise<ActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const channel = input.channel ?? "support_billing";

  const result = await sendStaffMessage({
    admin: loaded.admin,
    profileId: input.profileId,
    body: input.body,
    channel,
  });

  if (result.error) return { error: result.error };

  after(() => {
    void (async () => {
      await loaded.admin.from("partner_message_staff_reads").upsert(
        {
          partner_profile_id: input.profileId,
          channel,
          last_read_at: new Date().toISOString(),
          reader_user_id: loaded.actorUserId,
        },
        { onConflict: "partner_profile_id,channel" },
      );

      const notifyResult = await notifyPartnerNewMessage({
        admin: loaded.admin,
        partnerProfileId: input.profileId,
        preview: input.body.trim(),
      });
      if (!notifyResult.ok) {
        console.error(
          "[sendStaffMessageAction] partner notification failed",
          input.profileId,
          notifyResult.error,
        );
      }
    })();
    revalidatePath("/partner-center/messages");
    revalidatePath("/partner-center", "layout");
    revalidatePath(PC_ADMIN.messages);
  });

  revalidatePath(PC_ADMIN.message(input.profileId));
  return { ok: true };
}

export async function markStaffMessagesRead(
  profileId: string,
  channel: "partner_manager" | "support_billing" = "support_billing",
): Promise<{ markedNotifications?: number }> {
  if (!profileId) return {};

  const loaded = await adminWriter();
  if ("error" in loaded) return {};

  await loaded.admin.from("partner_message_staff_reads").upsert(
    {
      partner_profile_id: profileId,
      channel,
      last_read_at: new Date().toISOString(),
      reader_user_id: loaded.actorUserId,
    },
    { onConflict: "partner_profile_id,channel" },
  );

  const staffEmail = loaded.staffEmail.trim().toLowerCase();
  if (!staffEmail) return {};

  // Prefer entity_id; also match href for older notification rows.
  const [{ data: byEntity }, { data: byHref }] = await Promise.all([
    loaded.admin
      .from("partner_admin_notifications")
      .select("id")
      .eq("kind", "partner_message")
      .eq("entity_id", profileId)
      .order("created_at", { ascending: false })
      .limit(100),
    loaded.admin
      .from("partner_admin_notifications")
      .select("id")
      .eq("kind", "partner_message")
      .ilike("href", `%${profileId}%`)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const ids = [
    ...new Set(
      [...(byEntity ?? []), ...(byHref ?? [])].map((row) => row.id as string),
    ),
  ];
  if (ids.length === 0) return {};

  const readAt = new Date().toISOString();
  const { error } = await loaded.admin
    .from("partner_admin_notification_staff_reads")
    .upsert(
      ids.map((notification_id) => ({
        notification_id,
        staff_email: staffEmail,
        read_at: readAt,
      })),
      { onConflict: "notification_id,staff_email" },
    );

  if (error) {
    console.error("[markStaffMessagesRead] notification reads failed", error);
    return {};
  }

  revalidatePath(PC_ADMIN.root, "layout");
  revalidatePath(PC_ADMIN.messages);
  revalidatePath(PC_ADMIN.message(profileId));
  return { markedNotifications: ids.length };
}

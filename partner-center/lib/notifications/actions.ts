"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { revalidatePath } from "next/cache";
import { createClient } from "@/base/lib/supabase/server";
import { requirePartnerSession } from "@/partner-center/lib/access";

type ActionResult = { error?: string; ok?: boolean };

export async function markPartnerNotificationReadAction(input: {
  notificationId: string;
}): Promise<ActionResult> {
  const { user, context } = await requirePartnerSession();
  if (user.id === "preview" || !context?.profile?.id) {
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("partner_notification_reads").upsert(
    {
      notification_id: input.notificationId,
      user_id: user.id,
      read_at: new Date().toISOString(),
    },
    { onConflict: "notification_id,user_id" },
  );

  if (error) return { error: partnerFacingError("Could not update notifications.", error.message) };
  revalidatePath("/partner-center");
  return { ok: true };
}

export async function markAllPartnerNotificationsReadAction(): Promise<ActionResult> {
  const { user, context } = await requirePartnerSession();
  if (user.id === "preview" || !context?.profile?.id) {
    return { ok: true };
  }

  const supabase = await createClient();
  const { data: notifications, error: listError } = await supabase
    .from("partner_notifications")
    .select("id")
    .eq("partner_profile_id", context.profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (listError) return { error: partnerFacingError("Could not update notifications.", listError.message) };
  if (!notifications?.length) return { ok: true };

  const rows = notifications.map((row) => ({
    notification_id: row.id as string,
    user_id: user.id,
    read_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("partner_notification_reads")
    .upsert(rows, { onConflict: "notification_id,user_id" });

  if (error) return { error: partnerFacingError("Could not update notifications.", error.message) };
  revalidatePath("/partner-center");
  return { ok: true };
}

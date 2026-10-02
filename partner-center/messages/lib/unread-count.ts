import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { filterPartnerMessagesSince } from "@/partner-center/messages/lib/message-visibility";

type MessageRow = {
  id: string;
  sender_type: "partner" | "staff";
  sender_contact_id: string | null;
  body: string;
  created_at: string;
};

type ReadRow = {
  last_read_at: string;
};

/** Staff messages after last_read_at count as unread for this user. */
export function countUnreadStaffMessages(
  messages: Pick<MessageRow, "sender_type" | "created_at">[],
  lastReadAt: string | null,
): number {
  const staff = messages.filter((row) => row.sender_type === "staff");
  if (staff.length === 0) return 0;
  if (!lastReadAt) return staff.length;
  return staff.filter((row) => row.created_at > lastReadAt).length;
}

export async function loadPartnerUnreadCount(
  profileId: string,
  userId: string,
  /** Invited teammates: ignore company history from before they joined. */
  visibleSince?: string | null,
): Promise<number> {
  const supabase = await createClient();

  const [{ data: messages }, { data: readRow }] = await Promise.all([
    supabase
      .from("partner_messages")
      .select("sender_type, created_at")
      .eq("partner_profile_id", profileId)
      .order("created_at", { ascending: true }),
    supabase
      .from("partner_message_reads")
      .select("last_read_at")
      .eq("partner_profile_id", profileId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const visible = filterPartnerMessagesSince(
    (messages ?? []) as MessageRow[],
    visibleSince ?? null,
  );

  return countUnreadStaffMessages(
    visible,
    (readRow as ReadRow | null)?.last_read_at ?? null,
  );
}

export async function loadLastReadAt(
  profileId: string,
  userId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_message_reads")
    .select("last_read_at")
    .eq("partner_profile_id", profileId)
    .eq("user_id", userId)
    .maybeSingle();

  return (data as ReadRow | null)?.last_read_at ?? null;
}

/** Latest staff read cursor for a partner thread (receipts). */
export async function loadStaffLastReadAt(
  profileId: string,
  channel: "partner_manager" | "support_billing" = "support_billing",
): Promise<string | null> {
  const reader = createAdminClient() ?? (await createClient());
  const { data, error } = await reader
    .from("partner_message_staff_reads")
    .select("last_read_at")
    .eq("partner_profile_id", profileId)
    .eq("channel", channel)
    .maybeSingle();

  if (error) return null;
  return (data as ReadRow | null)?.last_read_at ?? null;
}

/** Latest partner-side read across any team member (for staff ticks). */
export async function loadPartnerSideLastReadAt(
  profileId: string,
): Promise<string | null> {
  const reader = createAdminClient() ?? (await createClient());
  const { data } = await reader
    .from("partner_message_reads")
    .select("last_read_at")
    .eq("partner_profile_id", profileId)
    .order("last_read_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ReadRow | null)?.last_read_at ?? null;
}

export type { MessageRow };

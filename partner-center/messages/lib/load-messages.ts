import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import type { User } from "@/base/types";
import { demoMessages, demoUnreadCount } from "@/partner-center/messages/lib/demo-fixtures";
import {
  contactDisplayName,
  initialsFromName,
  partnerCanSend,
  staffDisplay,
} from "@/partner-center/messages/lib/format";
import { ensureOpeningStaffMessage } from "@/partner-center/messages/lib/ensure-opening-message";
import {
  filterPartnerMessagesSince,
  partnerMessagesVisibleSince,
} from "@/partner-center/messages/lib/message-visibility";
import { messageIsRead } from "@/partner-center/messages/lib/read-status";
import {
  countUnreadStaffMessages,
  loadLastReadAt,
  loadStaffLastReadAt,
  type MessageRow,
} from "@/partner-center/messages/lib/unread-count";
import type { MessagesPageData, PartnerMessage } from "@/partner-center/messages/types";
import type { LoadResult } from "@/partner-center/lib/load-result";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import type { PartnerContext } from "@/partner-center/types/partner";

function mapMessage(
  row: MessageRow,
  partnerName: string,
  partnerInitials: string,
  partnerContactId: string | null,
  staffLastReadAt: string | null,
): PartnerMessage {
  if (row.sender_type === "staff") {
    const staff = staffDisplay();
    return {
      id: row.id,
      senderType: "staff",
      authorName: staff.name,
      authorInitials: staff.initials,
      body: row.body,
      sentAt: row.created_at,
      isMine: false,
    };
  }

  const isMine =
    partnerContactId != null && row.sender_contact_id === partnerContactId;

  return {
    id: row.id,
    senderType: "partner",
    authorName: partnerName,
    authorInitials: partnerInitials,
    body: row.body,
    sentAt: row.created_at,
    isMine,
    readStatus: messageIsRead(row.created_at, staffLastReadAt) ? "read" : "sent",
  };
}

export async function loadMessagesPage(
  context: PartnerContext | null,
  user: User,
  channel: "partner_manager" | "support_billing" = "partner_manager",
): Promise<LoadResult<MessagesPageData>> {
  const profile = context?.profile;
  if (!profile) {
    return { ok: false, error: "Messages could not be loaded." };
  }

  const companyName = context.company?.name?.trim() || "your company";
  const partnerName = contactDisplayName(context.contact);
  const partnerInitials = initialsFromName(partnerName);
  const canSend = partnerCanSend(context.teamMember?.access_level);
  const contactId = context.contact?.id ?? null;
  const visibleSince = partnerMessagesVisibleSince(context);

  if (!isSupabaseConfigured() || user.id === "preview") {
    const messages = visibleSince ? [] : demoMessages(partnerName);
    return {
      ok: true,
      data: {
        profileId: profile.id,
        companyName,
        canSend,
        messages,
        unreadCount: visibleSince ? 0 : demoUnreadCount(),
        liveEnabled: false,
        staffLastReadAt: null,
        channel,
      },
    };
  }

  const supabase = await createClient();
  const reader = createAdminClient() ?? supabase;

  const [{ data: rows, error }, lastReadAt, staffLastReadAt] = await Promise.all([
    reader
      .from("partner_messages")
      .select("id, sender_type, sender_contact_id, body, created_at, channel")
      .eq("partner_profile_id", profile.id)
      .eq("channel", channel)
      .order("created_at", { ascending: true }),
    loadLastReadAt(profile.id, user.id),
    loadStaffLastReadAt(profile.id, channel),
  ]);

  let messageRows: MessageRow[] = (rows ?? []) as MessageRow[];

  if (error) {
    console.warn(
      "[partner-messages] load failed; showing empty inbox",
      error.code,
      error.message,
    );
    messageRows = [];
  }

  // Opening seed only for Support and Billing when that channel is empty.
  if (
    channel === "support_billing" &&
    messageRows.length === 0 &&
    !visibleSince
  ) {
    const opening = await ensureOpeningStaffMessage(reader, profile.id);
    if (opening.error) {
      console.warn("[partner-messages] opening message skipped", opening.error);
    }
    if (opening.inserted) {
      const { data: seeded } = await reader
        .from("partner_messages")
        .select("id, sender_type, sender_contact_id, body, created_at, channel")
        .eq("partner_profile_id", profile.id)
        .eq("channel", channel)
        .order("created_at", { ascending: true });
      messageRows = (seeded ?? []) as MessageRow[];
    }
  }

  messageRows = filterPartnerMessagesSince(messageRows, visibleSince);

  const senderContactIds = [
    ...new Set(
      messageRows
        .map((row) => row.sender_contact_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const contactNames = new Map<string, string>();
  if (senderContactIds.length > 0) {
    const { data: contacts } = await reader
      .from("contacts")
      .select("id, preferred_name, first_name, last_name")
      .in("id", senderContactIds);
    for (const row of contacts ?? []) {
      contactNames.set(
        row.id as string,
        contactDisplayName(row as Parameters<typeof contactDisplayName>[0]),
      );
    }
  }

  const messages = messageRows.map((row) => {
    if (row.sender_type === "staff") {
      return mapMessage(row, partnerName, partnerInitials, contactId, staffLastReadAt);
    }
    const senderName =
      (row.sender_contact_id && contactNames.get(row.sender_contact_id)) ||
      partnerName;
    const senderInitials = initialsFromName(senderName);
    return mapMessage(row, senderName, senderInitials, contactId, staffLastReadAt);
  });

  return {
    ok: true,
    data: {
      profileId: profile.id,
      companyName,
      canSend,
      messages,
      unreadCount: countUnreadStaffMessages(messageRows, lastReadAt),
      liveEnabled: true,
      staffLastReadAt,
      channel,
    },
  };
}

import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";
import { resolvePartnerNotificationHref } from "@/partner-center/lib/notifications/resolve-href";
import {
  isNotificationVisibleInBell,
  type PartnerNotificationItem,
} from "@/partner-center/lib/notifications/types";

export async function loadPartnerNotifications(limit = 20): Promise<{
  items: PartnerNotificationItem[];
  unreadCount: number;
  configured: boolean;
  partnerProfileId: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return {
      items: [],
      unreadCount: 0,
      configured: false,
      partnerProfileId: null,
    };
  }

  const session = await getSessionProfile();
  if (!session?.user.id) {
    return {
      items: [],
      unreadCount: 0,
      configured: true,
      partnerProfileId: null,
    };
  }

  const context = await resolvePartner(session.user, session.entitlements);
  const partnerProfileId = context?.profile?.id ?? null;
  if (!partnerProfileId) {
    return {
      items: [],
      unreadCount: 0,
      configured: true,
      partnerProfileId: null,
    };
  }

  const supabase = await createClient();
  const userId = session.user.id;

  // Over-fetch then filter by 24h read window.
  const { data: notifications, error } = await supabase
    .from("partner_notifications")
    .select("id, kind, title, body, href, entity_type, entity_id, created_at")
    .eq("partner_profile_id", partnerProfileId)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 3, 60));

  if (error || !notifications?.length) {
    return {
      items: [],
      unreadCount: 0,
      configured: true,
      partnerProfileId,
    };
  }

  const ids = notifications.map((row) => row.id as string);
  const { data: reads } = await supabase
    .from("partner_notification_reads")
    .select("notification_id, read_at")
    .eq("user_id", userId)
    .in("notification_id", ids);

  const readAtById = new Map<string, string>();
  for (const row of reads ?? []) {
    readAtById.set(
      row.notification_id as string,
      row.read_at as string,
    );
  }

  const now = Date.now();
  const items: PartnerNotificationItem[] = [];
  for (const row of notifications) {
    const id = row.id as string;
    const readAt = readAtById.get(id) ?? null;
    const read = readAt != null;
    if (!isNotificationVisibleInBell({ read, readAt, now })) continue;

    items.push({
      id,
      kind: row.kind as string,
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      href: resolvePartnerNotificationHref({
        href: (row.href as string | null) ?? null,
        entityType: (row.entity_type as string | null) ?? null,
        entityId: (row.entity_id as string | null) ?? null,
      }),
      createdAt: row.created_at as string,
      read,
      readAt,
    });
    if (items.length >= limit) break;
  }

  const unreadCount = items.filter((item) => !item.read).length;

  return { items, unreadCount, configured: true, partnerProfileId };
}

import "server-only";

import { requireSuperAdmin } from "@/super-admin/lib/is-super-admin";
import { getStaffSession } from "@/super-admin/lib/staff-session";
import {
  createAdminClient,
  isAdminDataConfigured,
} from "@/super-admin/partner-center/lib/admin-client";
import { resolveAdminNotificationHref } from "@/super-admin/partner-center/lib/notifications/resolve-href";
import type { AdminNotificationItem } from "@/super-admin/partner-center/lib/notifications/types";
import { isNotificationVisibleInBell } from "@/partner-center/lib/notifications/types";

function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function loadAdminNotifications(limit = 20): Promise<{
  items: AdminNotificationItem[];
  unreadCount: number;
  configured: boolean;
}> {
  await requireSuperAdmin();

  if (!isAdminDataConfigured()) {
    return { items: [], unreadCount: 0, configured: false };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { items: [], unreadCount: 0, configured: false };
  }

  const session = await getStaffSession();
  const staffEmail = session?.email
    ? normalizeStaffEmail(session.email)
    : null;

  const { data: notifications, error } = await admin
    .from("partner_admin_notifications")
    .select("id, kind, title, body, href, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 3, 60));

  if (error || !notifications?.length) {
    return { items: [], unreadCount: 0, configured: true };
  }

  const ids = notifications.map((row) => row.id as string);
  const readAtById = new Map<string, string>();

  if (staffEmail && ids.length > 0) {
    const { data: reads } = await admin
      .from("partner_admin_notification_staff_reads")
      .select("notification_id, read_at")
      .eq("staff_email", staffEmail)
      .in("notification_id", ids);
    for (const row of reads ?? []) {
      readAtById.set(
        row.notification_id as string,
        row.read_at as string,
      );
    }
  }

  const now = Date.now();
  const items: AdminNotificationItem[] = [];
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
      href: resolveAdminNotificationHref({
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

  return {
    items,
    unreadCount: items.filter((item) => !item.read).length,
    configured: true,
  };
}

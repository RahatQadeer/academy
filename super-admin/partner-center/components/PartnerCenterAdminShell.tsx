import { PartnerCenterAdminShellClient } from "@/super-admin/partner-center/components/PartnerCenterAdminShellClient";
import { AdminNotificationsBell } from "@/super-admin/partner-center/components/AdminNotificationsBell";
import { LiveAdminNotifications } from "@/super-admin/partner-center/components/LiveAdminNotifications";
import { loadAdminNotifications } from "@/super-admin/partner-center/lib/notifications/load-notifications";
import { loadMessageThreads } from "@/super-admin/partner-center/messages/lib/load-messages";
import type { AdminNotificationItem } from "@/super-admin/partner-center/lib/notifications/types";

/** Unread message notifications shown in the admin bell. */
export function countUnreadAdminMessageNotifications(
  items: Pick<AdminNotificationItem, "kind" | "read" | "title">[],
): number {
  return items.filter((item) => {
    if (item.read) return false;
    if (item.kind === "partner_message") return true;
    // Fallback for older rows that may lack kind.
    return item.title.toLowerCase().startsWith("message from");
  }).length;
}

export async function PartnerCenterAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, threads] = await Promise.all([
    loadAdminNotifications(),
    loadMessageThreads().catch(() => ({ unreadThreadCount: 0 })),
  ]);

  const messagesUnread = Math.max(
    threads.unreadThreadCount ?? 0,
    countUnreadAdminMessageNotifications(notifications.items),
  );

  return (
    <>
      <LiveAdminNotifications enabled={notifications.configured} />
      <PartnerCenterAdminShellClient
        messagesUnread={messagesUnread}
        notifications={
          <AdminNotificationsBell
            initialItems={notifications.items}
            initialUnreadCount={notifications.unreadCount}
          />
        }
      >
        {children}
      </PartnerCenterAdminShellClient>
    </>
  );
}

import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getProduct } from "@/base/switcher/products";
import type { ProductKey } from "@/base/types";
import { PartnerSidebar } from "@/partner-center/components/PartnerSidebar";
import { PartnerAppShellClient } from "@/partner-center/components/PartnerAppShellClient";
import { PartnerNotificationsBell } from "@/partner-center/components/PartnerNotificationsBell";
import { LivePartnerNotifications } from "@/partner-center/components/LivePartnerNotifications";
import { loadPartnerNavBadges } from "@/partner-center/messages/lib/load-nav-badges";
import { loadPartnerNotifications } from "@/partner-center/lib/notifications/load-notifications";
import { isIndividualPartner } from "@/partner-center/lib/partner-type";
import { partnerNavFor } from "@/partner-center/nav";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";

function unreadMessageNotifications(
  items: { kind: string; read: boolean }[],
): number {
  return items.filter(
    (item) => !item.read && item.kind === "new_message",
  ).length;
}

export async function PartnerAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isSupabaseConfigured();
  const profile = configured ? await getSessionProfile() : null;
  const meta = getProduct("partner_center");
  const triggerName = profile?.workspaces[0]?.name || meta.name;
  const userName =
    profile?.user?.preferred_name ||
    profile?.user?.full_name ||
    "You";
  const partner = profile
    ? await resolvePartner(profile.user, profile.entitlements)
    : null;
  const navItems = partnerNavFor(isIndividualPartner(partner?.profile));
  const [badges, notifications] = await Promise.all([
    loadPartnerNavBadges(
      profile?.user ?? null,
      profile?.entitlements ?? [],
    ),
    loadPartnerNotifications(),
  ]);

  // Bell "new message" rows stay unread until marked in the bell; message
  // read-cursor can advance earlier. Sidebar badge uses the higher of the two.
  const messagesBadge = Math.max(
    badges?.messages ?? 0,
    unreadMessageNotifications(notifications.items),
  );

  return (
    <div className="pa-app-shell pa-partner-theme flex overflow-hidden bg-canvas">
      <LivePartnerNotifications
        enabled={notifications.configured}
        partnerProfileId={notifications.partnerProfileId}
      />
      <PartnerSidebar
        productKey={"partner_center" satisfies ProductKey}
        workspaceName={triggerName}
        items={navItems}
        userName={userName}
        entitlements={profile?.entitlements}
        previewAll={!configured}
        badges={messagesBadge > 0 ? { messages: messagesBadge } : null}
      />
      <main className="pa-app-shell-main flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-surface">
        <PartnerAppShellClient
          navItems={navItems}
          notifications={
            <PartnerNotificationsBell
              initialItems={notifications.items}
              initialUnreadCount={notifications.unreadCount}
            />
          }
        >
          {children}
        </PartnerAppShellClient>
      </main>
    </div>
  );
}

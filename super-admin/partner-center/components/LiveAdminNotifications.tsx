"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/base/lib/supabase/client";
import { resolveAdminNotificationHref } from "@/super-admin/partner-center/lib/notifications/resolve-href";

/** Realtime admin notifications + native browser push when permitted. */
export function LiveAdminNotifications({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channel = supabase
      .channel("partner-admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "partner_admin_notifications",
        },
        (payload) => {
          router.refresh();

          if (typeof window === "undefined" || !("Notification" in window)) {
            return;
          }
          if (Notification.permission !== "granted") return;

          const row = payload.new as {
            title?: string;
            body?: string | null;
          };

          try {
            const notification = new Notification(row.title || "Partner Center", {
              body: row.body || undefined,
              tag: `partner-admin-${(payload.new as { id?: string }).id ?? Date.now()}`,
            });
            notification.onclick = () => {
              window.focus();
              const row = payload.new as {
                href?: string | null;
                entity_type?: string | null;
                entity_id?: string | null;
              };
              const href = resolveAdminNotificationHref({
                href: row.href ?? null,
                entityType: row.entity_type ?? null,
                entityId: row.entity_id ?? null,
              });
              if (href) window.location.assign(href);
            };
          } catch {
            // Ignore browsers that block Notification without a user gesture history.
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, router]);

  return null;
}

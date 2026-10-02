"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/base/lib/supabase/client";
import { resolvePartnerNotificationHref } from "@/partner-center/lib/notifications/resolve-href";

/** Realtime partner notifications + native browser push when permitted. */
export function LivePartnerNotifications({
  enabled,
  partnerProfileId,
}: {
  enabled: boolean;
  partnerProfileId: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || !partnerProfileId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`partner-notifications-${partnerProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "partner_notifications",
          filter: `partner_profile_id=eq.${partnerProfileId}`,
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
            const notification = new Notification(
              row.title || "Partner Center",
              {
                body: row.body || undefined,
                tag: `partner-${(payload.new as { id?: string }).id ?? Date.now()}`,
              },
            );
            notification.onclick = () => {
              window.focus();
              const next = payload.new as {
                href?: string | null;
                entity_type?: string | null;
                entity_id?: string | null;
              };
              const href = resolvePartnerNotificationHref({
                href: next.href ?? null,
                entityType: next.entity_type ?? null,
                entityId: next.entity_id ?? null,
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
  }, [enabled, partnerProfileId, router]);

  return null;
}

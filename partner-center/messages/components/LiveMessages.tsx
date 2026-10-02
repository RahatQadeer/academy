"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/base/lib/supabase/client";

const POLL_MS = 5000;

/**
 * Partner inbox live updates.
 * Realtime is best-effort (RLS + publication); polling keeps the thread current.
 */
export function LiveMessages({
  enabled,
  profileId,
}: {
  enabled: boolean;
  profileId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!enabled || !profileId) return;

    const refresh = () => router.refresh();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel(`partner-messages-${profileId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "partner_messages",
            filter: `partner_profile_id=eq.${profileId}`,
          },
          (payload) => {
            refresh();

            const row = payload.new as {
              sender_type?: string;
              body?: string;
            } | null;
            if (
              payload.eventType !== "INSERT" ||
              !row ||
              row.sender_type !== "staff"
            ) {
              return;
            }
            if (pathnameRef.current?.includes("/messages")) return;
            if (typeof window === "undefined" || !("Notification" in window)) {
              return;
            }
            if (Notification.permission !== "granted") return;

            try {
              const notification = new Notification("Private Attache", {
                body: row.body || "New message from Private Attache",
                tag: `partner-msg-${profileId}`,
              });
              notification.onclick = () => {
                window.focus();
                window.location.assign("/partner-center/messages");
              };
            } catch {
              /* ignore */
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "partner_message_staff_reads",
            filter: `partner_profile_id=eq.${profileId}`,
          },
          () => refresh(),
        )
        .subscribe();
    } catch {
      /* polling still runs */
    }

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      if (channel) {
        const supabase = createClient();
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, profileId, router]);

  return null;
}

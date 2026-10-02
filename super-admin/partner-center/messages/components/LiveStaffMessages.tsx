"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 5000;

/**
 * Light polling for the open inbox. Avoids Realtime RLS issues for staff and
 * avoids hammering the server (layout previously reloaded every thread list).
 */
export function LiveStaffMessages({
  enabled,
}: {
  enabled: boolean;
  profileId?: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => router.refresh();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, router]);

  return null;
}

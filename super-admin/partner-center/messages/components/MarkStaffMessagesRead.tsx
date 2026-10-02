"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markStaffMessagesRead } from "@/super-admin/partner-center/messages/actions";

/** Advances the staff read cursor when the thread is open or new mail arrives. */
export function MarkStaffMessagesRead({
  profileId,
  messageCount = 0,
}: {
  profileId: string;
  messageCount?: number;
}) {
  const router = useRouter();
  const lastProfile = useRef<string | null>(null);

  useEffect(() => {
    if (!profileId) return;

    const mark = () => {
      if (document.visibilityState !== "visible") return;
      void markStaffMessagesRead(profileId).then((result) => {
        const marked = result.markedNotifications ?? 0;
        // Refresh bell when this thread's message notifications were cleared,
        // or the first time we open this thread in the session.
        if (marked > 0 || lastProfile.current !== profileId) {
          lastProfile.current = profileId;
          if (marked > 0) router.refresh();
        }
      });
    };

    mark();
    window.addEventListener("focus", mark);
    document.addEventListener("visibilitychange", mark);

    return () => {
      window.removeEventListener("focus", mark);
      document.removeEventListener("visibilitychange", mark);
    };
  }, [profileId, messageCount, router]);

  return null;
}

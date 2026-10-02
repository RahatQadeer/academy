"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markMessagesRead } from "@/partner-center/messages/lib/actions";

/** Advances the partner read cursor when Messages is open or new mail arrives. */
export function MarkMessagesRead({
  profileId,
  messageCount = 0,
}: {
  profileId: string;
  messageCount?: number;
}) {
  const router = useRouter();
  const lastMarkedCount = useRef<number | null>(null);

  useEffect(() => {
    if (!profileId) return;

    const mark = () => {
      if (document.visibilityState !== "visible") return;
      void markMessagesRead(profileId).then((result) => {
        const marked = result.markedNotifications ?? 0;
        if (marked > 0 && lastMarkedCount.current !== marked) {
          lastMarkedCount.current = marked;
          router.refresh();
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

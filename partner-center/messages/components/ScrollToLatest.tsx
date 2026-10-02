"use client";

import { useEffect, useRef } from "react";

/** Jump to the newest message on open; smooth-scroll when the thread grows. */
export function ScrollToLatest({
  threadId,
  count,
}: {
  threadId: string;
  count: number;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const el = anchor.current;
    if (!el) return;

    const opening = seen.current !== threadId;
    seen.current = threadId;

    const feed = el.closest<HTMLElement>("[data-message-feed]");
    if (feed) {
      if (opening) {
        feed.scrollTop = feed.scrollHeight;
      } else {
        feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
      }
      return;
    }

    el.scrollIntoView({
      block: "end",
      behavior: opening ? "auto" : "smooth",
    });
  }, [threadId, count]);

  return <div ref={anchor} aria-hidden className="h-px w-full shrink-0" />;
}

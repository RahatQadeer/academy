"use client";

import { useEffect, useRef } from "react";

/**
 * Opens a conversation where it actually is — at the newest message.
 *
 * A thread pane that starts at the top starts months ago, which is the one
 * place nobody wants to begin. Every chat lands on the latest line, and this
 * one now does too: an instant jump when the conversation changes, because
 * watching a year scroll past is not an animation anyone asked for, and a
 * smooth glide when a message arrives in the conversation already open, which
 * is the moment the movement is worth seeing.
 */
export function ScrollToLatest({ threadId, count }: { threadId: string; count: number }) {
  const anchor = useRef<HTMLDivElement>(null);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const opening = seen.current !== threadId;
    seen.current = threadId;

    anchor.current?.scrollIntoView({
      block: "end",
      behavior: opening ? "auto" : "smooth",
    });
  }, [threadId, count]);

  return <div ref={anchor} aria-hidden className="h-px shrink-0" />;
}

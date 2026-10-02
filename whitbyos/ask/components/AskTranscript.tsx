"use client";

import { useEffect, useRef } from "react";

/** Conversation scroller. Messages sit on the input, ChatGPT-style, and a
 *  long thread scrolls from there rather than starting at the top. */
export function AskTranscript({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });

  /*
   * And it follows a reply that is still being written.
   *
   * The effect above runs when *this* component renders. The typewriter
   * re-renders a descendant sixty times without touching this one, so an
   * answer longer than the window typed itself out below the fold while the
   * reader watched an empty space. A resize observer notices the content
   * growing, whoever caused it.
   *
   * Only while they are already at the bottom: somebody who has scrolled up
   * to read something earlier is reading it, and yanking them back down is
   * the rudest thing a chat window can do.
   */
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const inner = el.firstElementChild;
    if (!inner) return;

    const watch = new ResizeObserver(() => {
      const room = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (room < 160) el.scrollTop = el.scrollHeight;
    });

    watch.observe(inner);
    return () => watch.disconnect();
  }, []);

  return (
    <div ref={box} className="h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {children}
    </div>
  );
}

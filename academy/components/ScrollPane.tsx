"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Scrollable pane that jumps to the top whenever `resetKey` changes
 * (e.g. switching lessons in the course builder or learner player).
 */
export function ScrollPane({
  resetKey,
  className,
  style,
  children,
  as = "div",
  onReachEnd,
}: {
  resetKey: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  as?: "div" | "main";
  /** Fires once when the reader reaches the bottom of the lesson. */
  onReachEnd?: () => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const reachedRef = useRef(false);
  const onReachEndRef = useRef(onReachEnd);
  onReachEndRef.current = onReachEnd;

  useEffect(() => {
    const node = as === "main" ? mainRef.current : divRef.current;
    if (node) node.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0 });
    reachedRef.current = false;
  }, [as, resetKey]);

  const trackReachEnd = Boolean(onReachEnd);

  useEffect(() => {
    if (!trackReachEnd) return;
    const node = as === "main" ? mainRef.current : divRef.current;
    if (!node) return;

    function fire() {
      if (reachedRef.current) return;
      reachedRef.current = true;
      onReachEndRef.current?.();
    }

    function check() {
      if (reachedRef.current) return;

      const nodeScrolls = node!.scrollHeight > node!.clientHeight + 24;
      if (nodeScrolls) {
        const remaining = node!.scrollHeight - node!.scrollTop - node!.clientHeight;
        if (remaining <= 80) fire();
        return;
      }

      // On small screens the document scrolls instead of the pane.
      const doc = document.documentElement;
      const pageScrolls = doc.scrollHeight > window.innerHeight + 24;
      if (pageScrolls) {
        const remaining = doc.scrollHeight - window.scrollY - window.innerHeight;
        if (remaining <= 80) fire();
      }
    }

    function checkShortPage() {
      if (reachedRef.current) return;
      const nodeScrolls = node!.scrollHeight > node!.clientHeight + 24;
      const pageScrolls = document.documentElement.scrollHeight > window.innerHeight + 24;
      if (!nodeScrolls && !pageScrolls) fire();
    }

    // Content may still be painting — check now and again shortly after.
    check();
    const settle = window.setTimeout(() => {
      check();
      checkShortPage();
    }, 400);
    node.addEventListener("scroll", check, { passive: true });
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    observer?.observe(node);

    return () => {
      window.clearTimeout(settle);
      node.removeEventListener("scroll", check);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      observer?.disconnect();
    };
  }, [as, resetKey, trackReachEnd]);

  if (as === "main") {
    return (
      <main ref={mainRef} className={className} style={style}>
        {children}
      </main>
    );
  }

  return (
    <div ref={divRef} className={className} style={style}>
      {children}
    </div>
  );
}

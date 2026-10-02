"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/base/lib/cn";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type NotionRevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay before transition starts (seconds). */
  delay?: number;
};

/** Reveal any blocks already on screen (hash links, restored scroll, etc.). */
export function syncNotionRevealsInView() {
  if (typeof document === "undefined") return;
  document
    .querySelectorAll<HTMLElement>(".notion-reveal:not(.notion-in-view)")
    .forEach((el) => {
      markInViewIfVisible(el);
    });
}

function markInViewIfVisible(el: HTMLElement, observer?: IntersectionObserver) {
  const rect = el.getBoundingClientRect();
  const viewH = window.innerHeight || document.documentElement.clientHeight;
  const visible = rect.top < viewH * 0.94 && rect.bottom > viewH * 0.06;
  if (visible) {
    el.classList.add("notion-in-view");
    observer?.disconnect();
    return true;
  }
  return false;
}

export function NotionReveal({ children, className, delay = 0 }: NotionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ref.current?.classList.add("notion-in-view");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.classList.add("notion-in-view");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add("notion-in-view");
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px 0px 0px" },
    );

    observer.observe(el);

    const sync = () => {
      markInViewIfVisible(el, observer);
    };

    // Hash jumps and nested layouts can skip the first intersection callback.
    const raf = requestAnimationFrame(sync);
    window.addEventListener("hashchange", sync);
    window.addEventListener("load", sync);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("load", sync);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn("notion-reveal", className)}
      style={{ "--notion-reveal-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function NotionStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("notion-stagger", className)}>{children}</div>;
}

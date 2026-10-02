"use client";

import { useEffect, useRef } from "react";
import { PlanScene, PortalScene } from "@/base/landing/NotionScenes";

/**
 * Hero collage: live product scenes that drift gently and follow the pointer.
 */
export function NotionHeroAside() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const blocks = root.querySelectorAll<HTMLElement>(".notion-aside-block");
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = root.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        blocks.forEach((block, index) => {
          const depth = (index + 1) * 5;
          block.style.setProperty("--notion-parallax-x", `${(x * depth).toFixed(2)}px`);
          block.style.setProperty("--notion-parallax-y", `${(y * depth).toFixed(2)}px`);
        });
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <aside ref={rootRef} className="notion-hero-aside notion-hero-aside--scenes" aria-hidden>
      <div className="notion-aside-block notion-aside-block--scene notion-float-a">
        <PlanScene />
      </div>
      <div className="notion-aside-block notion-aside-block--scene notion-float-b">
        <PortalScene />
      </div>
    </aside>
  );
}

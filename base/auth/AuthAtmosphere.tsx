"use client";

import { useEffect, useRef } from "react";

/**
 * The ink column, lit.
 *
 * A flat dark rectangle is the least interesting half of a sign-in screen, and
 * this one had 60% of the page. What it gets instead is depth: two soft pools
 * of colour that drift on their own, and a highlight that follows the cursor
 * across the panel, so the surface reads as lit rather than painted.
 *
 * WHY NOT REACT STATE.
 * A pointer move fires dozens of times a second; putting that through `useState`
 * re-renders the whole panel on every one of them. The position is written to
 * two CSS custom properties instead, inside a rAF, so the browser composites it
 * and React never hears about it.
 *
 * The glow follows lazily rather than exactly — it eases toward the cursor,
 * which is what makes it feel like light rather than a cursor attachment.
 */
export function AuthAtmosphere() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // The layer itself is `pointer-events: none` so it never blocks anything
    // under it — which also means it never hears a pointer move. The panel
    // around it does, so that is what is listened to, and the coordinates are
    // read from the panel's own box.
    const panel = el.closest<HTMLElement>(".pa-auth-panel") ?? el.parentElement;
    if (!panel) return;

    // Somebody who has asked for less motion gets the depth and none of the
    // chasing: the pools still sit there, they simply do not follow.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Starts where the panel's own resting glow is, so the first move eases
    // from there rather than jumping in from a corner.
    let targetX = 50, targetY = 42;
    let x = 50, y = 42;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      const box = panel.getBoundingClientRect();
      targetX = ((event.clientX - box.left) / box.width) * 100;
      targetY = ((event.clientY - box.top) / box.height) * 100;
    };

    const onLeave = () => {
      targetX = 50;
      targetY = 42;
    };

    const tick = () => {
      // A twelfth of the remaining distance per frame: fast enough to feel
      // responsive, slow enough that it trails rather than snaps.
      x += (targetX - x) / 12;
      y += (targetY - y) / 12;
      el.style.setProperty("--pointer-x", `${x.toFixed(2)}%`);
      el.style.setProperty("--pointer-y", `${y.toFixed(2)}%`);
      frame = requestAnimationFrame(tick);
    };

    panel.addEventListener("pointermove", onMove);
    panel.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(tick);

    return () => {
      panel.removeEventListener("pointermove", onMove);
      panel.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className="pa-auth-atmosphere" aria-hidden />;
}

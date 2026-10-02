"use client";

import { useCallback, useRef } from "react";
import { IconArrow, IconCheck } from "@/base/landing/brand/Icons";
import { Monogram } from "@/base/landing/brand/Monogram";
import { PlanScene } from "@/base/landing/NotionScenes";

const TRUST = [
  "No card required",
  "First plan is free",
  "A named person approves anything sensitive",
];

type Props = {
  onPrimary: () => void;
  onSecondary: () => void;
};

/**
 * Final call to action: a deep-plum panel echoing the hero's orbit identity,
 * with the live work-plan scene tilting gently under the pointer.
 */
export function NotionFinalCta({ onPrimary, onSecondary }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
  }, []);

  const onLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }, []);

  return (
    <div className="cta-panel">
      {/* Identity backdrop */}
      <div className="cta-backdrop" aria-hidden>
        <div className="cta-grid" />
        <svg className="cta-orbit" viewBox="0 0 1000 1000" fill="none">
          <circle cx="500" cy="500" r="260" className="cta-orbit-ring" />
          <circle cx="500" cy="500" r="400" className="cta-orbit-ring" />
          <circle cx="500" cy="500" r="560" className="cta-orbit-ring cta-orbit-ring--faint" />
          <g className="cta-orbit-spin cta-orbit-spin--a">
            <circle cx="500" cy="240" r="6" className="cta-orbit-dot" />
          </g>
          <g className="cta-orbit-spin cta-orbit-spin--b">
            <circle cx="500" cy="100" r="5" className="cta-orbit-dot cta-orbit-dot--blue" />
          </g>
        </svg>
      </div>

      <div className="cta-inner">
        <div className="cta-copy">
          <div className="cta-mark">
            <Monogram size={22} variant="ink" />
          </div>
          <p className="cta-eyebrow">Start tonight</p>
          <h2 className="cta-title">
            Bring the first request.
            <br />
            <span className="cta-title-accent">Whitby drafts the plan tonight.</span>
          </h2>
          <p className="cta-lede">
            Describe it once. By morning there&rsquo;s a work plan with every step, its
            owner, and the one decision waiting for you.
          </p>

          <div className="cta-actions">
            <button type="button" onClick={onPrimary} className="cta-btn cta-btn--primary">
              <span>Get started</span>
              <IconArrow size={16} className="cta-btn-arrow" />
            </button>
            <button type="button" onClick={onSecondary} className="cta-btn cta-btn--ghost">
              Book a walkthrough
            </button>
          </div>

          <ul className="cta-trust">
            {TRUST.map((t) => (
              <li key={t}>
                <span className="cta-trust-check">
                  <IconCheck size={10} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div
          ref={cardRef}
          className="cta-stage"
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          <div className="cta-card">
            <PlanScene className="cta-scene" />
          </div>
        </div>
      </div>
    </div>
  );
}

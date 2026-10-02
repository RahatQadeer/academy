"use client";

import { useEffect, useState } from "react";
import type { OnboardingStep } from "../lib/steps";
import {
  CERTIFICATE_WALKTHROUGH,
  readDismissedTips,
  tipForStep,
  writeDismissedTips,
  type WalkthroughTip,
  type WalkthroughTipId,
} from "../lib/walkthrough";

export function CertificateWalkthrough({ step }: { step: OnboardingStep }) {
  const [dismissed, setDismissed] = useState<WalkthroughTipId[]>([]);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setDismissed(readDismissedTips());
    setMounted(true);
  }, []);

  const tip = mounted ? tipForStep(step, dismissed) : null;
  const tipIndex = tip
    ? CERTIFICATE_WALKTHROUGH.findIndex((item) => item.id === tip.id)
    : -1;

  useEffect(() => {
    if (!tip) {
      setVisible(false);
      return;
    }
    setVisible(false);
    const show = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(show);
  }, [tip]);

  function dismiss(id: WalkthroughTipId) {
    setVisible(false);
    window.setTimeout(() => {
      const next = Array.from(new Set([...dismissed, id]));
      setDismissed(next);
      writeDismissedTips(next);
    }, 160);
  }

  function dismissAll() {
    const all = CERTIFICATE_WALKTHROUGH.map((item) => item.id);
    setVisible(false);
    window.setTimeout(() => {
      setDismissed(all);
      writeDismissedTips(all);
    }, 160);
  }

  if (!tip) return null;

  return (
    <aside
      aria-live="polite"
      className="pointer-events-none fixed z-[80] bottom-6 left-4 right-4 sm:bottom-8 sm:left-auto sm:right-8 sm:w-[min(21rem,calc(100vw-3rem))] min-[1080px]:left-[calc(50%+20rem+2.25rem)] min-[1080px]:right-6 min-[1080px]:w-auto min-[1080px]:max-w-[21rem]"
    >
      <div
        className="pointer-events-auto mx-auto w-full max-w-[21rem] origin-bottom transition-[opacity,transform] duration-300 ease-out sm:mx-0 sm:origin-bottom-right"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.98)",
        }}
      >
        <WalkthroughCard
          tip={tip}
          index={tipIndex}
          total={CERTIFICATE_WALKTHROUGH.length}
          onDismiss={() => dismiss(tip.id)}
          onDismissAll={dismissAll}
        />
      </div>
    </aside>
  );
}

function WalkthroughCard({
  tip,
  index,
  total,
  onDismiss,
  onDismissAll,
}: {
  tip: WalkthroughTip;
  index: number;
  total: number;
  onDismiss: () => void;
  onDismissAll: () => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-[14px] border bg-surface"
      style={{
        borderColor: "var(--border)",
        boxShadow:
          "0 10px 28px rgba(15,15,15,.08), 0 1px 2px rgba(15,15,15,.04)",
      }}
    >
      <div
        className="flex items-center gap-2.5 border-b pl-5 pr-3.5 py-2.5"
        style={{
          borderColor: "var(--border)",
          background: "var(--accent-tint-soft)",
        }}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          aria-hidden
        >
          <CertificateIcon />
        </span>
        <p
          className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: "var(--accent)" }}
        >
          {tip.eyebrow}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss tip"
          className="shrink-0 rounded-[6px] p-1 transition-colors hover:bg-surface"
          style={{ color: "var(--text-tertiary)" }}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="pl-5 pr-3.5 py-3.5">
        <h2 className="text-[14px] font-semibold tracking-[-0.2px] text-pretty text-ink">
          {tip.title}
        </h2>
        <p
          className="mt-1.5 text-[12.5px] leading-[1.55] text-pretty"
          style={{ color: "var(--text-secondary)" }}
        >
          {tip.body}
        </p>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" aria-hidden>
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 14 : 6,
                  background: i === index ? "var(--accent)" : "var(--border-strong)",
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDismissAll}
              className="rounded-[6px] px-2 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--surface-soft)]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Skip tips
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)" }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CertificateIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8a2 2 0 0 1 2 2v9.5l-3.2-1.6L12 16l-2.8-2.1L6 15.5V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.5h6M9 11.5h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5 10.5 10.5M10.5 3.5 3.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

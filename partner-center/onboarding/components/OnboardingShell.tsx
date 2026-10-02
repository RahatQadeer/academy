"use client";

import { Logo, Wordmark } from "@/base/components/Logo";
import { ProgressBar } from "@/base/components/ProgressBar";
import type { WizardStep } from "@/partner-center/types/application";

const PROGRESS: Record<WizardStep, number> = { 1: 25, 2: 50, 3: 75, 4: 100 };

export function OnboardingShell({
  step,
  title,
  description,
  pending,
  onSaveAndExit,
  children,
}: {
  step: WizardStep;
  title: string;
  description?: string;
  pending: boolean;
  onSaveAndExit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header
        className="flex h-[72px] shrink-0 items-center justify-between bg-surface px-6 md:px-12"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <Wordmark size={14.5} />
          <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            / Partner Center
          </span>
        </div>
        <button
          type="button"
          onClick={onSaveAndExit}
          disabled={pending}
          className="text-[13px] disabled:opacity-60"
          style={{ color: "var(--text-tertiary)" }}
        >
          Save &amp; exit
        </button>
      </header>
      {/* min-h-full + justify-center keeps a short step vertically centred with no
          scrollbar; a taller step scrolls inside this region, header stays put. */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col justify-center px-6 py-10">
          <span
            className="text-[12.5px] font-semibold"
            style={{ color: "var(--text-tertiary)" }}
          >
            Step {step} of 4
          </span>
          <div className="mb-7 mt-2">
            <ProgressBar value={PROGRESS[step]} />
          </div>
          <h1 className="mb-1.5 text-[24px] font-bold tracking-[-0.4px]">{title}</h1>
          {description ? (
            <p
              className="mb-8 text-[14px] leading-[1.5]"
              style={{ color: "var(--text-secondary)" }}
            >
              {description}
            </p>
          ) : (
            <div className="mb-8" />
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

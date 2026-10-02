"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import {
  BackToChecklist,
  SetupCanvas,
} from "@/partner-center/onboarding/components/ChecklistNavBar";
import { SetupHeading } from "@/partner-center/onboarding/components/OnboardingChecklist";

export function ConfirmContinueScreen({
  title,
  description,
  onConfirm,
  nextFallback,
  callout,
  children,
  readOnly = false,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<{ error?: string; redirect?: string }>;
  nextFallback: string;
  callout?: React.ReactNode;
  children: React.ReactNode;
  /** Checklist "View" — show content only, no confirm mutation. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const result = await onConfirm();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.redirect || nextFallback);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SetupCanvas navRight={<BackToChecklist />}>
      <SetupHeading title={title} description={description} />
      <div
        className="overflow-hidden rounded-[10px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        {children}
      </div>
      {callout}
      <FormError message={error} />
      <div className="mt-6 flex items-center justify-between">
        <Button href={PARTNER_PATHS.checklist} variant="ghost">
          Back
        </Button>
        {readOnly ? (
          <Button href={PARTNER_PATHS.checklist} variant="primary">
            Back to checklist
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            onClick={() => void confirm()}
          >
            {pending ? "Saving…" : "Continue"}
          </Button>
        )}
      </div>
    </SetupCanvas>
  );
}

export function SetupListRow({
  mark,
  markClass,
  title,
  detail,
  status,
  last,
}: {
  mark: string;
  markClass: string;
  title: string;
  detail: string;
  status?: { label: string; tone: "success" | "neutral" };
  last?: boolean;
}) {
  const pill = status
    ? status.tone === "success"
      ? { bg: "var(--success-bg)", fg: "var(--success-fg)" }
      : { bg: "var(--surface-soft)", fg: "var(--text-secondary)" }
    : null;

  return (
    <div
      className="flex items-center gap-3.5 px-5 py-4"
      style={last ? undefined : { borderBottom: "1px solid var(--border)" }}
    >
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-semibold ${markClass}`}
      >
        {mark}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {detail}
        </div>
      </div>
      {status && pill ? (
        <span
          className="rounded px-[7px] py-[2px] text-[10.5px] font-medium"
          style={{ background: pill.bg, color: pill.fg }}
        >
          {status.label}
        </span>
      ) : null}
    </div>
  );
}

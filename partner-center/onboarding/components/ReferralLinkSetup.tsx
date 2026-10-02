"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { ensureChecklistReferralLink } from "@/partner-center/lib/checklist-actions";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import {
  BackToChecklist,
  SetupCanvas,
} from "@/partner-center/onboarding/components/ChecklistNavBar";
import { SetupHeading } from "@/partner-center/onboarding/components/OnboardingChecklist";

export function ReferralLinkSetup({
  companyName,
  initialUrl,
  loadError = null,
}: {
  companyName: string;
  initialUrl: string | null;
  /** Server create failed — offer retry. */
  loadError?: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(loadError);

  async function onRetry() {
    setPending(true);
    setError(null);
    setCopied(false);
    try {
      const result = await ensureChecklistReferralLink();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.url) {
        setError("Could not create referral link.");
        return;
      }
      setUrl(result.url);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create referral link.",
      );
    } finally {
      setPending(false);
    }
  }

  async function onCopy() {
    if (!url) return;
    setError(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      setError("Could not copy link. Select the URL and copy it manually.");
    }
  }

  return (
    <SetupCanvas navRight={<BackToChecklist />}>
      <SetupHeading
        title="Referral link"
        description={`Your shareable link for ${companyName}. After signup, people land on the product switcher and can open Academy or Whitby. The same link appears in Partner Center after setup.`}
      />

      {url ? (
        <div
          className="overflow-hidden rounded-[10px] bg-surface"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="px-5 py-4">
            <div
              className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.03em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Your referral link
            </div>
            <div
              className="break-all rounded-[8px] px-3 py-2.5 font-mono text-[13px]"
              style={{
                background: "var(--surface-soft)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {url}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-[10px] px-5 py-8 text-center text-[14px] bg-surface"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          Your referral link could not be created yet.
        </div>
      )}

      <FormError message={error} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button href={PARTNER_PATHS.checklist} variant="ghost">
          Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {url ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void onCopy()}
              >
                {copied ? "Copied!" : "Copy referral link"}
              </Button>
              <Button href={PARTNER_PATHS.checklist} variant="primary">
                Continue
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => void onRetry()}
            >
              {pending ? "Trying again…" : "Try again"}
            </Button>
          )}
        </div>
      </div>
    </SetupCanvas>
  );
}

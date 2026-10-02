"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Toggle } from "@/base/components/Toggle";
import { FormError } from "@/base/components/AuthControls";
import { PartnerUiProvider } from "@/partner-center/components/PartnerUiProvider";
import { acceptPartnerAgreement } from "@/partner-center/lib/review-actions";
import {
  AGREEMENT_EFFECTIVE,
  AGREEMENT_VERSION,
  PARTNER_PATHS,
} from "@/partner-center/lib/review-state";
import type { ProgramTermsSummary } from "@/partner-center/lib/program-terms";
import {
  BackToChecklist,
  ChecklistNavBar,
} from "@/partner-center/onboarding/components/ChecklistNavBar";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

export function AgreementReview({
  terms,
  mode = "sign",
}: {
  terms: ProgramTermsSummary;
  mode?: "sign" | "view";
}) {
  return (
    <PartnerUiProvider>
      <AgreementReviewContent terms={terms} mode={mode} />
    </PartnerUiProvider>
  );
}

function AgreementReviewContent({
  terms,
  mode = "sign",
}: {
  terms: ProgramTermsSummary;
  mode?: "sign" | "view";
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onContinue() {
    if (!agreed) {
      setError("Agree to the Partner Agreement and Program Terms to continue.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await runAction(() => acceptPartnerAgreement(), {
      onValidationError: setError,
      onRetry: () => void onContinue(),
    });
    setPending(false);
    if (result.error) return;
    router.push(result.redirect || "/partner-center/onboarding/agreement/signed");
  }

  const body = (
    <div className="flex min-h-0 flex-1 flex-col bg-surface lg:flex-row">
      <section className="min-h-0 flex-1 overflow-auto bg-surface px-6 py-10 text-left md:px-8 lg:px-10 lg:py-14">
        <p
          className="text-[12.5px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Partner Agreement
        </p>
        <h1 className="mt-2 w-full text-[24px] font-bold leading-[1.15] tracking-[-0.4px] text-pretty">
          Private Attaché Referral Partner Agreement
        </h1>
        <p
          className="mt-2 text-[13.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Version {AGREEMENT_VERSION} · Effective {AGREEMENT_EFFECTIVE}
        </p>
        <div
          className="mt-8 w-full rounded-[10px] px-5 py-5 text-[14px] leading-[1.65]"
          style={{
            background: "var(--surface-subtle)",
            border: "1px solid var(--border)",
            color: "var(--ink)",
          }}
        >
          <p className="mb-4">
            This Referral Partner Agreement (&quot;Agreement&quot;) is between Private
            Attaché, Inc. (&quot;Company&quot;) and the undersigned partner
            (&quot;Partner&quot;).
          </p>
          <p className="mb-4">
            <span className="font-semibold">1. Referral Terms.</span> Partner may
            refer prospective customers to Company. Compensation is determined solely
            by the Program Terms in effect for each referred product.
          </p>
          <p className="mb-4">
            <span className="font-semibold">2. Attribution.</span> Referrals are
            tracked through Partner&apos;s unique links, codes, and cookies. The
            attribution window stated in the Program Terms governs whether a later
            conversion is credited to Partner.
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            …continues for 4 additional sections, available in full below.
          </p>
        </div>
      </section>

      <aside className="flex w-full shrink-0 flex-col bg-canvas px-6 py-10 md:px-8 lg:h-full lg:w-[min(32vw,420px)] lg:overflow-auto lg:border-l lg:border-line lg:px-10 lg:py-14">
        <h2 className="text-[16px] font-semibold tracking-[-0.2px]">
          Program terms summary
        </h2>
        <dl className="mt-6 space-y-4 text-[13.5px]">
          <TermRow label="Academy commission" value={terms.academy} />
          <TermRow label="Whitby commission" value={terms.platform} />
          <TermRow label="Enterprise" value={terms.enterprise} />
          <TermRow label="Attribution window" value={terms.attribution} />
          <TermRow label="Payment terms" value={terms.payment} />
        </dl>
        {mode === "view" ? (
          <div className="mt-10">
            <Button href={PARTNER_PATHS.checklist} variant="primary" fullWidth>
              Back to checklist
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-10 flex items-start gap-3">
              <div className="shrink-0">
                <Toggle
                  id="partner-agreement"
                  checked={agreed}
                  onChange={setAgreed}
                />
              </div>
              <label
                htmlFor="partner-agreement"
                className="min-w-0 flex-1 cursor-pointer select-none text-[13px] leading-[1.45]"
                style={{ color: "var(--text-secondary)" }}
              >
                I have read and agree to the Partner Agreement and Program Terms above.
              </label>
            </div>
            <FormError message={error} />
            <div className="mt-6">
              <Button
                type="button"
                variant="primary"
                fullWidth
                disabled={!agreed || pending}
                onClick={() => void onContinue()}
              >
                {pending ? "Saving…" : "Continue"}
              </Button>
              <p
                className="mt-3 text-center text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                You&apos;ll be redirected to complete signature.
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      {mode === "view" ? <ChecklistNavBar right={<BackToChecklist />} /> : null}
      {body}
    </div>
  );
}

function TermRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt style={{ color: "var(--text-secondary)" }}>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

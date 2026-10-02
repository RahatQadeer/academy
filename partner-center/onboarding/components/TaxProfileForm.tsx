"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { ChoiceChip } from "@/partner-center/components/ChoiceChip";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { saveTaxProfile } from "@/partner-center/lib/checklist-actions";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import {
  BackToChecklist,
  SetupCanvas,
} from "@/partner-center/onboarding/components/ChecklistNavBar";
import { SetupHeading } from "@/partner-center/onboarding/components/OnboardingChecklist";
import { StripeIcon } from "@/partner-center/onboarding/components/StripeIcon";

const readOnlyClass =
  "bg-[#f7f7f5] text-ink cursor-default focus:outline-none focus:ring-0";

function TaxFields({
  us,
  setUs,
  payee,
  setPayee,
  classification,
  setClassification,
  readOnly,
}: {
  us: boolean;
  setUs: (value: boolean) => void;
  payee: string;
  setPayee: (value: string) => void;
  classification: string;
  setClassification: (value: string) => void;
  readOnly: boolean;
}) {
  return (
    <div
      className="rounded-[10px] bg-surface p-6"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="space-y-[18px]">
        <div>
          <span
            className="mb-2 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Are you a U.S. person or entity?
          </span>
          <div className="flex gap-2.5">
            <ChoiceChip
              selected={us}
              disabled={readOnly}
              onClick={() => {
                if (!readOnly) setUs(true);
              }}
            >
              Yes — W-9
            </ChoiceChip>
            <ChoiceChip
              selected={!us}
              disabled={readOnly}
              onClick={() => {
                if (!readOnly) setUs(false);
              }}
            >
              No — W-8
            </ChoiceChip>
          </div>
        </div>
        <Input
          label="Legal payee name"
          name="legal_payee_name"
          value={payee}
          onChange={(event) => setPayee(event.target.value)}
          required
          readOnly={readOnly}
          className={readOnly ? readOnlyClass : undefined}
        />
        <Input
          label="Entity / tax classification"
          name="entity_classification"
          value={classification}
          onChange={(event) => setClassification(event.target.value)}
          readOnly={readOnly}
          className={readOnly ? readOnlyClass : undefined}
        />
        <div
          className="flex items-center gap-3 rounded-[10px] px-4 py-3.5"
          style={{ background: "var(--surface-soft)" }}
        >
          <StripeIcon size={32} />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold leading-tight">
              Taxpayer ID collected by Stripe
            </div>
            <p
              className="mt-1 text-[12.5px] leading-[1.5]"
              style={{ color: "var(--text-secondary)" }}
            >
              {readOnly
                ? "Your taxpayer ID is collected on Stripe\u2019s secure form. Private Attaché only ever sees the last 4 digits and your submission status."
                : "You\u2019ll enter your SSN or EIN on Stripe\u2019s secure form next. Private Attaché only ever sees the last 4 digits and your submission status."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaxProfileForm({
  usPerson,
  legalPayeeName,
  entityClassification,
  variant = "checklist",
  backHref,
  successRedirect,
  submitLabel,
  readOnly = false,
}: {
  usPerson: boolean;
  legalPayeeName: string;
  entityClassification: string;
  variant?: "checklist" | "app";
  backHref?: string;
  successRedirect?: string;
  submitLabel?: string;
  /** Checklist "View" — fields are not editable. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [us, setUs] = useState(usPerson);
  const [payee, setPayee] = useState(legalPayeeName);
  const [classification, setClassification] = useState(entityClassification);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resolvedBack =
    backHref ||
    (variant === "app" ? PARTNER_PATHS.app : PARTNER_PATHS.checklist);
  const resolvedSubmit =
    submitLabel ||
    (variant === "app" ? "Save tax profile" : "Continue to Stripe");

  async function onContinue() {
    setPending(true);
    setError(null);
    try {
      const result = await saveTaxProfile({
        us_person: us,
        legal_payee_name: payee,
        entity_classification: classification,
        redirect_to:
          successRedirect ||
          (variant === "app" ? PARTNER_PATHS.app : undefined),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(
        result.redirect ||
          successRedirect ||
          (variant === "app" ? PARTNER_PATHS.app : PARTNER_PATHS.payoutStripe),
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save tax profile.",
      );
    } finally {
      setPending(false);
    }
  }

  const actions = (
    <>
      <FormError message={error} />
      <div className="mt-6 flex items-center justify-between">
        <Button href={resolvedBack} variant="ghost">
          Back
        </Button>
        {readOnly ? (
          <Button href={resolvedBack} variant="primary">
            Back to checklist
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            onClick={() => void onContinue()}
          >
            {pending ? "Saving…" : resolvedSubmit}
          </Button>
        )}
      </div>
    </>
  );

  const fields = (
    <TaxFields
      us={us}
      setUs={setUs}
      payee={payee}
      setPayee={setPayee}
      classification={classification}
      setClassification={setClassification}
      readOnly={readOnly}
    />
  );

  if (variant === "app") {
    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
        <PartnerChrome
          title="Tax profile"
          subtitle="Required before commissions can be paid out. Your tax details are collected and stored by our payment partner, not by Private Attaché."
        />
        {fields}
        {actions}
      </div>
    );
  }

  return (
    <SetupCanvas navRight={<BackToChecklist />}>
      <SetupHeading
        title="Tax profile"
        description="Required before commissions can be paid out. Your tax details are collected and stored by our payment partner, not by Private Attaché."
      />
      {fields}
      {actions}
    </SetupCanvas>
  );
}

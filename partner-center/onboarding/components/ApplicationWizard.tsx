"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import {
  saveApplicationDraft,
  submitApplication,
} from "@/partner-center/lib/application-actions";
import {
  errorsForStep,
  validateStep,
} from "@/partner-center/lib/application-map";
import { OnboardingShell } from "@/partner-center/onboarding/components/OnboardingShell";
import { StepAboutBusiness } from "@/partner-center/onboarding/components/StepAboutBusiness";
import { StepContactMarket } from "@/partner-center/onboarding/components/StepContactMarket";
import { StepReferralProducts } from "@/partner-center/onboarding/components/StepReferralProducts";
import { StepReviewSubmit } from "@/partner-center/onboarding/components/StepReviewSubmit";
import { useApplicationDraft } from "@/partner-center/onboarding/hooks/useApplicationDraft";
import type { ApplicationData, WizardStep } from "@/partner-center/types/application";

const COPY: Record<WizardStep, { title: string; description: string }> = {
  1: {
    title: "About your business",
    description: "Tell us who's applying so we can set up your Partner Center.",
  },
  2: {
    title: "Contact & market",
    description: "Who should we reach, and where do you operate?",
  },
  3: {
    title: "Referral approach",
    description: "Help us understand how and what you plan to refer.",
  },
  4: {
    title: "Review & submit",
    description: "Make sure everything looks right before you submit.",
  },
};

export function ApplicationWizard({
  initial,
  accountEmail,
}: {
  initial: ApplicationData;
  accountEmail: string;
}) {
  const lockedEmail = accountEmail.trim();
  const { data, error, pending, setError, setPending, patch, goTo } =
    useApplicationDraft({ ...initial, email: lockedEmail || initial.email });
  const step = data.current_step;
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const stepErrors = errorsForStep(step, data);

  function fieldError(field: string): string | null {
    if (!(attempted || touched[field])) return null;
    return stepErrors[field] ?? null;
  }

  function onBlurField(field: string) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function resetFieldFeedback() {
    setAttempted(false);
    setTouched({});
  }

  function patchSafe(partial: Partial<ApplicationData>) {
    const { email: _ignored, ...rest } = partial;
    patch({ ...rest, email: lockedEmail || data.email });
  }

  async function persist(next: ApplicationData, submitted: boolean) {
    const payload = { ...next, email: lockedEmail || next.email };
    return submitted ? submitApplication(payload) : saveApplicationDraft(payload);
  }

  async function onContinue() {
    const invalid = validateStep(step, data);
    if (invalid) {
      setAttempted(true);
      setError(invalid);
      return;
    }

    const nextStep = (step < 4 ? ((step + 1) as WizardStep) : step);
    const payload = { ...data, current_step: nextStep };
    setPending(true);
    const result = await persist(payload, false);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetFieldFeedback();
    goTo(nextStep);
    patch({ current_step: nextStep });
  }

  async function onBack() {
    if (step === 1) return;
    resetFieldFeedback();
    goTo((step - 1) as WizardStep);
  }

  async function onSaveAndExit() {
    setPending(true);
    const result = await persist(data, false);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    window.location.href = "/switcher";
  }

  async function onSubmit() {
    const invalid = validateStep(step, data);
    if (invalid) {
      setAttempted(true);
      setError(invalid);
      return;
    }
    setPending(true);
    const result = await persist({ ...data, current_step: 4 }, true);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    window.location.href = "/partner-center/onboarding/submitted";
  }

  const fieldProps = { fieldError, onBlurField };

  return (
    <OnboardingShell
      step={step}
      title={COPY[step].title}
      description={COPY[step].description}
      pending={pending}
      onSaveAndExit={onSaveAndExit}
    >
      {/* The wizard uses sentence-case field labels, while the shared Input and
          Textarea render them uppercase for the rest of the platform. */}
      <div
        className="rounded-card bg-surface p-8"
        style={{ border: "1px solid var(--border)" }}
      >
        {step === 1 ? (
          <StepAboutBusiness data={data} onChange={patchSafe} {...fieldProps} />
        ) : null}
        {step === 2 ? (
          <StepContactMarket
            data={data}
            onChange={patchSafe}
            accountEmail={lockedEmail || data.email}
            {...fieldProps}
          />
        ) : null}
        {step === 3 ? (
          <StepReferralProducts data={data} onChange={patchSafe} {...fieldProps} />
        ) : null}
        {step === 4 ? (
          <StepReviewSubmit data={data} onChange={patchSafe} {...fieldProps} />
        ) : null}
      </div>
      <FormError message={error} />
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={pending || step === 1}
          className="text-[14px] disabled:opacity-40"
          style={{ color: "var(--text-secondary)" }}
        >
          Back
        </button>
        {step < 4 ? (
          <Button variant="primary" onClick={onContinue} disabled={pending}>
            {pending ? "Saving…" : "Continue"}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={pending || !data.terms_accepted}
          >
            {pending ? "Submitting…" : "Submit application"}
          </Button>
        )}
      </div>
    </OnboardingShell>
  );
}

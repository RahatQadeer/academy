"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CertificateWalkthrough } from "./components/CertificateWalkthrough";
import { OnboardingHeader } from "./components/OnboardingHeader";
import { OnboardingProgress } from "./components/OnboardingProgress";
import { Step1Identity } from "./steps/Step1Identity";
import { Step2Interests } from "./steps/Step2Interests";
import { Step3Ready } from "./steps/Step3Ready";
import { completeAcademyOnboardingAction } from "./actions";
import {
  clearOnboardingComplete,
  isOnboardingComplete,
  markOnboardingComplete,
  readOnboardingState,
  writeOnboardingState,
} from "./lib/state";
import type { AcademyInterestId } from "./lib/interests";
import { isOnboardingStep, ONBOARDING_STEPS, type OnboardingStep } from "./lib/steps";

export function OnboardingFlow({
  stepParam,
  userId,
  fullName,
  email,
}: {
  stepParam?: string;
  userId: string;
  fullName: string;
  email: string;
}) {
  const router = useRouter();
  const step: OnboardingStep = isOnboardingStep(stepParam) ? stepParam : "account";
  const [interestIds, setInterestIds] = useState<AcademyInterestId[]>([]);
  const [ready, setReady] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const state = readOnboardingState(userId);
    if (userId && isOnboardingComplete(userId)) {
      setCompleting(true);
      void completeAcademyOnboardingAction(state.interestIds).then((result) => {
        if (result.ok) {
          window.location.replace("/academy");
          return;
        }
        clearOnboardingComplete(userId);
        setInterestIds(state.interestIds);
        setCompleteError("We couldn’t finish setup. Try again.");
        setCompleting(false);
        setReady(true);
      });
      return;
    }
    setInterestIds(state.interestIds);
    setReady(true);
  }, [userId]);

  useEffect(() => {
    if (!ready || !userId) return;
    const current = readOnboardingState(userId);
    writeOnboardingState({
      userId,
      completed: current.completed,
      interestIds,
    });
  }, [interestIds, ready, userId]);

  const stepIndex = ONBOARDING_STEPS.indexOf(step) + 1;
  const firstName = useMemo(() => fullName.trim().split(/\s+/)[0] ?? "", [fullName]);

  function go(next: OnboardingStep) {
    router.push(`/academy/onboarding/${next}`);
  }

  function toggleInterest(id: AcademyInterestId) {
    setInterestIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function complete() {
    if (!userId) {
      window.location.replace("/academy");
      return;
    }
    setCompleteError(null);
    setCompleting(true);
    void completeAcademyOnboardingAction(interestIds).then((result) => {
      if (result.ok) {
        markOnboardingComplete(userId, interestIds);
        window.location.replace("/academy");
        return;
      }
      setCompleting(false);
      setCompleteError("We couldn’t finish setup. Check your connection and try again.");
    });
  }

  if (!ready) {
    return <div className="min-h-[100dvh] bg-canvas" />;
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(70% 48% at 0% 0%, color-mix(in srgb, var(--accent-tint) 85%, transparent) 0%, transparent 56%),
            radial-gradient(50% 36% at 100% 8%, color-mix(in srgb, var(--accent-tint) 55%, transparent) 0%, transparent 48%),
            linear-gradient(180deg, #f6f8f6 0%, var(--canvas, #f1f1ef) 44%, #eef1ef 100%)
          `,
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[640px] flex-1 flex-col px-5 py-5 sm:px-7 sm:py-7">
        <OnboardingHeader />
        <OnboardingProgress step={stepIndex} />

        <main
          className="flex flex-col rounded-[18px] bg-surface px-5 py-5 sm:px-7 sm:py-6"
          style={{
            border: "1px solid var(--border)",
            boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 16px 36px rgba(28,122,82,.05)",
          }}
        >
          {completeError ? (
            <p
              className="mb-4 rounded-[10px] border px-3.5 py-2.5 text-[13.5px]"
              style={{
                background: "var(--warning-bg)",
                borderColor: "var(--warning-border, #f2e2ca)",
                color: "var(--warning-fg, #7a5a2e)",
              }}
            >
              {completeError}
            </p>
          ) : null}

          <div className="flex flex-col">
            {step === "account" ? (
              <Step1Identity
                fullName={fullName}
                email={email}
                onContinue={() => go("interests")}
              />
            ) : null}
            {step === "interests" ? (
              <Step2Interests
                selected={interestIds}
                onToggle={toggleInterest}
                onContinue={() => go("ready")}
                onSkip={() => go("ready")}
              />
            ) : null}
            {step === "ready" ? (
              <Step3Ready
                firstName={firstName}
                onComplete={completing ? () => undefined : complete}
              />
            ) : null}
          </div>
        </main>

        <p
          className="mt-4 text-center text-[11.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Learner setup · Certificates stay with your account
        </p>
      </div>

      <CertificateWalkthrough step={step} />
    </div>
  );
}

import type { OnboardingStep } from "./steps";

export type WalkthroughTipId =
  | "certificates_home"
  | "certificate_kinds"
  | "find_awards";

export type WalkthroughTip = {
  id: WalkthroughTipId;
  step: OnboardingStep;
  eyebrow: string;
  title: string;
  body: string;
};

/** Three short certificate-focused tips shown during onboarding (Stripe-style). */
export const CERTIFICATE_WALKTHROUGH: WalkthroughTip[] = [
  {
    id: "certificates_home",
    step: "account",
    eyebrow: "Certificates",
    title: "Everything you earn, in one place",
    body: "When you finish a program, your award appears under Certificates & Credentials — ready to share or verify.",
  },
  {
    id: "certificate_kinds",
    step: "interests",
    eyebrow: "Three award types",
    title: "Completion, endorsement, or credential",
    body: "Certificate of Completion for courses, Specialty Endorsement for focused skills, and Professional Credential for Certified Private Attaché.",
  },
  {
    id: "find_awards",
    step: "ready",
    eyebrow: "After setup",
    title: "Open Certificates anytime",
    body: "Once you’re in Academy, open Certificates & Credentials in the left nav to view awards, check status, and share a verification link.",
  },
];

const DISMISS_KEY = "pa.academy.onboarding.walkthrough.dismissed.v1";

export function readDismissedTips(): WalkthroughTipId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is WalkthroughTipId =>
      CERTIFICATE_WALKTHROUGH.some((tip) => tip.id === id),
    );
  } catch {
    return [];
  }
}

export function writeDismissedTips(ids: WalkthroughTipId[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore quota / private mode.
  }
}

export function tipForStep(
  step: OnboardingStep,
  dismissed: WalkthroughTipId[],
): WalkthroughTip | null {
  const tip = CERTIFICATE_WALKTHROUGH.find((item) => item.step === step);
  if (!tip || dismissed.includes(tip.id)) return null;
  return tip;
}

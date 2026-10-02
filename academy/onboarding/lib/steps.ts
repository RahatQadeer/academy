export const ONBOARDING_STEPS = ["account", "interests", "ready"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingStep(value: string | undefined): value is OnboardingStep {
  return ONBOARDING_STEPS.includes(value as OnboardingStep);
}

import { redirect } from "next/navigation";
import { getSessionProfile } from "@/base/identity/session";
import { OnboardingFlow } from "./OnboardingFlow";
import { isOnboardingStep } from "./lib/steps";
import { hasFinishedAcademyOnboarding } from "./services/loadOnboardingCompletion";

export default async function AcademyOnboardingPage({
  segments,
}: {
  segments: string[];
}) {
  const stepParam = segments[1];
  if (!isOnboardingStep(stepParam)) {
    redirect("/academy/onboarding/account");
  }

  const profile = await getSessionProfile();
  const user = profile?.user;

  if (user?.id && (await hasFinishedAcademyOnboarding(user.id))) {
    redirect("/academy");
  }

  return (
    <OnboardingFlow
      stepParam={stepParam}
      userId={user?.id ?? ""}
      fullName={user?.preferred_name || user?.full_name || ""}
      email={user?.email ?? ""}
    />
  );
}

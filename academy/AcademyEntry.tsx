import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { hasFinishedAcademyOnboarding } from "./onboarding/services/loadOnboardingCompletion";

export async function AcademyEntry({
  userId,
  preview,
  children,
}: {
  userId: string;
  preview: boolean;
  children: ReactNode;
}) {
  if (preview || !userId) return children;
  if (!(await hasFinishedAcademyOnboarding(userId))) {
    redirect("/academy/onboarding/account");
  }
  return children;
}

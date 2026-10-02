import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { LearnerDashboard } from "./dashboard/page";
import { DashboardSkeleton } from "./dashboard/components/DashboardSkeleton";
import { hasFinishedAcademyOnboarding } from "./onboarding/services/loadOnboardingCompletion";

export default async function AcademyPage() {
  const configured = isSupabaseConfigured();
  const profile = configured ? await getSessionProfile() : null;
  const userId = profile?.user.id ?? "";
  const displayName = profile?.user.preferred_name || profile?.user.full_name || "";

  // Redirect before any Suspense child starts. A redirect thrown while the
  // dashboard is already suspended crashes Next's App Router hook list.
  if (configured && userId && !(await hasFinishedAcademyOnboarding(userId))) {
    redirect("/academy/onboarding/account");
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <LearnerDashboard userId={userId} displayName={displayName} />
    </Suspense>
  );
}

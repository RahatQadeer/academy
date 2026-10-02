import { ErrorState, PageShell } from "@/academy/components/ui";
import { loadLearnerInterestIds } from "@/academy/onboarding/services/loadOnboardingCompletion";
import type { AcademyInterestId } from "@/academy/onboarding/lib/interests";
import { ContinueLearning } from "./components/ContinueLearning";
import { DashboardHeader } from "./components/DashboardHeader";
import { ProgressStats } from "./components/ProgressStats";
import { RecommendedForYou } from "./components/RecommendedForYou";
import { loadLearnerDashboard } from "./services/loadDashboard";
import type { LearnerDashboardData } from "./types";

export async function LearnerDashboard({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const empty: LearnerDashboardData = {
    continueLearning: [],
    recommended: [],
    stats: {
      coursesEnrolled: 0,
      coursesCompleted: 0,
      coursesInProgress: 0,
      lessonsCompleted: 0,
      programsInProgress: 0,
      certificatesEarned: 0,
      credentialsAwarded: 0,
    },
  };
  const interestIds = userId ? await loadLearnerInterestIds(userId) : ([] as AcademyInterestId[]);
  const result = userId
    ? await loadLearnerDashboard(userId, interestIds)
    : { ok: true as const, data: empty };

  if (!result.ok) {
    return (
      <PageShell>
        <DashboardHeader displayName={displayName} />
        <ErrorState title="Dashboard unavailable" body="Your learning data could not be loaded. Nothing has changed — try again." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <DashboardHeader displayName={displayName} />
      <div className="space-y-7">
        <ProgressStats stats={result.data.stats} />
        <ContinueLearning items={result.data.continueLearning} />
        <RecommendedForYou interestIds={interestIds} items={result.data.recommended} />
      </div>
    </PageShell>
  );
}

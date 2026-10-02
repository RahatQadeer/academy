import { Suspense } from "react";
import { getSessionProfile } from "@/base/identity/session";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AssignedPrograms } from "./components/AssignedPrograms";
import { InstructorEmptyState } from "./components/InstructorEmptyState";
import { InstructorDashboardHeader } from "./components/InstructorHeader";
import { InstructorSkeleton } from "./components/InstructorSkeleton";
import { InstructorStats } from "./components/InstructorStats";
import { loadInstructorDashboard } from "./services/loadInstructorDashboard";

async function InstructorDashboardBody({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const result = await loadInstructorDashboard(userId);

  if (!result.ok) {
    return (
      <PageShell>
        <InstructorDashboardHeader displayName={displayName} />
        <ErrorState
          title="Instructor dashboard unavailable"
          body="Your assigned programs could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  const { programs, attention, stats, truncated } = result.data;

  return (
    <PageShell>
      <InstructorDashboardHeader displayName={displayName} />
      <div className="space-y-6">
        <InstructorStats stats={stats} />

        {attention.length > 0 ? (
          <AssignedPrograms
            headingId="instructor-attention-heading"
            title="Needs attention"
            description="Returned drafts or programs waiting on a publish request."
            programs={attention}
          />
        ) : null}

        {programs.length === 0 ? (
          <InstructorEmptyState />
        ) : (
          <div>
            <AssignedPrograms
              headingId="instructor-programs-heading"
              title="Assigned programs"
              programs={programs}
            />
            {truncated ? (
              <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                Showing the first 48 assigned programs.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </PageShell>
  );
}

export async function InstructorDashboardPage({ userId }: { userId: string }) {
  const profile = userId ? await getSessionProfile() : null;
  const displayName =
    profile?.user.id === userId
      ? profile.user.preferred_name || profile.user.full_name || ""
      : "";

  return (
    <Suspense fallback={<InstructorSkeleton />}>
      <InstructorDashboardBody userId={userId} displayName={displayName} />
    </Suspense>
  );
}

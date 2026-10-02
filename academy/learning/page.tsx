import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { LearningEmptyState } from "./components/LearningEmptyState";
import { LearningList } from "./components/LearningList";
import { LearningSkeleton } from "./components/LearningSkeleton";
import { MyLearningHeader } from "./components/MyLearningHeader";
import { loadMyLearning } from "./services/loadMyLearning";

async function MyLearningBody({ userId }: { userId: string }) {
  const result = await loadMyLearning(userId);

  if (!result.ok) {
    return (
      <PageShell>
        <MyLearningHeader />
        <ErrorState
          title="My Learning unavailable"
          body="Your enrollments could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <MyLearningHeader />
      {result.data.items.length === 0 ? (
        <LearningEmptyState />
      ) : (
        <>
          <LearningList items={result.data.items} />
          {result.data.truncated ? (
            <p className="mt-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Showing the first 48 enrollments.
            </p>
          ) : null}
        </>
      )}
    </PageShell>
  );
}

export function MyLearningPage({
  userId,
  preview,
}: {
  userId: string;
  preview: boolean;
}) {
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <Suspense fallback={<LearningSkeleton />}>
        <MyLearningBody userId={userId} />
      </Suspense>
    </AcademyEntry>
  );
}

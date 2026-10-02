import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { ExploreHeader } from "./components/ExploreHeader";
import { ExploreSkeleton } from "./components/ExploreSkeleton";
import { ExploreWorkbench } from "./components/ExploreWorkbench";
import { loadExploreCatalog } from "./services/loadExploreCatalog";
import { loadLearnerInterestIds } from "@/academy/onboarding/services/loadOnboardingCompletion";
import type { ExploreCatalogQuery } from "./types";
import { parseExploreQuery } from "./utils/query";

async function ExploreCatalog({
  userId,
  query,
}: {
  userId: string;
  query: ExploreCatalogQuery;
}) {
  const [result, interestIds] = await Promise.all([
    loadExploreCatalog(userId, query),
    loadLearnerInterestIds(userId),
  ]);

  if (!result.ok) {
    return (
      <PageShell variant="wide">
        <ExploreHeader />
        <ErrorState
          title="Catalog unavailable"
          body="Published programs could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  return (
    <PageShell variant="wide">
      <ExploreWorkbench data={result.data} interestIds={interestIds} />
    </PageShell>
  );
}

export function ExplorePage({
  userId,
  preview,
  searchParams,
}: {
  userId: string;
  preview: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = parseExploreQuery(searchParams);
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <Suspense fallback={<ExploreSkeleton />}>
        <ExploreCatalog userId={userId} query={query} />
      </Suspense>
    </AcademyEntry>
  );
}

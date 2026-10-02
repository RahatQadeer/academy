import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { ResourceEmptyState } from "./components/ResourceEmptyState";
import { ResourceList } from "./components/ResourceList";
import { ResourceProgramSelect } from "./components/ResourceProgramSelect";
import { ResourceSection } from "./components/ResourceSection";
import { ResourceSkeleton } from "./components/ResourceSkeleton";
import { ResourceToolbar } from "./components/ResourceToolbar";
import { ResourcesHeader } from "./components/ResourcesHeader";
import { loadResources } from "./services/loadResources";
import { parseResourcesQuery } from "./utils/query";

async function ResourcesBody({
  userId,
  searchParams,
}: {
  userId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = parseResourcesQuery(searchParams);
  const result = await loadResources(userId, query);

  if (!result.ok) {
    return (
      <PageShell>
        <ResourcesHeader />
        <ErrorState
          title="Resources unavailable"
          body="Resources could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  const {
    enrolledPrograms,
    selectedProgramId,
    selectedProgramName,
    truncatedEnrollments,
    resources,
    resourceTypes,
  } = result.data;
  const hasEnrollments = enrolledPrograms.length > 0;
  const hasFilters = Boolean(query.search.trim() || query.type);

  return (
    <PageShell>
      <ResourcesHeader
        resourceCount={hasEnrollments ? resources.length : undefined}
        programName={selectedProgramName}
      />

      <div className="space-y-6">
        <ResourceSection
          title="Course library"
          description="Downloadable files for one enrolled program. Choose the program on the right, then open templates, guides, and reference links from the list below."
          action={
            hasEnrollments ? (
              <ResourceProgramSelect
                programs={enrolledPrograms}
                selectedProgramId={selectedProgramId}
              />
            ) : null
          }
        >
          {hasEnrollments ? (
            <div className="space-y-4">
              <ResourceToolbar
                query={query}
                resourceTypes={resourceTypes}
                resultCount={resources.length}
              />
              {resources.length > 0 ? (
                <ResourceList items={resources} />
              ) : (
                <ResourceEmptyState
                  kind={hasFilters ? "no_matches" : "no_course_resources"}
                />
              )}
            </div>
          ) : (
            <ResourceEmptyState kind="no_enrollments" />
          )}
          {truncatedEnrollments ? (
            <p
              className="mt-3 text-[12.5px] leading-relaxed"
              style={{ color: "var(--text-tertiary)" }}
            >
              Showing the first 48 enrolled programs in the selector.
            </p>
          ) : null}
        </ResourceSection>

        <ResourceSection
          title="Academy-wide library"
          description="Shared files for every learner — not tied to a single enrollment. Course lessons and assessments are never listed here."
        >
          <ResourceEmptyState kind="no_general_resources" />
        </ResourceSection>
      </div>
    </PageShell>
  );
}

export function ResourcesPage({
  userId,
  preview,
  searchParams,
}: {
  userId: string;
  preview: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <Suspense fallback={<ResourceSkeleton />}>
        <ResourcesBody userId={userId} searchParams={searchParams} />
      </Suspense>
    </AcademyEntry>
  );
}

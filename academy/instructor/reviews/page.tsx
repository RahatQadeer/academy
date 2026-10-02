import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { InstructorHeader } from "@/academy/instructor/components/InstructorHeader";
import { ReviewFilters } from "./components/ReviewFilters";
import { ReviewQueue } from "./components/ReviewQueue";
import { ReviewStatusTabs } from "./components/ReviewStatusTabs";
import { ReviewsSkeleton } from "./components/ReviewsSkeleton";
import { loadInstructorReviewQueue } from "./services/loadReviewQueue";
import { queueCopy } from "./utils/href";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

async function ReviewsBody({
  userId,
  searchParams,
}: {
  userId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const programId = firstValue(searchParams.programId);
  const assignmentId = firstValue(searchParams.assignmentId);
  const learner = firstValue(searchParams.learner);
  const result = await loadInstructorReviewQueue({
    userId,
    status: firstValue(searchParams.status),
    programId,
    assignmentId,
    learner,
  });

  if (!result.ok) {
    return (
      <PageShell>
        <InstructorHeader
          title="Assignment reviews"
          description="Grade learner assignments, request revisions with comments, and keep certificates on track."
        />
        <ErrorState
          title="Reviews unavailable"
          body="Pending submissions could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  const { items, pendingCount, counts, filters, truncated, activeStatus } = result.data;
  const filtered = Boolean(programId || assignmentId || learner);

  return (
    <PageShell>
      <InstructorHeader
        title="Assignment reviews"
        description="Grade learner work so certificates can be issued once every required assignment is reviewed."
        actions={
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-semibold tabular-nums"
            style={
              pendingCount > 0
                ? { background: "var(--warning-bg)", color: "var(--warning-fg)" }
                : { background: "var(--surface-soft)", color: "var(--text-secondary)" }
            }
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: pendingCount > 0 ? "currentColor" : "var(--text-tertiary)" }}
              aria-hidden
            />
            {pendingCount > 0 ? `${pendingCount} notifications` : "No notifications"}
          </span>
        }
      />

      <section
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[16px] font-semibold tracking-[-0.2px]">Review queue</h2>
              <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {queueCopy(activeStatus)}
              </p>
            </div>
            {items.length <= 10 ? (
              <p className="shrink-0 text-[12.5px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                {items.length.toLocaleString()} shown
              </p>
            ) : null}
          </div>
          <div className="mt-4">
            <ReviewStatusTabs
              active={activeStatus}
              counts={counts}
              programId={programId || undefined}
              assignmentId={assignmentId || undefined}
              learner={learner || undefined}
            />
          </div>
        </div>

        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
          <ReviewFilters filters={filters} searchParams={searchParams} />
        </div>

        <ReviewQueue
          items={items}
          status={activeStatus}
          hasPrograms={filters.programs.length > 0}
          filtered={filtered}
        />

        {truncated ? (
          <p className="border-t px-5 py-3 text-[12.5px] sm:px-6" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
            Showing the first 80 submissions. Narrow the filters to find a specific learner.
          </p>
        ) : null}
      </section>
    </PageShell>
  );
}

export function InstructorReviewsPage({
  userId,
  searchParams,
}: {
  userId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<ReviewsSkeleton />}>
      <ReviewsBody userId={userId} searchParams={searchParams} />
    </Suspense>
  );
}

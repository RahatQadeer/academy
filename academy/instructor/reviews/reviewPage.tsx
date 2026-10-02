import { Suspense } from "react";
import Link from "next/link";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { ReviewDetail } from "./components/ReviewDetail";
import { ReviewsSkeleton } from "./components/ReviewsSkeleton";
import { loadInstructorReviewDetail } from "./services/loadReviewDetail";

async function ReviewDetailBody({ submissionId }: { submissionId: string }) {
  const result = await loadInstructorReviewDetail(submissionId);

  if (!result.ok) {
    return (
      <PageShell>
        <ErrorState
          title={result.reason === "unauthorized" ? "Not authorized" : "Submission unavailable"}
          body={
            result.reason === "unauthorized"
              ? "You can only review assignments in programs you are assigned to."
              : "This submission could not be opened."
          }
        />
        <p className="mt-4">
          <Link
            href="/academy/instructor/reviews"
            className="text-[13.5px] no-underline"
            style={{ color: "var(--accent)" }}
          >
            Back to reviews
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ReviewDetail detail={result.data} />
    </PageShell>
  );
}

export function InstructorReviewDetailPage({ submissionId }: { submissionId: string }) {
  return (
    <Suspense fallback={<ReviewsSkeleton />}>
      <ReviewDetailBody submissionId={submissionId} />
    </Suspense>
  );
}

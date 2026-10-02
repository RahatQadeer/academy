import Link from "next/link";
import { Suspense } from "react";
import { Callout } from "@/base/components/Callout";
import { ApprovalSequence } from "./components/ApprovalSequence";
import { ApprovalSkeleton } from "./components/ApprovalSkeleton";
import { SectionReviewShell } from "./components/SectionReviewShell";
import { loadApprovalSectionReview } from "./services/loadApprovalSectionReview";

async function SectionReviewBody({
  requestId,
  lessonId,
}: {
  requestId: string;
  lessonId: string;
}) {
  const result = await loadApprovalSectionReview(requestId, lessonId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <div className="mx-auto max-w-[1080px] px-6 py-10 lg:px-10">
        <Callout tone="warning" title="Admin access required">
          This area is limited to Academy Admins.
        </Callout>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-[1080px] px-6 py-10 lg:px-10">
        <Callout tone="warning" title="Section unavailable">
          This review section could not be loaded.
        </Callout>
      </div>
    );
  }

  const detail = result.data;
  const stage =
    detail.status === "rejected"
      ? ("returned" as const)
      : detail.status === "approved"
        ? ("ready" as const)
        : ("pending" as const);

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-10 lg:px-10">
      <Link
        href={`/academy/admin/approvals/${detail.requestId}`}
        className="text-[13.5px] no-underline hover:text-accent-hover"
        style={{ color: "var(--text-secondary)" }}
      >
        ← {detail.program.name}
      </Link>

      <div className="mt-4">
        <ApprovalSequence stage={stage} />
      </div>

      <SectionReviewShell detail={detail} />
    </div>
  );
}

export function AdminApprovalSectionPage({
  requestId,
  lessonId,
}: {
  requestId: string;
  lessonId: string;
}) {
  return (
    <Suspense fallback={<ApprovalSkeleton />}>
      <SectionReviewBody requestId={requestId} lessonId={lessonId} />
    </Suspense>
  );
}

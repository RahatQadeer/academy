import { Suspense } from "react";
import Link from "next/link";
import { Callout } from "@/base/components/Callout";
import { programTypeLabel } from "@/academy/lib/domain";
import { ApprovalReviewSidebar } from "./components/ApprovalReviewSidebar";
import { ApprovalSequence } from "./components/ApprovalSequence";
import { ApprovalSkeleton } from "./components/ApprovalSkeleton";
import { ApprovalStageStatus } from "./components/ApprovalStageStatus";
import { ApprovalStructureReview } from "./components/ApprovalStructureReview";
import { loadPublishRequest } from "./services/loadPublishRequest";
import {
  approvalStage,
  approvalsQueueHref,
  formatApprovalReviewSubmittedAt,
} from "./utils/labels";

async function RequestBody({ requestId }: { requestId: string }) {
  const result = await loadPublishRequest(requestId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <div className="mx-auto max-w-[1120px] px-5 py-8 sm:px-7 lg:px-10">
        <Callout tone="warning" title="Admin access required">
          This area is limited to Academy Admins.
        </Callout>
      </div>
    );
  }

  if (!result.ok && result.reason === "not_found") {
    return (
      <div className="mx-auto max-w-[1120px] px-5 py-8 sm:px-7 lg:px-10">
        <Callout tone="warning" title="Request not found">
          This publish request could not be opened.
        </Callout>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-[1120px] px-5 py-8 sm:px-7 lg:px-10">
        <Callout tone="warning" title="Request unavailable">
          This publish request could not be loaded. Try again in a moment.
        </Callout>
      </div>
    );
  }

  const detail = result.data;
  const stage = approvalStage({
    status: detail.status,
    programStatus: detail.program.status,
    publishedAt: detail.publishedAt,
  });
  const typeLabel = detail.program.category.trim() || programTypeLabel(detail.program.type);

  return (
    <div className="relative mx-auto max-w-[1120px] px-5 py-8 sm:px-7 lg:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[200px]"
        style={{
          background:
            "radial-gradient(ellipse 55% 70% at 8% 0%, color-mix(in srgb, var(--accent-tint) 50%, transparent), transparent 72%)",
        }}
      />

      <Link
        href={approvalsQueueHref(stage)}
        className="inline-flex items-center gap-1.5 text-[13.5px] no-underline transition-colors hover:text-accent-hover"
        style={{ color: "var(--accent)" }}
      >
        <span aria-hidden>←</span>
        Publish Approvals
      </Link>

      <header className="mt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ApprovalStageStatus stage={stage} />
            </div>
            <h1
              className="mt-2.5 max-w-3xl text-[24px] font-bold leading-snug tracking-[-0.4px] text-pretty sm:text-[28px]"
              style={{ color: "var(--ink)" }}
            >
              {detail.program.name}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {typeLabel}
              <span className="mx-1.5" style={{ color: "var(--border-strong)" }}>
                ·
              </span>
              Submitted by {detail.submittedByName}
              <span className="mx-1.5" style={{ color: "var(--border-strong)" }}>
                ·
              </span>
              {formatApprovalReviewSubmittedAt(detail.submittedAt)}
            </p>
          </div>
        </div>

        <div
          className="mt-4 overflow-x-auto rounded-[12px] px-1.5 py-1.5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 2px rgba(15,15,15,0.03)",
          }}
        >
          <ApprovalSequence stage={stage} />
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start">
        <ApprovalStructureReview detail={detail} />
        <ApprovalReviewSidebar detail={detail} />
      </div>
    </div>
  );
}

export function AdminApprovalDetailPage({ requestId }: { requestId: string }) {
  return (
    <Suspense fallback={<ApprovalSkeleton />}>
      <RequestBody requestId={requestId} />
    </Suspense>
  );
}

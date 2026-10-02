import { formatInstructorDate, programStatusLabel } from "@/academy/instructor/utils/labels";
import type { ApprovalRequestDetail } from "../../types";
import { ApprovalRequestStatus } from "./ApprovalRequestStatus";

export function ApprovalReview({ detail }: { detail: ApprovalRequestDetail }) {
  return (
    <section
      className="rounded-[10px] bg-surface p-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <h2 className="text-[13.5px] font-medium">Request</h2>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
            Status
          </dt>
          <dd className="mt-1">
            <ApprovalRequestStatus status={detail.status} />
          </dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
            Submitted by
          </dt>
          <dd className="mt-1 text-[14px]">{detail.submittedByName}</dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
            Submitted
          </dt>
          <dd className="mt-1 text-[14px]">{formatInstructorDate(detail.submittedAt)}</dd>
        </div>
        {detail.reviewedAt ? (
          <div>
            <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
              Reviewed
            </dt>
            <dd className="mt-1 text-[14px]">{formatInstructorDate(detail.reviewedAt)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
            Publication
          </dt>
          <dd className="mt-1 text-[14px]">
            {detail.publishedAt
              ? `Published ${formatInstructorDate(detail.publishedAt)}`
              : "Not published"}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
            Program status
          </dt>
          <dd className="mt-1 text-[14px]">{programStatusLabel(detail.program.status)}</dd>
        </div>
        {detail.notes ? (
          <div>
            <dt className="text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--text-tertiary)" }}>
              Notes
            </dt>
            <dd className="mt-1 text-[14px] leading-relaxed">{detail.notes}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

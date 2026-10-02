import type { ApprovalRequestDetail } from "../../types";
import { approvalStage, approvalStageLabel, formatApprovalReviewSubmittedAt } from "../utils/labels";
import { ApprovalReviewControls } from "./ApprovalReviewControls";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-b py-2.5 last:border-b-0"
      style={{ borderColor: "var(--border)" }}
    >
      <dt className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </dt>
      <dd className="text-right text-[13px] font-medium text-ink">{value}</dd>
    </div>
  );
}

export function ApprovalReviewSidebar({
  detail,
}: {
  detail: ApprovalRequestDetail;
}) {
  const stage = approvalStage({
    status: detail.status,
    programStatus: detail.program.status,
    publishedAt: detail.publishedAt,
  });

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <section
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="border-b px-5 py-3"
          style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
        >
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.07em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Request summary
          </h2>
        </div>
        <dl className="px-5 py-1">
          <MetaRow label="Instructor" value={detail.submittedByName} />
          <MetaRow label="Submitted" value={formatApprovalReviewSubmittedAt(detail.submittedAt)} />
          <MetaRow
            label="Sections changed"
            value={`${detail.sectionsChanged} of ${detail.sectionsTotal}`}
          />
          <MetaRow label="Sequence" value={approvalStageLabel(stage)} />
          <MetaRow
            label="Learners enrolled"
            value={detail.enrollmentCount > 0 ? String(detail.enrollmentCount) : "—"}
          />
        </dl>
      </section>

      <ApprovalReviewControls detail={detail} />

      {detail.recentActivity.length > 0 ? (
        <section
          className="overflow-hidden rounded-[12px] bg-surface"
          style={{ border: "1px solid var(--border)" }}
        >
          <div
            className="border-b px-5 py-3"
            style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
          >
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.07em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {detail.submittedByName} — Recent activity
            </h2>
          </div>
          <ul className="divide-y px-2 py-1" style={{ borderColor: "var(--border)" }}>
            {detail.recentActivity.map((item) => (
              <li key={item.id} className="px-3 py-3" style={{ borderColor: "var(--border)" }}>
                <p className="text-[13px] font-medium text-ink">{item.title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                  {item.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

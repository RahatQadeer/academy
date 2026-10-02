"use client";

import Link from "next/link";
import type { ApprovalSectionReviewDetail } from "../../types";
import { formatApprovalReviewSubmittedAt } from "../utils/labels";

const CHECKLIST = [
  { id: "accurate", label: "Content is accurate" },
  { id: "tone", label: "Tone matches the program" },
  { id: "confidential", label: "No confidential client details" },
] as const;

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="shrink-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </dt>
      <dd className="min-w-0 text-right text-[13px] font-medium text-ink">{value}</dd>
    </div>
  );
}

export function SectionReviewSidebar({
  detail,
  checks,
  onToggle,
}: {
  detail: ApprovalSectionReviewDetail;
  checks: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
}) {
  const disabled = detail.status !== "pending";
  const remaining = CHECKLIST.filter((item) => !checks[item.id]).length;

  return (
    <aside className="space-y-4">
      <section
        className="rounded-[10px] bg-surface px-5 py-4"
        style={{ border: "1px solid var(--border)" }}
      >
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.07em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Submission
        </h2>
        <dl className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
          <MetaRow label="Instructor" value={detail.submittedByName} />
          <MetaRow label="Submitted" value={formatApprovalReviewSubmittedAt(detail.submittedAt)} />
          <MetaRow label="Scope" value={detail.scopeLabel} />
          <MetaRow label="Program" value={detail.program.name} />
        </dl>
        <Link
          href={`/academy/admin/approvals/${detail.requestId}`}
          className="mt-3 inline-block text-[13px] font-medium no-underline hover:text-accent-hover"
          style={{ color: "var(--accent)" }}
        >
          All sections →
        </Link>
      </section>

      <section
        className="rounded-[10px] bg-surface px-5 py-4"
        style={{ border: "1px solid var(--border)" }}
      >
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.07em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Before you approve
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Confirm each item. Approve stays unavailable until the list is complete.
        </p>
        <ul className="mt-3 space-y-1">
          {CHECKLIST.map((item) => {
            const checked = checks[item.id] ?? false;
            return (
              <li key={item.id}>
                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-[8px] px-2 py-2 hover:bg-black/[0.03]"
                  style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
                >
                  <input
                    type="checkbox"
                    className="mt-[3px] size-3.5 shrink-0 accent-[var(--accent)]"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => onToggle(item.id, event.target.checked)}
                  />
                  <span className="text-[13.5px] leading-snug" style={{ color: "var(--ink)" }}>
                    {item.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {disabled ? (
          <p className="mt-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            This request is no longer awaiting review.
          </p>
        ) : remaining > 0 ? (
          <p className="mt-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {remaining} item{remaining === 1 ? "" : "s"} remaining
          </p>
        ) : (
          <p className="mt-2 text-[12px]" style={{ color: "var(--success-fg)" }}>
            Ready to approve
          </p>
        )}
      </section>
    </aside>
  );
}

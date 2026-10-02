import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { programTypeLabel } from "@/academy/lib/domain";
import type { ApprovalQueueData } from "../../types";
import {
  approvalQueueCopy,
  approvalRowAction,
  approvalStage,
  formatApprovalQueueWhen,
} from "../utils/labels";
import { ApprovalEmptyState } from "./ApprovalEmptyState";
import { ApprovalSequence } from "./ApprovalSequence";
import { ApprovalStageStatus } from "./ApprovalStageStatus";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M5 3.5L8.5 7L5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ApprovalQueue({ data }: { data: ApprovalQueueData }) {
  const heading =
    data.filter === "pending"
      ? "Current requests"
      : data.filter === "ready"
        ? "Approved — awaiting publish"
        : data.filter === "published"
          ? "Published history"
          : "Returned for edits";

  return (
    <section aria-labelledby="approval-queue-heading">
      <div
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <ApprovalSequence stage={data.filter} counts={data.counts} />
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {approvalQueueCopy(data.filter)}
          </p>
        </div>

        <div
          className="flex items-center justify-between gap-3 border-b px-5 py-3 sm:px-6"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          <h2
            id="approval-queue-heading"
            className="text-[12px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {heading}
          </h2>
          <p className="text-[12.5px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {data.items.length.toLocaleString()}
            {data.truncated ? "+" : ""} request{data.items.length === 1 ? "" : "s"}
          </p>
        </div>

        {data.items.length === 0 ? (
          <ApprovalEmptyState filter={data.filter} />
        ) : (
          <ul>
            {data.items.map((item, index) => {
              const href = `/academy/admin/approvals/${item.id}`;
              const typeLabel = item.category.trim() || programTypeLabel(item.programType);
              const stage = approvalStage(item);
              const action = approvalRowAction(stage);
              return (
                <li
                  key={item.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Link
                    href={href}
                    aria-label={`${action} ${item.programName}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 no-underline transition-colors hover:bg-surface-soft sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <Avatar
                        name={item.submittedByName}
                        size={36}
                        tone={index % 2 === 0 ? "tan" : "blue"}
                      />
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium leading-snug text-ink text-pretty">
                          {item.programName}
                        </p>
                        <p
                          className="mt-1 truncate text-[12.5px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {item.submittedByName} · {typeLabel} ·{" "}
                          {formatApprovalQueueWhen(item.submittedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <ApprovalStageStatus stage={stage} />
                      <span
                        className="hidden items-center gap-1.5 text-[13px] font-medium sm:inline-flex"
                        style={{ color: "var(--accent)" }}
                      >
                        {action}
                        <span style={{ color: "var(--text-tertiary)" }}>
                          <ChevronIcon />
                        </span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {data.truncated ? (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Showing the most recent 48 requests in this list.
        </p>
      ) : null}
    </section>
  );
}

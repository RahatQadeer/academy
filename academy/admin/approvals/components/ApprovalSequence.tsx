import Link from "next/link";
import { cn } from "@/base/lib/cn";
import type { QueueStatusFilter } from "../../types";
import { approvalStageLabel, approvalsQueueHref } from "../utils/labels";

const TABS: { id: QueueStatusFilter; hint: string }[] = [
  { id: "pending", hint: "Awaiting your decision" },
  { id: "ready", hint: "Approved, not live yet" },
  { id: "published", hint: "Live in Explore" },
  { id: "returned", hint: "Sent back for edits" },
];

export function ApprovalSequence({
  stage,
  counts,
}: {
  stage: QueueStatusFilter;
  counts?: Record<QueueStatusFilter, number>;
}) {
  const interactive = Boolean(counts);

  return (
    <nav aria-label="Publish request status">
      <ul className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const selected = tab.id === stage;
          const count = counts?.[tab.id] ?? 0;
          const label = approvalStageLabel(tab.id);
          const content = (
            <span className="inline-flex items-center gap-2">
              <span className="whitespace-nowrap">{label}</span>
              {counts ? (
                <span
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                  style={{
                    background: selected
                      ? "color-mix(in srgb, var(--accent) 14%, white)"
                      : "var(--surface-soft)",
                    color: selected ? "var(--accent)" : "var(--text-tertiary)",
                  }}
                >
                  {count}
                </span>
              ) : null}
            </span>
          );

          return (
            <li key={tab.id}>
              {interactive ? (
                <Link
                  href={approvalsQueueHref(tab.id)}
                  aria-current={selected ? "page" : undefined}
                  title={tab.hint}
                  className={cn(
                    "inline-flex rounded-[9px] px-3 py-2 text-[13px] no-underline transition-colors",
                    selected ? "font-semibold text-ink" : "font-medium hover:bg-surface-soft",
                  )}
                  style={{
                    color: selected ? "var(--ink)" : "var(--text-secondary)",
                    background: selected
                      ? "color-mix(in srgb, var(--accent-tint, #e7f1fb) 85%, white)"
                      : "transparent",
                    boxShadow: selected
                      ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, var(--border))"
                      : undefined,
                  }}
                >
                  {content}
                </Link>
              ) : (
                <span
                  className={cn(
                    "inline-flex rounded-[9px] px-3 py-2 text-[13px]",
                    selected ? "font-semibold text-ink" : "font-medium",
                  )}
                  style={{ color: selected ? "var(--ink)" : "var(--text-tertiary)" }}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

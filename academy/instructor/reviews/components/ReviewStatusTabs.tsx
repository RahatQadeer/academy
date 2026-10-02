import Link from "next/link";
import { cn } from "@/base/lib/cn";
import type { InstructorReviewStatusFilter } from "../types";
import { reviewsQueueHref } from "../utils/href";

const TABS: {
  id: InstructorReviewStatusFilter;
  label: string;
  tone: "warning" | "success" | "accent" | "default";
}[] = [
  { id: "submitted", label: "Pending review", tone: "warning" },
  { id: "graded", label: "Reviewed", tone: "success" },
  { id: "resubmission_required", label: "Revision requested", tone: "accent" },
  { id: "all", label: "All", tone: "default" },
];

const TONE_STYLES = {
  warning: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  success: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
  accent: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  default: { bg: "var(--surface-soft)", fg: "var(--text-secondary)" },
} as const;

export function ReviewStatusTabs({
  active,
  counts,
  programId,
  assignmentId,
  learner,
}: {
  active: InstructorReviewStatusFilter;
  counts: Record<InstructorReviewStatusFilter, number>;
  programId?: string;
  assignmentId?: string;
  learner?: string;
}) {
  return (
    <nav aria-label="Submission status" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {TABS.map((tab) => {
        const selected = tab.id === active;
        const tone = TONE_STYLES[tab.tone];
        const count = counts[tab.id];
        return (
          <Link
            key={tab.id}
            href={reviewsQueueHref({
              status: tab.id,
              programId,
              assignmentId,
              learner,
            })}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "rounded-[10px] border px-3.5 py-3 no-underline transition-colors",
              selected ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_18%,transparent)]" : "hover:bg-surface-soft",
            )}
            style={{
              borderColor: selected ? "color-mix(in srgb, var(--accent) 28%, var(--border))" : "var(--border)",
              background: selected ? tone.bg : "var(--surface)",
            }}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span
                  className="block text-[13px] font-semibold"
                  style={{ color: selected ? tone.fg : "var(--ink)" }}
                >
                  {tab.label}
                </span>
                <span className="mt-0.5 block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {tab.id === "submitted"
                    ? "Needs your review"
                    : tab.id === "graded"
                      ? "Scored submissions"
                      : tab.id === "resubmission_required"
                        ? "Awaiting learner resubmit"
                        : "Full queue"}
                </span>
              </span>
              <span
                className="inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {count.toLocaleString()}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

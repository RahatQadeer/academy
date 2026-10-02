import Link from "next/link";
import { ProgressBar } from "@/base/components/ProgressBar";
import { programTypeLabel } from "@/academy/lib/domain";
import type { LearningItem } from "../types";
import { formatLearningDate } from "../utils/learningState";
import { LearningStatus } from "./LearningStatus";

function markStyle(item: LearningItem) {
  if (item.status === "completed") {
    return { background: "var(--success-bg)", color: "var(--success-fg)" };
  }
  if (item.programType === "certification_program") {
    return { background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" };
  }
  return { background: "var(--module-whitby-bg)", color: "var(--module-whitby-fg)" };
}

function typeMark(item: LearningItem) {
  if (item.status === "completed") return null;
  if (item.programType === "certification_program") return "CERT";
  if (item.programType === "endorsement_program") return "SE";
  if (item.programType === "short_course") return "SC";
  return "CR";
}

function subtitle(item: LearningItem) {
  if (!item.available) {
    return "This course is not available";
  }
  if (item.status === "completed" && item.completedAt) {
    return `Completed ${formatLearningDate(item.completedAt)}`;
  }
  if (item.progressHeadline) {
    return item.progressHeadline;
  }
  if (item.status === "enrolled") {
    return `Enrolled ${formatLearningDate(item.enrolledAt)}`;
  }
  const typeLabel = item.category?.trim() || programTypeLabel(item.programType);
  return typeLabel;
}

export function LearningCard({ item }: { item: LearningItem }) {
  const mark = typeMark(item);
  const primaryAction = item.action.variant === "primary";

  return (
    <article
      className="academy-learner-card flex flex-col gap-4 rounded-[16px] bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold"
        style={markStyle(item)}
        aria-hidden
      >
        {item.status === "completed" ? (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path
              d="M3.5 8.2 6.6 11.2 12.5 4.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          mark
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] font-medium leading-snug text-pretty">{item.programName}</h2>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {subtitle(item)}
        </p>
        <div className="mt-3 max-w-xl">
          <ProgressBar
            value={item.progressPercent}
            tone={item.status === "completed" ? "success" : "default"}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:shrink-0 sm:flex-col sm:items-end lg:flex-row lg:items-center">
        {item.available ? (
          <LearningStatus status={item.status} progressPercent={item.progressPercent} />
        ) : (
          <p className="text-[13px] whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
            Not available
          </p>
        )}
        {item.action.variant === "muted" ? (
          <span
            className="inline-flex items-center justify-center rounded-full px-4 py-[9px] text-[13.5px]"
            style={{
              background: "transparent",
              color: "var(--text-tertiary)",
              border: "1px solid var(--border)",
            }}
          >
            {item.action.label}
          </span>
        ) : (
          <Link
            href={item.action.href}
            className="inline-flex items-center justify-center rounded-full px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={
              primaryAction
                ? { background: "var(--accent)", color: "#fff" }
                : {
                    background: "transparent",
                    color: "var(--ink)",
                    border: "1px solid var(--border-strong)",
                  }
            }
          >
            {item.action.label}
          </Link>
        )}
      </div>
    </article>
  );
}

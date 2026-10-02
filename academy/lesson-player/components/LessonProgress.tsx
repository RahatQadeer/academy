import type { AcademyProgressStatus } from "@/academy/lib/domain";

export function LessonProgress({ status }: { status: AcademyProgressStatus | null }) {
  if (status === "completed") {
    return (
      <span
        className="inline-flex rounded-[4px] px-2 py-[2px] text-[10.5px] font-medium"
        style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
      >
        Completed
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span
        className="inline-flex rounded-[4px] px-2 py-[2px] text-[10.5px] font-medium"
        style={{ background: "var(--info-bg)", color: "var(--info-fg)" }}
      >
        In progress
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span
        className="inline-flex rounded-[4px] px-2 py-[2px] text-[10.5px] font-medium"
        style={{ background: "var(--surface-soft)", color: "var(--text-tertiary)" }}
      >
        Locked
      </span>
    );
  }
  return null;
}

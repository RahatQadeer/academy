import type { ReactNode } from "react";
import { LessonProgress } from "./LessonProgress";
import type { CurriculumLesson } from "../types";

export function LessonHeader({
  lesson,
  position,
  total,
  action,
}: {
  lesson: CurriculumLesson;
  position?: number;
  total?: number;
  action?: ReactNode;
}) {
  const hasPosition = Boolean(position && total && total > 0);
  const progressPercent = hasPosition ? Math.round(((position ?? 0) / (total ?? 1)) * 100) : 0;

  return (
    <header className="min-w-0">
      <div className="flex items-start justify-between gap-3 sm:gap-5">
        <div className="min-w-0 flex-1">
          <p
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span className="truncate">{lesson.moduleTitle}</span>
            {hasPosition ? (
              <>
                <span aria-hidden className="font-normal normal-case tracking-normal" style={{ color: "var(--text-disabled)" }}>
                  ·
                </span>
                <span className="shrink-0 font-medium normal-case tracking-normal tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  Lesson {position} of {total}
                </span>
              </>
            ) : null}
            {lesson.progressStatus === "in_progress" || lesson.progressStatus === "locked" ? (
              <span className="ml-0.5 inline-flex normal-case tracking-normal">
                <LessonProgress status={lesson.progressStatus} />
              </span>
            ) : null}
          </p>
        </div>
        {action ? <div className="ml-auto shrink-0 self-start">{action}</div> : null}
      </div>

      <h1 className="mt-2.5 max-w-[34ch] text-[20px] font-semibold leading-[1.28] tracking-[-0.35px] text-pretty sm:mt-3 sm:max-w-[42ch] sm:text-[23px] lg:text-[24px]">
        {lesson.title}
      </h1>

      {hasPosition ? (
        <div className="mt-3.5" aria-hidden>
          <div className="h-[3px] overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${Math.max(4, progressPercent)}%`,
                background: "var(--accent)",
              }}
            />
          </div>
        </div>
      ) : null}
    </header>
  );
}

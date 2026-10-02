"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";
import type { ApprovalRequestDetail, ReviewLesson, ReviewModule } from "../../types";

export function ApprovalStructureReview({ detail }: { detail: ApprovalRequestDetail }) {
  const [page, setPage] = useState(1);
  const modules = detail.modules;
  const pageCount = Math.max(1, modules.length || 1);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const module = modules[currentPage - 1] as ReviewModule | undefined;
  const moduleNumber = currentPage;

  const scopedModuleCount = useMemo(
    () => modules.filter((item) => item.inScope).length,
    [modules],
  );

  const changedInModule = module
    ? module.lessons.filter((lesson) => lesson.reviewState === "changed").length
    : 0;
  const progressPct =
    modules.length <= 1 ? 100 : Math.round(((currentPage - 1) / (modules.length - 1)) * 100);

  return (
    <section
      className="overflow-hidden rounded-[14px] bg-surface"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 2px rgba(15,15,15,0.03), 0 8px 24px rgba(15,15,15,0.03)",
      }}
    >
      {/* Top bar */}
      <div
        className="relative border-b px-5 py-4 sm:px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 45%, transparent), transparent)",
          }}
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Program structure
            </p>
            <h2
              className="mt-1 text-[16px] font-semibold tracking-[-0.25px]"
              style={{ color: "var(--ink)" }}
            >
              {modules.length === 0
                ? "No modules yet"
                : `Module ${moduleNumber} of ${modules.length}`}
            </h2>
            <p
              className="mt-1 max-w-[36rem] text-[12.5px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {scopedModuleCount === 1
                ? "One module in this instructor’s scope. Review lessons that changed."
                : "One module at a time. Only changed sections need your review."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MetaPill
              label="Changed"
              value={String(detail.sectionsChanged)}
              emphasize={detail.sectionsChanged > 0}
            />
            <MetaPill label="Sections" value={String(detail.sectionsTotal)} />
          </div>
        </div>

        {modules.length > 1 ? (
          <div className="mt-4">
            <div
              className="h-1 overflow-hidden rounded-full"
              style={{ background: "var(--border)" }}
              role="progressbar"
              aria-valuenow={currentPage}
              aria-valuemin={1}
              aria-valuemax={modules.length}
              aria-label="Module progress"
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.max(8, progressPct)}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Single module body */}
      {modules.length === 0 || !module ? (
        <div className="px-5 py-12 text-center sm:px-6">
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            This program has no modules yet.
          </p>
        </div>
      ) : (
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div
            className="rounded-[12px] px-4 py-4 sm:px-5"
            style={{
              background:
                "linear-gradient(165deg, color-mix(in srgb, var(--accent-tint) 55%, white) 0%, var(--surface) 55%)",
              border: "1px solid color-mix(in srgb, var(--accent) 12%, var(--border))",
            }}
          >
            <div className="flex flex-wrap items-start gap-3">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[15px] font-bold tabular-nums"
                style={{
                  background: "var(--surface)",
                  color: "var(--accent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 20%, var(--border))",
                  boxShadow: "0 1px 2px rgba(15,15,15,0.04)",
                }}
              >
                {moduleNumber}
              </span>
              <div className="min-w-0 flex-1">
                <h3
                  className="text-[17px] font-semibold tracking-[-0.3px] text-pretty sm:text-[18px]"
                  style={{ color: "var(--ink)" }}
                >
                  {module.title}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-[6px] px-2 py-0.5 text-[11.5px] font-medium"
                    style={{
                      background: "var(--surface)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {module.lessons.length}{" "}
                    {module.lessons.length === 1 ? "lesson" : "lessons"}
                  </span>
                  {changedInModule > 0 ? (
                    <span
                      className="rounded-[6px] px-2 py-0.5 text-[11.5px] font-medium"
                      style={{
                        background: "var(--warning-bg)",
                        color: "var(--warning-fg)",
                        border: "1px solid var(--warning-border)",
                      }}
                    >
                      {changedInModule} changed
                    </span>
                  ) : module.inScope ? (
                    <span
                      className="rounded-[6px] px-2 py-0.5 text-[11.5px] font-medium"
                      style={{
                        background: "var(--success-bg)",
                        color: "var(--success-fg)",
                      }}
                    >
                      No changes
                    </span>
                  ) : (
                    <span
                      className="rounded-[6px] px-2 py-0.5 text-[11.5px] font-medium"
                      style={{
                        background: "var(--surface-soft)",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      Outside scope
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {!module.inScope ? (
            <p
              className="mt-4 rounded-[10px] px-4 py-3 text-[13.5px] leading-relaxed"
              style={{
                background: "var(--surface-soft)",
                color: "var(--text-secondary)",
              }}
            >
              Not in this instructor’s editing scope — skipped for review.
            </p>
          ) : module.lessons.length === 0 ? (
            <p className="mt-4 text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
              No lessons in this module.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {module.lessons.map((lesson, lessonIndex) => (
                <LessonReviewRow
                  key={lesson.id}
                  moduleNumber={moduleNumber}
                  lessonNumber={lessonIndex + 1}
                  lesson={lesson}
                  requestId={detail.id}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Pagination — always show when more than one module */}
      {modules.length > 1 ? (
        <div
          className="flex flex-col gap-3 border-t px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
        >
          <p className="text-[12.5px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            Viewing module{" "}
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {moduleNumber}
            </span>{" "}
            of {modules.length}
          </p>
          <PaginationBar
            page={currentPage}
            pageCount={pageCount}
            total={modules.length}
            rangeStart={moduleNumber}
            rangeEnd={moduleNumber}
            itemLabel="module"
            onPageChange={setPage}
            compact
            showRange={false}
            label="Module pages"
          />
        </div>
      ) : null}
    </section>
  );
}

function MetaPill({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        background: emphasize
          ? "color-mix(in srgb, var(--warning-bg) 85%, white)"
          : "var(--surface-soft)",
        border: `1px solid ${emphasize ? "var(--warning-border)" : "var(--border)"}`,
      }}
    >
      <span
        className="text-[10.5px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <span
        className="text-[13px] font-semibold tabular-nums"
        style={{ color: emphasize ? "var(--warning-fg)" : "var(--ink)" }}
      >
        {value}
      </span>
    </span>
  );
}

function LessonReviewRow({
  moduleNumber,
  lessonNumber,
  lesson,
  requestId,
}: {
  moduleNumber: number;
  lessonNumber: number;
  lesson: ReviewLesson;
  requestId: string;
}) {
  const label = `${moduleNumber}.${lessonNumber} ${lesson.title}`;
  const sectionHref = `/academy/admin/approvals/${requestId}/sections/${lesson.id}`;
  const changed = lesson.reviewState === "changed";

  return (
    <li
      className={cn(
        "group flex flex-col gap-2.5 rounded-[11px] px-3.5 py-3 transition-[background,border-color,box-shadow] sm:flex-row sm:items-center sm:justify-between",
        !changed && "hover:bg-[var(--surface-soft)]",
      )}
      style={
        changed
          ? {
              background: "var(--warning-bg)",
              border: "1px solid var(--warning-border)",
              boxShadow: "0 1px 2px color-mix(in srgb, var(--warning-fg) 8%, transparent)",
            }
          : {
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }
      }
    >
      <div className="flex min-w-0 items-start gap-3">
        <LessonTypeIcon type={lesson.type} hasQuiz={lesson.hasQuiz} changed={changed} />
        <div className="min-w-0">
          <p
            className="text-[14px] font-medium leading-snug tracking-[-0.1px] text-pretty"
            style={{ color: "var(--ink)" }}
          >
            {label}
          </p>
          <p
            className="mt-0.5 text-[12px]"
            style={{ color: changed ? "var(--warning-fg)" : "var(--text-tertiary)" }}
          >
            {changed ? "Changed — needs review" : lessonTypeLabel(lesson)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-10 sm:pl-0">
        {!changed ? (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: "var(--surface-soft)",
              color: "var(--text-tertiary)",
            }}
          >
            Unchanged
          </span>
        ) : null}
        <Link
          href={sectionHref}
          className="inline-flex items-center gap-1 rounded-[7px] px-2.5 py-1.5 text-[13px] font-medium no-underline transition-colors"
          style={{
            color: changed ? "#fff" : "var(--accent)",
            background: changed ? "var(--accent)" : "transparent",
          }}
        >
          {changed ? "Review" : "Open"}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </li>
  );
}

function lessonTypeLabel(lesson: ReviewLesson) {
  if (lesson.hasQuiz || lesson.type === "quiz") return "Quiz";
  if (lesson.type === "assignment") return "Assignment";
  if (lesson.type === "video") return "Video";
  return "Lesson";
}

function LessonTypeIcon({
  type,
  hasQuiz,
  changed,
}: {
  type: string;
  hasQuiz: boolean;
  changed: boolean;
}) {
  const kind =
    hasQuiz || type === "quiz"
      ? "quiz"
      : type === "assignment"
        ? "assignment"
        : type === "video"
          ? "video"
          : "lesson";

  return (
    <span
      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
      style={{
        background: changed
          ? "color-mix(in srgb, var(--warning-fg) 12%, white)"
          : "var(--surface-soft)",
        color: changed ? "var(--warning-fg)" : "var(--text-secondary)",
      }}
      aria-hidden
    >
      {kind === "quiz" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      ) : kind === "assignment" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
        </svg>
      ) : kind === "video" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
          <path
            d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

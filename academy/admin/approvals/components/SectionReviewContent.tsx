import Link from "next/link";
import { LessonBody } from "@/academy/admin/catalog/components/lesson/LessonBody";
import { formatInlineMarkdownFragment } from "@/academy/admin/catalog/lib/formatInlineMarkdown";
import type { CatalogLesson } from "@/academy/admin/catalog/types";
import type { ApprovalSectionReviewDetail } from "../../types";

const TYPE_LABELS: Record<string, string> = {
  reading: "Reading",
  video: "Video",
  quiz: "Quiz",
  scenario: "Scenario",
  assignment: "Assignment",
  resource: "Resource",
  attachment: "File",
};

function toCatalogLesson(detail: ApprovalSectionReviewDetail): CatalogLesson {
  const lesson = detail.lesson;
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    contentUrl: "",
    contentBody: lesson.contentBody,
    contentSummary: lesson.contentSummary,
    learningObjectives: lesson.learningObjectives,
    videoUrl: lesson.videoUrl,
    videoDurationSeconds: 0,
    sortOrder: lesson.index,
    resources: lesson.resources,
    assignment: lesson.assignment,
    quiz: null,
  };
}

export function SectionReviewContent({ detail }: { detail: ApprovalSectionReviewDetail }) {
  const lesson = toCatalogLesson(detail);
  const hasBody = Boolean(detail.lesson.contentBody.trim());
  const hasSummary = Boolean(detail.lesson.contentSummary.trim());
  const hasMedia = Boolean(detail.lesson.videoUrl);
  const empty = !hasBody && !hasSummary && !hasMedia && detail.lesson.learningObjectives.length === 0;

  return (
    <div className="space-y-5">
      <article
        className="overflow-hidden rounded-[10px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="border-b px-5 py-4 sm:px-7 sm:py-5"
          style={{ borderColor: "var(--border)", background: "var(--surface-subtle, #fbfbfa)" }}
        >
          <p
            className="text-[11.5px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {detail.program.name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded-[6px] px-2 py-0.5 text-[11.5px] font-semibold"
              style={{
                background: "var(--surface-soft)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {TYPE_LABELS[detail.lesson.type] ?? detail.lesson.type}
            </span>
            <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Module {detail.module.index}.{detail.lesson.index}
            </span>
            <span aria-hidden className="text-[12.5px]" style={{ color: "var(--border-strong)" }}>
              ·
            </span>
            <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {detail.module.title}
            </span>
          </div>
          <h2 className="mt-2.5 text-[22px] font-semibold leading-snug tracking-[-0.03em] text-pretty sm:text-[24px]">
            {detail.lesson.title}
          </h2>
          {hasSummary ? (
            <p
              className="mt-2 max-w-2xl text-[14.5px] leading-[1.65]"
              style={{ color: "var(--text-secondary)" }}
            >
              {formatInlineMarkdownFragment(detail.lesson.contentSummary)}
            </p>
          ) : null}
        </div>

        <div className="px-5 py-6 sm:px-7 sm:py-7">
          {detail.lesson.videoUrl ? (
            <p className="mb-6 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              Video:{" "}
              <a href={detail.lesson.videoUrl} className="font-medium no-underline hover:text-accent-hover">
                {detail.lesson.videoUrl}
              </a>
            </p>
          ) : null}

          {detail.lesson.type === "quiz" ? (
            <p
              className="mb-6 rounded-[8px] px-3.5 py-3 text-[13.5px] leading-relaxed"
              style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
            >
              {detail.lesson.quizQuestionCount > 0
                ? `This section is a quiz with ${detail.lesson.quizQuestionCount} question${
                    detail.lesson.quizQuestionCount === 1 ? "" : "s"
                  }.`
                : "This section is a quiz. No questions have been added yet."}
            </p>
          ) : null}

          {empty ? (
            <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              No lesson content was submitted for this section.
            </p>
          ) : (
            <LessonBody lesson={lesson} />
          )}
        </div>
      </article>

      <nav className="flex flex-wrap items-center justify-between gap-3">
        {detail.adjacent.previous ? (
          <Link
            href={`/academy/admin/approvals/${detail.requestId}/sections/${detail.adjacent.previous.id}`}
            className="text-[13px] font-medium no-underline hover:text-accent-hover"
            style={{ color: "var(--accent)" }}
          >
            ← {detail.adjacent.previous.label}
          </Link>
        ) : (
          <span />
        )}
        {detail.adjacent.next ? (
          <Link
            href={`/academy/admin/approvals/${detail.requestId}/sections/${detail.adjacent.next.id}`}
            className="ml-auto text-[13px] font-medium no-underline hover:text-accent-hover"
            style={{ color: "var(--accent)" }}
          >
            {detail.adjacent.next.label} →
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

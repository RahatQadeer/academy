import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Callout } from "@/base/components/Callout";
import { LessonMarkdownBody } from "@/academy/admin/catalog/components/lesson/LessonBody";
import { InstructorSubmissionBadge } from "@/academy/assignments/components/AssignmentStatusBadge";
import { formatAssignmentDateTime, formatAssignmentScore } from "@/academy/assignments/utils/labels";
import { GradeForm } from "./GradeForm";
import type { InstructorReviewDetail } from "../types";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5 2.5h4.2L12.5 6v7.5A1 1 0 0 1 11.5 14.5h-6A1 1 0 0 1 4.5 13.5v-10A1 1 0 0 1 5.5 2.5H5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9.2 2.6V6h3.2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function ReviewDetail({ detail }: { detail: InstructorReviewDetail }) {
  return (
    <div>
      <Link
        href="/academy/instructor/reviews"
        className="inline-flex items-center gap-1.5 text-[13.5px] no-underline hover:text-accent-hover"
        style={{ color: "var(--accent)" }}
      >
        <span aria-hidden>←</span>
        Review queue
      </Link>

      <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <Avatar name={detail.learnerName} size={44} tone="tan" />
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-[-0.5px] text-pretty">
              {detail.learnerName}
            </h1>
            {detail.learnerEmail ? (
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
                {detail.learnerEmail}
              </p>
            ) : null}
            <p className="mt-1.5 text-[13.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>
              {detail.programName}
              <span style={{ color: "var(--text-tertiary)" }}> · </span>
              {detail.lessonTitle}
            </p>
          </div>
        </div>
        <InstructorSubmissionBadge status={detail.status} />
      </header>

      {detail.status === "resubmission_required" && detail.feedback.trim() ? (
        <div className="mt-5">
          <Callout tone="warning" title="Revision requested">
            <p className="whitespace-pre-wrap">{detail.feedback}</p>
            <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              The learner sees these comments in the assignment panel.
            </p>
          </Callout>
        </div>
      ) : detail.status === "resubmission_required" ? (
        <div className="mt-5">
          <Callout tone="warning" title="Resubmission requested">
            The certificate stays locked until the learner submits again and you review the new work.
          </Callout>
        </div>
      ) : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="space-y-5">
          <section
            className="rounded-[12px] border bg-surface p-5 sm:p-6"
            style={{ borderColor: "var(--border)", boxShadow: CARD_SHADOW }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Assignment brief
            </p>
            {detail.brief.trim() ? (
              <p className="mt-2.5 text-[15px] leading-[1.7] text-pretty" style={{ color: "var(--ink)" }}>
                {detail.brief}
              </p>
            ) : (
              <p className="mt-2.5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
                No brief on file.
              </p>
            )}
            {detail.rubric.trim() ? (
              <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <p
                  className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Rubric
                </p>
                <LessonMarkdownBody content={detail.rubric} className="space-y-3" />
              </div>
            ) : null}
          </section>

          <section
            className="rounded-[12px] border bg-surface p-5 sm:p-6"
            style={{ borderColor: "var(--border)", boxShadow: CARD_SHADOW }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Learner submission
              </p>
              <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                {detail.submittedAt ? formatAssignmentDateTime(detail.submittedAt) : "Not submitted"}
                {detail.attemptCount > 1 ? ` · Attempt ${detail.attemptCount}` : ""}
              </p>
            </div>
            {detail.body.trim() ? (
              <p className="mt-4 whitespace-pre-wrap text-[15px] leading-[1.7]" style={{ color: "var(--ink)" }}>
                {detail.body}
              </p>
            ) : (
              <p className="mt-4 text-[14px]" style={{ color: "var(--text-secondary)" }}>
                No written response.
              </p>
            )}
            {detail.fileName ? (
              <div
                className="mt-5 flex items-center gap-3 rounded-[10px] px-3.5 py-3"
                style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
              >
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                >
                  <FileIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{detail.fileName}</p>
                  {detail.fileUrl ? (
                    <a
                      href={detail.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-block text-[12.5px] font-medium no-underline hover:text-accent-hover"
                      style={{ color: "var(--accent)" }}
                    >
                      Open file
                    </a>
                  ) : (
                    <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                      File unavailable
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          {detail.status === "graded" ? (
            <div
              className="rounded-[12px] px-5 py-4"
              style={{ background: "var(--success-bg)", color: "var(--success-fg)", boxShadow: CARD_SHADOW }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em]">Current marks</p>
              <p className="mt-1.5 text-[28px] font-bold tabular-nums tracking-[-0.6px]">
                {formatAssignmentScore(detail.score, detail.maxScore)}
              </p>
              {detail.gradedAt ? (
                <p className="mt-1 text-[12.5px]">Graded {formatAssignmentDateTime(detail.gradedAt)}</p>
              ) : null}
            </div>
          ) : null}
          <GradeForm detail={detail} />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { LearnerAssignmentBadge } from "@/academy/assignments/components/AssignmentStatusBadge";
import type { AssignmentSubmissionView, LearnerAssignmentState } from "@/academy/assignments/types";
import { assignmentActionMessage, formatAssignmentDateTime, formatAssignmentScore } from "@/academy/assignments/utils/labels";
import type { LessonAssignment, LessonMedia } from "../types";
import { saveAssignmentDraftAction, submitAssignmentAction } from "../actions";

function minutesLabel(value: string) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.zip";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LearnerAssignmentPanel({
  programId,
  lessonId,
  assignment,
  submission,
  media,
}: {
  programId: string;
  lessonId: string;
  assignment: LessonAssignment;
  submission: AssignmentSubmissionView | null;
  media?: LessonMedia | null;
}) {
  const state: LearnerAssignmentState = submission?.learnerState ?? "not_started";
  const canEdit = state === "not_started" || state === "in_progress" || state === "needs_resubmission";

  return (
    <section
      className="overflow-hidden rounded-[12px] border"
      style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5"
        style={{
          borderColor: "var(--border)",
          background: "var(--module-academy-bg)",
        }}
      >
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--module-academy-fg)" }}
          >
            Assignment
          </p>
          <p className="mt-0.5 text-[15px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
            Submit your work
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {minutesLabel(assignment.estimatedMinutes) ? (
            <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {minutesLabel(assignment.estimatedMinutes)}
            </span>
          ) : null}
          <LearnerAssignmentBadge state={state} />
        </div>
      </header>

      <div className="space-y-5 px-5 py-5">
        {assignment.brief.trim() ? (
          <p className="text-[15px] leading-[1.7] text-pretty" style={{ color: "var(--ink)" }}>
            {assignment.brief}
          </p>
        ) : null}

        {media && (media.signedUrl || media.externalUrl) ? <PromptFile media={media} /> : null}

        {assignment.submissionInstructions.trim() ? (
          <div>
            <p
              className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              How to submit
            </p>
            <p className="text-[14.5px] leading-[1.65]" style={{ color: "var(--ink)" }}>
              {assignment.submissionInstructions}
            </p>
          </div>
        ) : null}

        {state === "pending_review" && submission ? (
          <PendingReviewBlock submission={submission} />
        ) : null}

        {state === "graded" && submission ? <GradedBlock submission={submission} /> : null}

        {state === "needs_resubmission" && submission ? (
          <Callout tone="warning" title="Revision requested">
            {submission.feedback.trim()
              ? submission.feedback
              : "Your instructor asked you to revise this assignment. Submit again when you are ready."}
          </Callout>
        ) : null}

        {canEdit ? (
          <SubmissionForm
            programId={programId}
            lessonId={lessonId}
            assignmentId={assignment.id}
            initialBody={submission?.body ?? ""}
            existingFileName={submission?.fileName ?? null}
            existingFileUrl={submission?.fileUrl ?? null}
            isResubmission={state === "needs_resubmission"}
          />
        ) : null}

        {state === "pending_review" || state === "graded" ? (
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            You can continue with other lessons while this assignment is on file. Your certificate stays locked
            until every required assignment has been reviewed.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function UploadGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden style={{ color: "var(--text-tertiary)" }}>
      <path
        d="M12 15.5V4M12 4 7.5 8.5M12 4l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5 2.5h4.2L13 6.3V13a1.5 1.5 0 0 1-1.5 1.5h-6.5A1.5 1.5 0 0 1 3.5 13V4A1.5 1.5 0 0 1 5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9.2 2.5V6.3H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function PromptFile({ media }: { media: LessonMedia }) {
  const href = media.signedUrl ?? media.externalUrl;
  if (!href) return null;
  const label = media.fileName || "Assignment file";

  return (
    <a
      href={href}
      target="_blank"
      rel={media.externalUrl ? "noreferrer" : undefined}
      className="flex items-center gap-3 rounded-[10px] border px-3.5 py-3 no-underline"
      style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
    >
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
        style={{ background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" }}
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M5 2.5h4.2L13 6.3V13a1.5 1.5 0 0 1-1.5 1.5h-6.5A1.5 1.5 0 0 1 3.5 13V4A1.5 1.5 0 0 1 5 2.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M9.2 2.5V6.3H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
          {label}
        </span>
        <span className="block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Download the assignment
        </span>
      </span>
    </a>
  );
}

function PendingReviewBlock({ submission }: { submission: AssignmentSubmissionView }) {
  return (
    <div className="space-y-3">
      <Callout tone="info" title="Submitted — pending review">
        Your instructor has this submission. You can keep going with the rest of the course. The certificate
        unlocks after every required assignment has been graded.
      </Callout>
      <SubmittedWork submission={submission} />
    </div>
  );
}

function GradedBlock({ submission }: { submission: AssignmentSubmissionView }) {
  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-end justify-between gap-4 rounded-[10px] px-4 py-4"
        style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
      >
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em]">Marks</p>
          <p className="mt-1 text-[28px] font-bold leading-none tracking-[-0.8px] tabular-nums">
            {formatAssignmentScore(submission.score, submission.maxScore)}
          </p>
        </div>
        {submission.gradedAt ? (
          <p className="text-[12.5px]">Reviewed {formatAssignmentDateTime(submission.gradedAt)}</p>
        ) : null}
      </div>
      {submission.feedback.trim() ? (
        <div
          className="rounded-[10px] px-4 py-3.5"
          style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
        >
          <p
            className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Instructor feedback
          </p>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>
            {submission.feedback}
          </p>
        </div>
      ) : null}
      <SubmittedWork submission={submission} />
    </div>
  );
}

function SubmittedWork({ submission }: { submission: AssignmentSubmissionView }) {
  return (
    <div
      className="rounded-[10px] px-4 py-3.5"
      style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
    >
      <p
        className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Your submission
        {submission.submittedAt ? ` · ${formatAssignmentDateTime(submission.submittedAt)}` : ""}
      </p>
      {submission.body.trim() ? (
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>
          {submission.body}
        </p>
      ) : (
        <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          No written response — file attached.
        </p>
      )}
      {submission.fileName ? (
        <p className="mt-2.5 text-[13px]">
          {submission.fileUrl ? (
            <a
              href={submission.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium no-underline hover:text-accent-hover"
              style={{ color: "var(--accent)" }}
            >
              {submission.fileName}
            </a>
          ) : (
            <span style={{ color: "var(--text-secondary)" }}>{submission.fileName}</span>
          )}
        </p>
      ) : null}
    </div>
  );
}

function SubmissionForm({
  programId,
  lessonId,
  assignmentId,
  initialBody,
  existingFileName,
  existingFileUrl,
  isResubmission,
}: {
  programId: string;
  lessonId: string;
  assignmentId: string;
  initialBody: string;
  existingFileName: string | null;
  existingFileUrl: string | null;
  isResubmission: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState(initialBody);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function acceptFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError(`“${next.name}” is ${formatFileSize(next.size)}. The limit is 20 MB.`);
      return;
    }
    setError(null);
    setFile(next);
  }

  function clearFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function buildFormData() {
    const formData = new FormData();
    formData.set("assignmentId", assignmentId);
    formData.set("programId", programId);
    formData.set("lessonId", lessonId);
    formData.set("body", body);
    if (file) formData.set("file", file);
    return formData;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await submitAssignmentAction(buildFormData());
      if (result.status !== "ok") {
        setError(assignmentActionMessage(result.reason));
        return;
      }
      router.refresh();
    });
  }

  function onSaveDraft() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveAssignmentDraftAction(buildFormData());
      if (result.status !== "ok") {
        setError(assignmentActionMessage(result.reason));
        return;
      }
      setNotice("Draft saved. You can come back and submit when you are ready.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t pt-5" style={{ borderColor: "var(--border)" }}>
      <label className="block">
        <span className="text-[13.5px] font-medium">Written response</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={7}
          placeholder="Write your response. You can also attach a supporting file."
          className="mt-2 w-full rounded-[8px] px-3 py-2.5 text-[14px] leading-relaxed"
          style={{
            border: "1px solid var(--border-strong)",
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        />
      </label>

      <div>
        <p className="text-[13.5px] font-medium">Attachment {existingFileName ? "" : "(optional)"}</p>

        {file ? (
          <div
            className="mt-2 flex items-center gap-3 rounded-[8px] px-3.5 py-3"
            style={{ border: "1px solid var(--border)", background: "var(--surface-soft)" }}
          >
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
              style={{ background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" }}
              aria-hidden
            >
              <FileGlyph />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                {file.name}
              </span>
              <span className="block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {formatFileSize(file.size)} · ready to submit
              </span>
            </span>
            <button
              type="button"
              onClick={clearFile}
              className="shrink-0 rounded-[6px] px-2 py-1 text-[12.5px] font-medium"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Remove attached file"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              acceptFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className="mt-2 flex w-full flex-col items-center justify-center rounded-[8px] px-4 py-7 text-[13.5px] transition-colors"
            style={{
              border: `1px dashed ${dragging ? "var(--accent)" : "var(--border-dashed)"}`,
              color: "var(--text-secondary)",
              background: dragging ? "var(--accent-tint-mid, #f4f9fe)" : "transparent",
            }}
          >
            <UploadGlyph />
            {existingFileName ? (
              <>
                <span className="mt-2">
                  Current file:{" "}
                  {existingFileUrl ? (
                    <a
                      href={existingFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="font-medium no-underline"
                      style={{ color: "var(--accent)" }}
                    >
                      {existingFileName}
                    </a>
                  ) : (
                    <span style={{ color: "var(--ink)" }}>{existingFileName}</span>
                  )}
                </span>
                <span className="mt-1 text-[12px]">
                  Drop a file or <span style={{ color: "var(--accent)" }}>browse</span> to replace it
                </span>
              </>
            ) : (
              <>
                <span className="mt-2">
                  Drag &amp; drop or <span style={{ color: "var(--accent)" }}>browse</span>
                </span>
                <span className="mt-1 text-[12px]">PDF, Word, image, or ZIP · 20 MB max</span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_FILE_TYPES}
          onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
        />
      </div>

      {error ? (
        <p className="text-[13px]" style={{ color: "var(--danger-fg, #c0392b)" }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-[13px]" style={{ color: "var(--success-fg)" }}>
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2.5">
        {!isResubmission ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={onSaveDraft}>
            {pending ? "Saving…" : "Save draft"}
          </Button>
        ) : null}
        <Button type="submit" variant="primary" disabled={pending || (!body.trim() && !file && !existingFileName)}>
          {pending ? "Submitting…" : isResubmission ? "Resubmit assignment" : "Submit assignment"}
        </Button>
      </div>
    </form>
  );
}

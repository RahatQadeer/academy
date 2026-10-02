"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { assignmentActionMessage } from "@/academy/assignments/utils/labels";
import {
  SCORE_PERCENT_MAX,
  clampScorePercent,
  sanitizeScorePercentInput,
} from "@/academy/lib/scorePercent";
import { gradeAssignmentAction, requestResubmissionAction } from "../actions";
import type { InstructorReviewDetail } from "../types";

export function GradeForm({ detail }: { detail: InstructorReviewDetail }) {
  const router = useRouter();
  const [score, setScore] = useState(detail.score == null ? "" : String(detail.score));
  const [maxScore, setMaxScore] = useState(
    String(clampScorePercent(detail.maxScore || SCORE_PERCENT_MAX, SCORE_PERCENT_MAX)),
  );
  const [feedback, setFeedback] = useState(detail.feedback);
  const [revisionNotes, setRevisionNotes] = useState(
    detail.status === "resubmission_required" ? detail.feedback : "",
  );
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = detail.status === "draft";

  function parsedScore() {
    const value = Number(score);
    const max = Number(maxScore);
    if (!Number.isFinite(value) || !Number.isFinite(max)) return null;
    return {
      score: clampScorePercent(value, 0),
      maxScore: clampScorePercent(max, SCORE_PERCENT_MAX),
    };
  }

  function onGrade() {
    setError(null);
    const parsed = parsedScore();
    if (
      !parsed ||
      parsed.score < 0 ||
      parsed.maxScore <= 0 ||
      parsed.maxScore > SCORE_PERCENT_MAX ||
      parsed.score > parsed.maxScore
    ) {
      setError("Enter marks from 0 to 100. Score cannot exceed the maximum (max 100).");
      return;
    }
    startTransition(async () => {
      const result = await gradeAssignmentAction({
        submissionId: detail.id,
        score: parsed.score,
        maxScore: parsed.maxScore,
        feedback,
      });
      if (result.status !== "ok") {
        setError(assignmentActionMessage(result.reason));
        return;
      }
      router.refresh();
    });
  }

  function onRequestRevision() {
    setError(null);
    const notes = revisionNotes.trim() || feedback.trim();
    if (!notes) {
      setError("Add revision comments so the learner knows what to change.");
      setShowRevisionForm(true);
      return;
    }
    startTransition(async () => {
      const result = await requestResubmissionAction({
        submissionId: detail.id,
        feedback: notes,
      });
      if (result.status !== "ok") {
        setError(assignmentActionMessage(result.reason));
        return;
      }
      setFeedback(notes);
      setShowRevisionForm(false);
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-[12px] border bg-surface p-5 sm:p-6"
      style={{
        borderColor: "var(--border)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)",
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Evaluation
      </p>
      <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.2px]">Review & marks</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Assign a score and optional feedback, or request a revision with specific comments for the learner.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Input
          label="Marks"
          name="score"
          type="number"
          min={0}
          max={100}
          step="0.5"
          value={score}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              setScore("");
              return;
            }
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            setScore(String(Math.min(SCORE_PERCENT_MAX, Math.max(0, n))));
          }}
          disabled={locked || pending}
        />
        <Input
          label="Out of (max 100)"
          name="maxScore"
          type="number"
          min={1}
          max={100}
          step="1"
          value={maxScore}
          onChange={(event) => {
            const next = sanitizeScorePercentInput(event.target.value);
            setMaxScore(next === "" || next === "0" ? "" : next);
          }}
          disabled={locked || pending}
        />
      </div>
      <p className="mt-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        Total marks are out of 100. Neither the score nor the maximum can exceed 100.
      </p>

      <label className="mt-4 block">
        <span
          className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Feedback (optional)
        </span>
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={4}
          disabled={locked || pending}
          placeholder="General notes on the submission."
          className="w-full rounded-[8px] border border-line-strong bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-ink"
        />
      </label>

      {showRevisionForm || detail.status === "resubmission_required" ? (
        <label className="mt-4 block">
          <span
            className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--warning-fg)" }}
          >
            Revision comments {detail.status === "resubmission_required" ? "(sent to learner)" : "(required)"}
          </span>
          <textarea
            value={revisionNotes}
            onChange={(event) => setRevisionNotes(event.target.value)}
            rows={5}
            disabled={locked || pending || detail.status === "resubmission_required"}
            placeholder="Explain exactly what the learner should revise before resubmitting."
            className="w-full rounded-[8px] border bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-ink"
            style={{ borderColor: "color-mix(in srgb, var(--warning-fg) 35%, var(--border-strong))" }}
          />
        </label>
      ) : null}

      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg, #c0392b)" }}>
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2.5">
        <Button type="button" variant="primary" disabled={locked || pending} onClick={onGrade}>
          {pending ? "Saving…" : detail.status === "graded" ? "Update marks" : "Mark as reviewed"}
        </Button>
        {detail.status !== "resubmission_required" ? (
          showRevisionForm ? (
            <>
              <Button type="button" variant="secondary" disabled={locked || pending} onClick={onRequestRevision}>
                {pending ? "Sending…" : "Send revision request"}
              </Button>
              <button
                type="button"
                className="text-[13px] font-medium"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => setShowRevisionForm(false)}
              >
                Cancel revision request
              </button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={locked || pending}
              onClick={() => setShowRevisionForm(true)}
            >
              Request revision
            </Button>
          )
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import type { ApprovalSectionReviewDetail } from "../../types";
import { NOTES_MAX } from "../../types";
import {
  approveAndPublishRequestAction,
  reviewPublishRequestAction,
} from "../actions";

export function SectionReviewToolbar({
  detail,
  allChecked,
}: {
  detail: ApprovalSectionReviewDetail;
  allChecked: boolean;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const isAwaitingReview = detail.status === "pending";
  const outcomeBase = `/academy/admin/approvals/${detail.requestId}`;
  const specialtyDisplay = detail.specialtyLabel.startsWith("Specialty:")
    ? detail.specialtyLabel
    : `Specialty: ${detail.specialtyLabel}`;
  const outcomeQuery = new URLSearchParams({
    lesson: detail.sectionLabel,
    specialty: specialtyDisplay,
    instructor: detail.submittedByName,
    program: detail.program.name,
  }).toString();

  function approveAndPublish() {
    startTransition(async () => {
      setError(null);
      const result = await approveAndPublishRequestAction(detail.requestId);
      if (!result.ok) {
        setError(result.message || "This section could not be approved.");
        return;
      }
      router.push(`${outcomeBase}/published?${outcomeQuery}`);
    });
  }

  function sendChanges() {
    startTransition(async () => {
      setError(null);
      const result = await reviewPublishRequestAction({
        requestId: detail.requestId,
        decision: "rejected",
        notes: feedback,
      });
      if (!result.ok) {
        setError(result.message || "Feedback could not be sent.");
        return;
      }
      setShowModal(false);
      router.push(`${outcomeBase}/returned?${outcomeQuery}`);
    });
  }

  if (!isAwaitingReview) return null;

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={isSubmitting} onClick={() => setShowModal(true)}>
          Request changes
        </Button>
        <Button
          variant="primary"
          disabled={isSubmitting || !allChecked}
          onClick={approveAndPublish}
        >
          {isSubmitting ? "Publishing…" : "Approve & publish"}
        </Button>
      </div>
      {error ? (
        <p className="max-w-sm text-[13px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : !allChecked ? (
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Confirm the checklist to approve
        </p>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/30"
            onClick={() => !isSubmitting && setShowModal(false)}
          />
          <div
            className="relative w-full max-w-lg rounded-[12px] bg-surface p-6 shadow-[0_20px_60px_rgba(15,15,15,.12)]"
            style={{ border: "1px solid var(--border)" }}
            role="dialog"
            aria-labelledby="request-changes-title"
          >
            <h2 id="request-changes-title" className="text-[18px] font-semibold tracking-[-0.2px]">
              Request changes
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {detail.submittedByName} will get this feedback and full editing access to the flagged
              section is reopened.
            </p>
            <div
              className="mt-4 rounded-[8px] px-3 py-2.5 text-[14px]"
              style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
            >
              {detail.module.index}.{detail.lesson.index} {detail.lesson.title}
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-medium">Feedback for the instructor</span>
              <textarea
                value={feedback}
                maxLength={NOTES_MAX}
                rows={4}
                disabled={isSubmitting}
                placeholder="e.g. Please add a source citation for the 183-day rule and shorten the second paragraph."
                className="w-full rounded-[8px] border bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-[rgba(55,53,47,0.38)]"
                style={{ borderColor: "var(--border-strong)" }}
                onChange={(event) => setFeedback(event.target.value)}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" disabled={isSubmitting} onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={isSubmitting || !feedback.trim()}
                onClick={sendChanges}
              >
                {isSubmitting ? "Sending…" : "Send to instructor"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

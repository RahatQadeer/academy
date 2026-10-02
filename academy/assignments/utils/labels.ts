import type { AcademyAssignmentSubmissionStatus } from "@/academy/lib/domain";
import type { LearnerAssignmentState } from "../types";

export function learnerAssignmentState(
  status: AcademyAssignmentSubmissionStatus | null | undefined,
): LearnerAssignmentState {
  if (!status) return "not_started";
  if (status === "draft") return "in_progress";
  if (status === "submitted") return "pending_review";
  if (status === "graded") return "graded";
  return "needs_resubmission";
}

export function assignmentStateLabel(state: LearnerAssignmentState): string {
  if (state === "not_started") return "Not started";
  if (state === "in_progress") return "In progress";
  if (state === "pending_review") return "Submitted — pending review";
  if (state === "graded") return "Reviewed / graded";
  return "Needs resubmission";
}

export function assignmentQueueStatusLabel(status: AcademyAssignmentSubmissionStatus): string {
  if (status === "draft") return "Draft";
  if (status === "submitted") return "Pending review";
  if (status === "graded") return "Reviewed";
  return "Resubmission required";
}

export function assignmentStateTone(
  state: LearnerAssignmentState,
): "neutral" | "info" | "warning" | "success" | "danger" {
  if (state === "not_started") return "neutral";
  if (state === "in_progress") return "info";
  if (state === "pending_review") return "warning";
  if (state === "graded") return "success";
  return "danger";
}

export function assignmentQueueTone(
  status: AcademyAssignmentSubmissionStatus,
): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "draft") return "neutral";
  if (status === "submitted") return "warning";
  if (status === "graded") return "success";
  return "danger";
}

export function formatAssignmentDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatAssignmentScore(score: number | null, maxScore: number): string {
  if (score == null) return "—";
  const rounded = Number.isInteger(score) ? String(score) : score.toFixed(1);
  const max = Number.isInteger(maxScore) ? String(maxScore) : maxScore.toFixed(1);
  return `${rounded} / ${max}`;
}

export function assignmentActionMessage(reason: string): string {
  if (reason === "unauthenticated") return "Sign in to continue.";
  if (reason === "no_academy_access") return "Academy access is required.";
  if (reason === "no_learner_capability") return "Learner access is required.";
  if (reason === "no_enrollment") return "You can only submit work in programs you are enrolled in.";
  if (reason === "already_submitted") {
    return "This assignment is already submitted. Wait for instructor review, or resubmit if requested.";
  }
  if (reason === "empty") return "Add a written response or attach a file before submitting.";
  if (reason === "invalid_file") return "That file could not be attached. Try a PDF, Word document, or image under 20 MB.";
  if (reason === "unauthorized") return "You are not authorized to review this submission.";
  if (reason === "invalid_score") return "Enter a score between 0 and the maximum marks.";
  if (reason === "feedback_required") return "Include feedback when requesting a resubmission.";
  if (reason === "not_ready") return "This submission is not ready for that action.";
  if (reason === "not_found") return "This assignment could not be found.";
  return "Something went wrong. Try again in a moment.";
}

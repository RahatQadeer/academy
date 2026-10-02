import type { AssignmentActionUnavailableReason } from "@/academy/assignments/types";

const REASONS = new Set<AssignmentActionUnavailableReason>([
  "unauthenticated",
  "no_academy_access",
  "no_learner_capability",
  "no_enrollment",
  "not_found",
  "already_submitted",
  "empty",
  "invalid_file",
  "unauthorized",
  "invalid_score",
  "feedback_required",
  "not_ready",
  "failed",
]);

export function asAssignmentReason(value: string | undefined): AssignmentActionUnavailableReason {
  if (value && REASONS.has(value as AssignmentActionUnavailableReason)) {
    return value as AssignmentActionUnavailableReason;
  }
  return "failed";
}

import type { AcademyAssignmentSubmissionStatus } from "@/academy/lib/domain";

export type LearnerAssignmentState =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "graded"
  | "needs_resubmission";

export type AssignmentSubmissionView = {
  id: string;
  status: AcademyAssignmentSubmissionStatus;
  learnerState: LearnerAssignmentState;
  body: string;
  fileName: string | null;
  fileUrl: string | null;
  score: number | null;
  maxScore: number;
  feedback: string;
  submittedAt: string | null;
  gradedAt: string | null;
  attemptCount: number;
};

export type AssignmentDefinitionView = {
  id: string;
  brief: string;
  submissionInstructions: string;
  rubric: string;
  estimatedMinutes: string;
};

export type AssignmentStats = {
  total: number;
  submitted: number;
  reviewed: number;
};

export type AssignmentActionUnavailableReason =
  | "unauthenticated"
  | "no_academy_access"
  | "no_learner_capability"
  | "no_enrollment"
  | "not_found"
  | "already_submitted"
  | "empty"
  | "invalid_file"
  | "unauthorized"
  | "invalid_score"
  | "feedback_required"
  | "not_ready"
  | "failed";

export type AssignmentWriteResult =
  | { status: "ok" }
  | { status: "unavailable"; reason: AssignmentActionUnavailableReason };

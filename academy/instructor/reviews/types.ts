import type { AcademyAssignmentSubmissionStatus } from "@/academy/lib/domain";

export const REVIEW_QUEUE_LIMIT = 80;

export type InstructorReviewStatusFilter =
  | "submitted"
  | "graded"
  | "resubmission_required"
  | "all";

export type InstructorReviewQueueItem = {
  id: string;
  assignmentId: string;
  lessonId: string;
  programId: string;
  userId: string;
  status: AcademyAssignmentSubmissionStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  score: number | null;
  maxScore: number;
  learnerName: string;
  learnerEmail: string | null;
  programName: string;
  lessonTitle: string;
  attemptCount: number;
};

export type InstructorReviewFilterOptions = {
  programs: { id: string; name: string }[];
  assignments: { id: string; title: string; programId: string }[];
};

export type InstructorReviewQueueData = {
  items: InstructorReviewQueueItem[];
  pendingCount: number;
  counts: Record<InstructorReviewStatusFilter, number>;
  filters: InstructorReviewFilterOptions;
  truncated: boolean;
  activeStatus: InstructorReviewStatusFilter;
};

export type InstructorReviewQueueResult =
  | { ok: true; data: InstructorReviewQueueData }
  | { ok: false; reason: "unauthorized" | "failed" };

export type InstructorReviewDetail = {
  id: string;
  assignmentId: string;
  lessonId: string;
  programId: string;
  userId: string;
  status: AcademyAssignmentSubmissionStatus;
  body: string;
  fileName: string | null;
  fileUrl: string | null;
  score: number | null;
  maxScore: number;
  feedback: string;
  attemptCount: number;
  submittedAt: string | null;
  gradedAt: string | null;
  learnerName: string;
  learnerEmail: string | null;
  programName: string;
  lessonTitle: string;
  brief: string;
  submissionInstructions: string;
  rubric: string;
};

export type InstructorReviewDetailResult =
  | { ok: true; data: InstructorReviewDetail }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" };

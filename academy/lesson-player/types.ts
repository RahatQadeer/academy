import type { AcademyLessonType, AcademyProgressStatus } from "@/academy/lib/domain";
import type { AssignmentSubmissionView } from "@/academy/assignments/types";

export type LessonPlayerUnavailableReason =
  | "no_enrollment"
  | "payment_required"
  | "not_found"
  | "unpublished"
  | "mismatch"
  | "locked"
  | "empty"
  | "failed";

export type CurriculumLesson = {
  id: string;
  title: string;
  type: AcademyLessonType;
  moduleId: string;
  moduleTitle: string;
  progressStatus: AcademyProgressStatus | null;
};

export type CurriculumModule = {
  id: string;
  title: string;
  sortOrder: number;
  lessons: CurriculumLesson[];
};

export type LessonMedia = {
  signedUrl: string | null;
  fileName: string | null;
  externalUrl: string | null;
  readingText: string | null;
  missing: boolean;
};

export type LessonResource = {
  title: string;
  resourceType: string;
  url: string;
  notes: string;
};

export type LessonAssignment = {
  id: string;
  brief: string;
  submissionInstructions: string;
  rubric: string;
  estimatedMinutes: string;
};

export type LessonRichContent = {
  contentSummary: string;
  contentBody: string;
  learningObjectives: string[];
  videoUrl: string;
  resources: LessonResource[];
  assignment: LessonAssignment | null;
};

export type LessonPlayerView = {
  programId: string;
  programName: string;
  enrollmentId: string;
  modules: CurriculumModule[];
  current: CurriculumLesson;
  previous: CurriculumLesson | null;
  next: CurriculumLesson | null;
  media: LessonMedia;
  richContent: LessonRichContent;
  assignmentSubmission: AssignmentSubmissionView | null;
};

export type LessonPlayerResult =
  | { ok: true; data: LessonPlayerView }
  | { ok: true; redirectToLessonId: string; programId: string }
  | { ok: false; reason: LessonPlayerUnavailableReason };

export type MarkLessonCompleteUnavailableReason =
  | "unauthenticated"
  | "no_academy_access"
  | "no_learner_capability"
  | "no_enrollment"
  | "payment_required"
  | "mismatch"
  | "locked"
  | "failed";

export type MarkLessonCompleteResult =
  | { status: "completed" }
  | { status: "already_completed" }
  | { status: "unavailable"; reason: MarkLessonCompleteUnavailableReason };

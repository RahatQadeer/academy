import type {
  AcademyLessonType,
  AcademyProgramStatus,
  AcademyProgramType,
  AcademyPublishRequestStatus,
} from "@/academy/lib/domain";

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const NOTES_MAX = 2000;
export const QUEUE_LIMIT = 48;

export type AdminDashboardProgramRow = {
  id: string;
  name: string;
  status: AcademyProgramStatus;
  updatedLabel: string;
};

export type AdminDashboardEnrollmentRow = {
  id: string;
  programId: string;
  learnerName: string;
  programName: string;
  status: "enrolled" | "in_progress" | "completed";
  enrolledLabel: string;
};

export type AdminDashboardData = {
  pendingCount: number;
  credentialReviewCount: number;
  instructorCount: number;
  suspendedInstructorCount: number;
  adminCount: number;
  suspendedAdminCount: number;
  learnerCount: number;
  /** Active Academy Super Admins (membership role). */
  superAdminCount: number;
  suspendedLearnerCount: number;
  /** All suspended academy_memberships rows (any role). */
  suspendedMembershipTotal: number;
  enrollmentCount: number;
  enrollmentActiveCount: number;
  enrollmentCompletedCount: number;
  programTotal: number;
  programPublished: number;
  programDraft: number;
  programPendingApproval: number;
  recentPrograms: AdminDashboardProgramRow[];
  recentEnrollments: AdminDashboardEnrollmentRow[];
};

export type AdminDashboardResult =
  | { ok: true; data: AdminDashboardData }
  | { ok: false; reason: "unauthorized" | "failed" };

export type QueueStatusFilter = "pending" | "ready" | "published" | "returned";

export type ApprovalQueueItem = {
  id: string;
  programId: string;
  programName: string;
  programType: AcademyProgramType;
  category: string;
  programStatus: AcademyProgramStatus;
  submittedByName: string;
  submittedAt: string;
  publishedAt: string | null;
  status: AcademyPublishRequestStatus;
};

export type ApprovalQueueData = {
  filter: QueueStatusFilter;
  items: ApprovalQueueItem[];
  truncated: boolean;
  counts: Record<QueueStatusFilter, number>;
};

export type ApprovalQueueResult =
  | { ok: true; data: ApprovalQueueData }
  | { ok: false; reason: "unauthorized" | "failed" };

export type ReviewLessonState = "unchanged" | "changed" | "out_of_scope";

export type ReviewLesson = {
  id: string;
  title: string;
  type: string;
  hasQuiz: boolean;
  reviewState: ReviewLessonState;
};

export type ReviewModule = {
  id: string;
  title: string;
  lessons: ReviewLesson[];
  inScope: boolean;
};

export type InstructorRecentActivity = {
  id: string;
  title: string;
  detail: string;
};

export type ApprovalSectionReviewDetail = {
  requestId: string;
  status: AcademyPublishRequestStatus;
  submittedByName: string;
  submittedAt: string;
  scopeLabel: string;
  sectionLabel: string;
  specialtyLabel: string;
  contentHeader: string;
  program: {
    id: string;
    name: string;
    category: string;
    type: AcademyProgramType;
  };
  module: {
    id: string;
    index: number;
    title: string;
  };
  lesson: {
    id: string;
    index: number;
    title: string;
    type: AcademyLessonType;
    contentBody: string;
    contentSummary: string;
    learningObjectives: string[];
    videoUrl: string;
    resources: {
      id: string;
      title: string;
      resourceType: string;
      url: string;
      notes: string;
      sortOrder: number;
    }[];
    assignment: {
      id: string;
      brief: string;
      submissionInstructions: string;
      rubric: string;
      estimatedMinutes: string;
    } | null;
    quizQuestionCount: number;
  };
  adjacent: {
    previous: { id: string; label: string } | null;
    next: { id: string; label: string } | null;
  };
};

export type ApprovalRequestDetail = {
  id: string;
  status: AcademyPublishRequestStatus;
  notes: string | null;
  submittedByName: string;
  submittedByUserId: string;
  submittedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  enrollmentCount: number;
  sectionsChanged: number;
  sectionsTotal: number;
  recentActivity: InstructorRecentActivity[];
  program: {
    id: string;
    name: string;
    description: string;
    type: AcademyProgramType;
    category: string;
    price: string;
    status: AcademyProgramStatus;
    prerequisiteName: string | null;
  };
  modules: ReviewModule[];
};

export type ApprovalRequestResult =
  | { ok: true; data: ApprovalRequestDetail }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" };

export type ReviewDecision = "approved" | "rejected";

export type ReviewPublishRequestInput = {
  requestId: string;
  decision: ReviewDecision;
  notes?: string;
};

export type ReviewPublishRequestResult =
  | { ok: true; status: ReviewDecision; programId: string }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "already_reviewed" | "not_found" | "failed";
      message?: string;
    };

export const ACADEMY_PROGRAM_TYPES = [
  "short_course",
  "course",
  "certification_program",
  "endorsement_program",
] as const;

export type AcademyProgramType = (typeof ACADEMY_PROGRAM_TYPES)[number];

export function isAcademyProgramType(value: string): value is AcademyProgramType {
  return (ACADEMY_PROGRAM_TYPES as readonly string[]).includes(value);
}

/** @deprecated Legacy values — use normalizeLegacyProgramType when reading unpublished drafts. */
export const LEGACY_ACADEMY_PROGRAM_TYPES = [
  "cpa",
  "professional_practice_accelerator",
  "specialty_endorsement",
  "intelligent_coordination",
  "free_course",
  "paid_course",
] as const;

export const ACADEMY_COURSE_ACCESS = [
  "free",
  "standard_plus",
  "professional_plus",
  "teams_plus",
  "purchased",
  "organization_assigned",
] as const;

export type AcademyCourseAccess = (typeof ACADEMY_COURSE_ACCESS)[number];

export function isAcademyCourseAccess(value: string): value is AcademyCourseAccess {
  return (ACADEMY_COURSE_ACCESS as readonly string[]).includes(value);
}

export const ACADEMY_COURSE_RECOGNITION = [
  "none",
  "certificate_of_completion",
  "professional_certification",
  "specialty_endorsement",
] as const;

export type AcademyCourseRecognition = (typeof ACADEMY_COURSE_RECOGNITION)[number];

export function isAcademyCourseRecognition(value: string): value is AcademyCourseRecognition {
  return (ACADEMY_COURSE_RECOGNITION as readonly string[]).includes(value);
}

export const ACADEMY_LEARNING_PATHS = [
  "whitby",
  "business_and_practice",
  "specialty",
  "certification",
  "organization_training",
] as const;

export type AcademyLearningPath = (typeof ACADEMY_LEARNING_PATHS)[number];

export function isAcademyLearningPath(value: string): value is AcademyLearningPath {
  return (ACADEMY_LEARNING_PATHS as readonly string[]).includes(value);
}

/** Certificate term configured on the program (course settings). */
export const ACADEMY_CREDENTIAL_VALIDITIES = ["none", "three_years"] as const;

export type AcademyCredentialValidity = (typeof ACADEMY_CREDENTIAL_VALIDITIES)[number];

export function isAcademyCredentialValidity(value: string): value is AcademyCredentialValidity {
  return (ACADEMY_CREDENTIAL_VALIDITIES as readonly string[]).includes(value);
}

export type AcademyProgramStatus = "draft" | "pending_approval" | "published";

export type AcademyAssignmentPermission = "edit" | "create";

export const ACADEMY_ASSIGNMENT_PERMISSIONS = ["edit", "create"] as const;

export function isAcademyAssignmentPermission(
  value: string,
): value is AcademyAssignmentPermission {
  return (ACADEMY_ASSIGNMENT_PERMISSIONS as readonly string[]).includes(value);
}

export type AcademyInstructorAssignment = {
  id: string;
  user_id: string;
  program_id: string;
  permission_level: AcademyAssignmentPermission;
  can_publish_without_approval: boolean;
  assigned_by_admin_user_id: string | null;
  created_at: string;
};

export type AcademyPublishRequestStatus = "pending" | "approved" | "rejected";

export const ACADEMY_PUBLISH_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export function isAcademyPublishRequestStatus(
  value: string,
): value is AcademyPublishRequestStatus {
  return (ACADEMY_PUBLISH_REQUEST_STATUSES as readonly string[]).includes(value);
}

export type AcademyPublishRequest = {
  id: string;
  program_id: string;
  submitted_by_user_id: string;
  status: AcademyPublishRequestStatus;
  reviewed_by_admin_user_id: string | null;
  reviewed_at: string | null;
  notes: string | null;
  published_by_user_id: string | null;
  published_at: string | null;
  created_at: string;
};

export type AcademyEnrollmentStatus = "enrolled" | "in_progress" | "completed";

export const ACADEMY_ENROLLMENT_STATUSES = ["enrolled", "in_progress", "completed"] as const;

/** Learners currently in the program — completed records still block deletion. */
export const ACTIVE_ACADEMY_ENROLLMENT_STATUSES = ["enrolled", "in_progress"] as const;

export function isAcademyEnrollmentStatus(value: string): value is AcademyEnrollmentStatus {
  return (ACADEMY_ENROLLMENT_STATUSES as readonly string[]).includes(value);
}

export type AcademyProgressStatus = "locked" | "in_progress" | "completed";

export type AcademyTrainingStatus = "active" | "expired";

export type AcademyCredentialType =
  | "cpa_credential"
  | "specialty_endorsement"
  | "certificate_of_completion";

export type AcademyCredentialStatus =
  | "required_learning"
  | "applied_work"
  | "final_assessment"
  | "credential_review"
  | "awarded";

export type AcademyCredential = {
  id: string;
  user_id: string;
  program_id: string;
  type: AcademyCredentialType;
  status: AcademyCredentialStatus;
  awarded_at: string | null;
  expires_at: string | null;
  renewal_status: string | null;
};

export type AcademyProgram = {
  id: string;
  name: string;
  type: AcademyProgramType;
  access: AcademyCourseAccess;
  recognition: AcademyCourseRecognition;
  learning_path: AcademyLearningPath;
  credential_validity: AcademyCredentialValidity;
  category: string | null;
  prerequisite_program_id: string | null;
  price: number | null;
  status: AcademyProgramStatus;
  description: string | null;
};

export type AcademyEntitlementSource =
  | "purchase"
  | "free"
  | "admin_assigned"
  | "prerequisite_met";

export const ACADEMY_ENTITLEMENT_SOURCES = [
  "purchase",
  "free",
  "admin_assigned",
  "prerequisite_met",
] as const;

export function isAcademyEntitlementSource(value: string): value is AcademyEntitlementSource {
  return (ACADEMY_ENTITLEMENT_SOURCES as readonly string[]).includes(value);
}

export type AcademyEnrollment = {
  id: string;
  user_id: string;
  program_id: string;
  status: AcademyEnrollmentStatus;
  progress_percent: number;
  entitlement_source: AcademyEntitlementSource | null;
  enrolled_at: string;
  completed_at: string | null;
};

export type AcademyModule = {
  id: string;
  program_id: string;
  title: string;
  sort_order: number;
};

export type AcademyLessonType =
  | "video"
  | "reading"
  | "attachment"
  | "quiz"
  | "scenario"
  | "resource"
  | "assignment";

export const ACADEMY_LESSON_TYPES = [
  "video",
  "reading",
  "attachment",
  "quiz",
  "scenario",
  "resource",
  "assignment",
] as const;

export function isAcademyLessonType(value: string): value is AcademyLessonType {
  return (ACADEMY_LESSON_TYPES as readonly string[]).includes(value);
}

export type AcademyLesson = {
  id: string;
  module_id: string;
  title: string;
  type: AcademyLessonType;
  content_url: string | null;
  content_body: string | null;
  content_summary: string | null;
  learning_objectives: string[];
  video_url: string | null;
  sort_order: number;
};

export type AcademyLessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: string;
  url: string | null;
  notes: string | null;
  sort_order: number;
};

export type AcademyAssignment = {
  id: string;
  lesson_id: string;
  brief: string;
  submission_instructions: string;
  rubric: string;
  estimated_minutes: number | null;
};

export const ACADEMY_ASSIGNMENT_SUBMISSION_STATUSES = [
  "draft",
  "submitted",
  "graded",
  "resubmission_required",
] as const;

export type AcademyAssignmentSubmissionStatus =
  (typeof ACADEMY_ASSIGNMENT_SUBMISSION_STATUSES)[number];

export function isAcademyAssignmentSubmissionStatus(
  value: string,
): value is AcademyAssignmentSubmissionStatus {
  return (ACADEMY_ASSIGNMENT_SUBMISSION_STATUSES as readonly string[]).includes(value);
}

export type AcademyAssignmentSubmission = {
  id: string;
  assignment_id: string;
  lesson_id: string;
  program_id: string;
  enrollment_id: string;
  user_id: string;
  status: AcademyAssignmentSubmissionStatus;
  body: string;
  file_storage_path: string | null;
  file_name: string | null;
  score: number | null;
  max_score: number;
  feedback: string;
  attempt_count: number;
  submitted_at: string | null;
  graded_at: string | null;
  graded_by_user_id: string | null;
};

export const ACADEMY_QUESTION_TYPES = ["multiple_choice", "true_false"] as const;

export type AcademyQuestionType = (typeof ACADEMY_QUESTION_TYPES)[number];

export function isAcademyQuestionType(value: string): value is AcademyQuestionType {
  return (ACADEMY_QUESTION_TYPES as readonly string[]).includes(value);
}

export type AcademyQuestionOption = {
  id: string;
  label: string;
};

export type AcademyQuiz = {
  id: string;
  lesson_id: string;
  passing_score: number;
};

export type AcademyQuestion = {
  id: string;
  quiz_id: string;
  question_text: string;
  type: AcademyQuestionType;
  options: AcademyQuestionOption[] | null;
  correct_answer: string | null;
  sort_order: number;
};

export type AcademyLessonProgress = {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  status: AcademyProgressStatus;
  completed_at: string | null;
};

export type AcademyTrainingWorkspace = {
  id: string;
  user_id: string;
  workspace_id: string;
  program_id: string;
  provisioned_at: string;
  expires_at: string;
  status: AcademyTrainingStatus;
  converted_to_paid_at: string | null;
};

const PROGRAM_TYPE_LABELS: Record<AcademyProgramType, string> = {
  short_course: "Short Course",
  course: "Course",
  certification_program: "Certification Program",
  endorsement_program: "Specialty Endorsement",
};

const COURSE_ACCESS_LABELS: Record<AcademyCourseAccess, string> = {
  free: "Free",
  standard_plus: "Standard+",
  professional_plus: "Professional+",
  teams_plus: "Teams+",
  purchased: "Paid",
  organization_assigned: "Organization Assigned",
};

const COURSE_RECOGNITION_LABELS: Record<AcademyCourseRecognition, string> = {
  none: "None",
  certificate_of_completion: "Certificate of Completion",
  professional_certification: "Professional Credential",
  specialty_endorsement: "Specialty Endorsement",
};

const LEARNING_PATH_LABELS: Record<AcademyLearningPath, string> = {
  whitby: "Whitby",
  business_and_practice: "Business & Practice",
  specialty: "Specialty",
  certification: "Certification",
  organization_training: "Organization Training",
};

const CREDENTIAL_VALIDITY_LABELS: Record<AcademyCredentialValidity, string> = {
  none: "Does not expire",
  three_years: "3 years",
};

export function programTypeLabel(type: AcademyProgramType | string) {
  return PROGRAM_TYPE_LABELS[type as AcademyProgramType] ?? type;
}

export function courseAccessLabel(access: AcademyCourseAccess | string) {
  return COURSE_ACCESS_LABELS[access as AcademyCourseAccess] ?? access;
}

export function courseRecognitionLabel(recognition: AcademyCourseRecognition | string) {
  return COURSE_RECOGNITION_LABELS[recognition as AcademyCourseRecognition] ?? recognition;
}

export function learningPathLabel(path: AcademyLearningPath | string) {
  return LEARNING_PATH_LABELS[path as AcademyLearningPath] ?? path;
}

export function credentialValidityLabel(validity: AcademyCredentialValidity | string) {
  return CREDENTIAL_VALIDITY_LABELS[validity as AcademyCredentialValidity] ?? validity;
}

/** Recognition label for a program — prefers explicit recognition, falls back by type. */
export function programRecognitionLabel(
  typeOrRecognition: AcademyProgramType | AcademyCourseRecognition | string,
) {
  if (isAcademyCourseRecognition(typeOrRecognition)) {
    return courseRecognitionLabel(typeOrRecognition);
  }
  if (typeOrRecognition === "certification_program") return COURSE_RECOGNITION_LABELS.professional_certification;
  if (typeOrRecognition === "endorsement_program") return COURSE_RECOGNITION_LABELS.specialty_endorsement;
  return COURSE_RECOGNITION_LABELS.certificate_of_completion;
}

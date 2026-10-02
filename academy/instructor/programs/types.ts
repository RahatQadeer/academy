import type {
  AcademyCourseAccess,
  AcademyCourseRecognition,
  AcademyCredentialValidity,
  AcademyLearningPath,
  AcademyLessonType,
  AcademyProgramStatus,
  AcademyProgramType,
  AcademyPublishRequestStatus,
} from "@/academy/lib/domain";

export type PrerequisiteOption = {
  id: string;
  name: string;
};

export type EditorLessonResource = {
  id: string;
  title: string;
  resourceType: string;
  url: string;
  notes: string;
  sortOrder: number;
};

export type EditorAssignment = {
  id: string;
  brief: string;
  submissionInstructions: string;
  rubric: string;
  estimatedMinutes: string;
};

export type EditorQuizQuestion = {
  id: string;
  questionText: string;
  type: "multiple_choice" | "true_false";
  options: string[];
  correctAnswer: string;
  sortOrder: number;
  fromBank?: boolean;
};

export type EditorQuiz = {
  id: string;
  passingScore: string;
  questions: EditorQuizQuestion[];
};

export type EditorLesson = {
  id: string;
  title: string;
  type: AcademyLessonType;
  contentUrl: string;
  contentBody: string;
  contentSummary: string;
  learningObjectives: string[];
  videoUrl: string;
  videoDurationSeconds: number;
  sortOrder: number;
  resources: EditorLessonResource[];
  assignment: EditorAssignment | null;
  quiz: EditorQuiz | null;
  quizId: string | null;
};

export type EditorModule = {
  id: string;
  title: string;
  sortOrder: number;
  lessons: EditorLesson[];
};

export type EditorProgram = {
  id: string;
  name: string;
  type: AcademyProgramType;
  access: AcademyCourseAccess;
  recognition: AcademyCourseRecognition;
  learningPath: AcademyLearningPath;
  credentialValidity: AcademyCredentialValidity;
  category: string;
  description: string;
  prerequisiteProgramId: string;
  price: string;
  /** Course topic tag ids (exactly 3). */
  tagIds: string[];
  status: AcademyProgramStatus;
  updatedAt: string;
  createdByUserId: string | null;
  coverImageUrl: string;
  modules: EditorModule[];
  latestRequestStatus: AcademyPublishRequestStatus | null;
  latestRequestAt: string | null;
  prerequisites: PrerequisiteOption[];
  assignmentScope: {
    permissionLevel: "edit" | "create";
    moduleIds: string[];
    scopedModuleTitles: string[];
    canPublishWithoutApproval: boolean;
  } | null;
  canPublishWithoutApproval: boolean;
  /** Published program has staged edits not yet live for learners. */
  hasUnpublishedChanges?: boolean;
};

export type ProgramEditorLoadResult =
  | { ok: true; data: EditorProgram }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" };

export type CreateProgramInput = {
  name: string;
  type: string;
  category: string;
  description: string;
  prerequisiteProgramId: string;
  price: string;
  /** Course topic tag ids (exactly 3 required). */
  tagIds: string[];
};

export type CreateProgramResult =
  | { ok: true; programId: string }
  | { ok: false; reason: "unauthorized" | "invalid" | "failed"; message?: string };

export type SaveProgramDraftLessonInput = {
  id: string | null;
  title: string;
  type: string;
  contentUrl: string;
  contentBody: string;
  contentSummary: string;
  learningObjectives: string[];
  videoUrl: string;
  videoDurationSeconds: number;
  resources: {
    id: string | null;
    title: string;
    resourceType: string;
    url: string;
    notes: string;
  }[];
  assignment: {
    brief: string;
    submissionInstructions: string;
    rubric: string;
    estimatedMinutes: string;
  } | null;
  quiz: {
    passingScore: string;
    questions: {
      id: string | null;
      questionText: string;
      type: "multiple_choice" | "true_false";
      options: string[];
      correctAnswer: string;
      fromBank?: boolean;
    }[];
  } | null;
};

export type SaveProgramDraftInput = {
  programId: string;
  name: string;
  type: string;
  access: string;
  recognition: string;
  learningPath: string;
  credentialValidity: string;
  category: string;
  description: string;
  prerequisiteProgramId: string;
  price: string;
  coverImageUrl?: string;
  /** Course topic tag ids (exactly 3). */
  tagIds?: string[];
  modules: {
    id: string | null;
    title: string;
    lessons: SaveProgramDraftLessonInput[];
  }[];
};

export type SaveProgramDraftResult =
  | { ok: true; data?: EditorProgram; approvalWithdrawn?: boolean }
  | { ok: false; reason: "unauthorized" | "invalid" | "published" | "failed"; message?: string };

export type SubmitPublishResult =
  | { ok: true; status: "pending" | "already_pending" }
  | { ok: false; reason: "unauthorized" | "published" | "invalid" | "failed"; message?: string };

export type SaveProgramCoverResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "published" | "failed"; message?: string };

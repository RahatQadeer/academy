export type CatalogLessonResource = {
  id: string;
  title: string;
  resourceType: string;
  url: string;
  notes: string;
  sortOrder: number;
};

export type CatalogAssignment = {
  id: string;
  brief: string;
  submissionInstructions: string;
  rubric: string;
  estimatedMinutes: string;
};

export type CatalogQuizQuestion = {
  id: string;
  questionText: string;
  type: "multiple_choice" | "true_false";
  options: string[];
  correctAnswer: string;
  sortOrder: number;
  /** Authoring-only: added from the question bank. Never shown to learners. */
  fromBank?: boolean;
};

export type CatalogQuiz = {
  id: string;
  passingScore: string;
  questions: CatalogQuizQuestion[];
};

export type CatalogLesson = {
  id: string;
  title: string;
  type:
    | "reading"
    | "video"
    | "attachment"
    | "quiz"
    | "scenario"
    | "resource"
    | "assignment";
  contentUrl: string;
  contentBody: string;
  contentSummary: string;
  learningObjectives: string[];
  videoUrl: string;
  videoDurationSeconds: number;
  sortOrder: number;
  resources: CatalogLessonResource[];
  assignment: CatalogAssignment | null;
  quiz: CatalogQuiz | null;
};

export type CatalogModule = {
  id: string;
  title: string;
  sortOrder: number;
  lessons: CatalogLesson[];
};

export type CatalogProgramDetail = {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  access: string;
  recognition: string;
  learningPath: string;
  /** Certificate term: none | three_years */
  credentialValidity: string;
  price: string;
  prerequisiteProgramId: string;
  prerequisites: { id: string; name: string }[];
  status: "draft" | "pending_approval" | "published";
  enrollmentCount: number;
  activeEnrollmentCount: number;
  coverImageUrl: string;
  modules: CatalogModule[];
  /** Course topic tag ids (exactly 3). */
  tagIds?: string[];
  latestRequestStatus?: "pending" | "approved" | "rejected" | null;
  canPublishWithoutApproval?: boolean;
  /** Published program has staged edits not yet live for learners. */
  hasUnpublishedChanges?: boolean;
};

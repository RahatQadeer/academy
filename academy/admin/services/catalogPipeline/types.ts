import "server-only";

export type CatalogDifficulty = "beginner" | "intermediate" | "advanced";
export type CatalogLessonKind =
  | "reading"
  | "scenario"
  | "assignment"
  | "quiz"
  | "video"
  | "resource";

export type CatalogGenerationRequest = {
  prompt: string;
  length: string;
  difficulty: string;
  type: string;
  moduleCount: number;
  programType: string;
  attachments?: { name: string; content: string; kind?: string; pageCount?: number }[];
  source?: SourceKnowledge;
};

export type SourceExcerpt = {
  topic: string;
  excerpt: string;
};

export type SourceKnowledge = {
  hasSource: boolean;
  fileNames: string[];
  pageCount: number;
  headingCount: number;
  subjectHint: string;
  headings: string[];
  concepts: string[];
  details: string[];
  consolidated: string;
  fullText?: string;
  excerpts: SourceExcerpt[];
  usedChunking: boolean;
};

export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: 2 | 3 }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "callout"; variant: "info" | "tip" | "warning" | "key-concept"; title?: string; text: string }
  | { type: "example"; title: string; scenario: string; walkthrough: string[]; outcome?: string }
  | { type: "steps"; title?: string; steps: { title: string; detail: string }[] }
  | { type: "table"; caption?: string; headers: string[]; rows: string[][] }
  | { type: "code"; language: string; code: string; caption?: string };

export type Blueprint = {
  title: string;
  subtitle: string;
  description: string;
  audience: string;
  difficulty: CatalogDifficulty;
  prerequisites: string[];
  estimatedHours: number;
  domainAnalysis: string;
  inScope: string[];
  outOfScope: string[];
};

export type Objectives = {
  learningObjectives: string[];
  outcomes: string[];
};

export type ModulePlan = {
  title: string;
  description: string;
  learningObjectives: string[];
  lessonCount: number;
  focus: string;
};

export type LessonPlan = {
  title: string;
  summary: string;
  lessonKind: CatalogLessonKind;
  learningObjectives: string[];
  durationMinutes: number;
  outline: string[];
};

export type PipelineLesson = {
  title: string;
  summary: string;
  lessonKind: CatalogLessonKind;
  learningObjectives: string[];
  durationMinutes: number;
  outline: string[];
  introduction: string;
  contentBody: string;
  contentSummary: string;
  resources: { title: string; resourceType: string; url: string; notes: string }[];
  assignment: {
    brief: string;
    submissionInstructions: string;
    rubric: string;
    estimatedMinutes: string;
  } | null;
  quiz: {
    passingScore: string;
    questions: {
      questionText: string;
      type: "multiple_choice" | "true_false";
      options: string[];
      correctAnswer: string;
    }[];
  } | null;
};

export type PipelineModule = {
  title: string;
  description: string;
  learningObjectives: string[];
  lessons: PipelineLesson[];
};

export type PipelineCourse = {
  name: string;
  description: string;
  category: string;
  type: string;
  learningObjectives: string[];
  outcomes: string[];
  modules: PipelineModule[];
};

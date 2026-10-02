import type { AcademyProgramStatus, AcademyQuestionType } from "@/academy/lib/domain";

export const QUESTION_BANK_PAGE_SIZE = 25;

export type QuestionBankStatusFilter = "all" | "in_quiz" | "custom";

export type QuestionBankQuestionType =
  | AcademyQuestionType
  | "exercise"
  | "assignment"
  | "other";

export type QuestionBankFilters = {
  search: string;
  type: QuestionBankQuestionType | "all";
  programId: string;
  moduleId: string;
  status: QuestionBankStatusFilter;
  page: number;
};

export type QuestionBankFilterOptions = {
  programs: { id: string; name: string; questionCount?: number }[];
  modules: { id: string; title: string; programId: string }[];
};

export type QuestionBankItem = {
  id: string;
  questionText: string;
  type: QuestionBankQuestionType;
  correctAnswer: string;
  optionCount: number;
  programId: string;
  programName: string;
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonType: string | null;
  quizId: string | null;
  sortOrder: number;
  inUse: boolean;
  custom: boolean;
};

export type QuestionBankSummary = {
  total: number;
  multipleChoice: number;
  trueFalse: number;
  exercise: number;
  assignment: number;
  other: number;
  custom: number;
  programCount: number;
};

export type QuestionBankData = {
  items: QuestionBankItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: QuestionBankSummary;
  filters: QuestionBankFilterOptions;
  activeFilters: QuestionBankFilters;
};

export type QuestionBankLoadResult =
  | { ok: true; data: QuestionBankData }
  | { ok: false; reason: "unauthorized" | "failed" };

export type QuestionBankCourseGroup = {
  programId: string;
  programName: string;
  lessons: {
    key: string;
    moduleId: string;
    moduleTitle: string;
    lessonId: string;
    lessonTitle: string;
    lessonType: string | null;
    items: QuestionBankItem[];
  }[];
};

export function groupQuestionBankByCourse(items: QuestionBankItem[]): QuestionBankCourseGroup[] {
  const courses: QuestionBankCourseGroup[] = [];
  const courseIndex = new Map<string, QuestionBankCourseGroup>();

  for (const item of items) {
    let course = courseIndex.get(item.programId);
    if (!course) {
      course = {
        programId: item.programId,
        programName: item.programName,
        lessons: [],
      };
      courseIndex.set(item.programId, course);
      courses.push(course);
    }

    const lessonKey = `${item.moduleId}:${item.lessonId}`;
    let lesson = course.lessons.find((entry) => entry.key === lessonKey);
    if (!lesson) {
      lesson = {
        key: lessonKey,
        moduleId: item.moduleId,
        moduleTitle: item.moduleTitle,
        lessonId: item.lessonId,
        lessonTitle: item.lessonTitle,
        lessonType: item.lessonType,
        items: [],
      };
      course.lessons.push(lesson);
    }
    lesson.items.push(item);
  }

  return courses;
}

export function questionBankTypeLabel(type: QuestionBankQuestionType | "all") {
  if (type === "multiple_choice") return "Multiple choice";
  if (type === "true_false") return "True / false";
  if (type === "exercise") return "Lesson exercise";
  if (type === "assignment") return "Open answer";
  if (type === "other") return "Other";
  return "All types";
}

export type QuestionBankAuthorScope = "admin" | "instructor";

export type QuestionBankQuizTarget = {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  quizId: string | null;
  questionCount: number;
};

export type QuestionBankAssignmentTarget = {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  assignmentId: string | null;
};

export type QuestionBankProgramTarget = {
  id: string;
  name: string;
  status: AcademyProgramStatus;
  locked: boolean;
  builderHref: string;
  quizzes: QuestionBankQuizTarget[];
  assignments: QuestionBankAssignmentTarget[];
};

export type AuthoringBankQuestion = {
  id: string;
  questionText: string;
  type: "multiple_choice" | "true_false" | "assignment" | "exercise" | "other";
  options: { id: string; label: string }[];
  correctAnswer: string;
  programId: string;
  programName: string;
  moduleTitle: string;
  lessonTitle: string;
  lessonId: string;
};

export type AppendManualQuestionInput = {
  programId: string;
  questionText: string;
  type: string;
  options: { id: string; label: string }[];
  correctAnswer: string;
};

export type AppendManualQuestionResult =
  | { ok: true; questionId: string }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "published" | "failed";
      message: string;
    };

export type CopyBankQuestionsInput = {
  programId: string;
  lessonId: string;
  questionIds: string[];
};

export type CopyBankQuestionsResult =
  | { ok: true; added: number; skipped: number; questionCount: number }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "published" | "full" | "no_quiz" | "failed";
      message: string;
    };

export type AppendAssignmentPromptInput = {
  programId: string;
  lessonId: string;
  /** Single prompt (legacy). Prefer `prompts` for batching. */
  prompt?: string;
  prompts?: string[];
};

export type AppendAssignmentPromptResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "published" | "no_assignment" | "failed";
      message: string;
    };

export type DeleteCustomBankQuestionResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "failed";
      message: string;
    };

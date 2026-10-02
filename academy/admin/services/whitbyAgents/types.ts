import type { PersistedLesson, PersistedModule, PersistedProgramDraft } from "../catalogPersistence";

export type WhitbyIntent =
  | "add_lessons"
  | "add_module"
  | "add_quiz"
  | "expand_quiz"
  | "add_assignment"
  | "add_video"
  | "edit_lesson"
  | "edit_overview"
  | "remove_lesson"
  | "remove_module"
  | "remove_assignment"
  | "rename_item"
  | "embed_content"
  | "answer"
  | "rewrite_program";

export const KNOWN_WHITBY_INTENTS: WhitbyIntent[] = [
  "add_lessons",
  "add_module",
  "add_quiz",
  "expand_quiz",
  "add_assignment",
  "add_video",
  "edit_lesson",
  "edit_overview",
  "remove_lesson",
  "remove_module",
  "remove_assignment",
  "rename_item",
  "embed_content",
  "answer",
  "rewrite_program",
];

export type WhitbyPlan = {
  intents: WhitbyIntent[];
  count: number;
  moduleIndex: number | null;
  lessonIndex: number | null;
  notes: string;
  videoUrl: string | null;
  lessonType?: PersistedLesson["type"];
  /** attach = put assignment on an existing lesson; insert = new assignment lesson */
  mode?: "attach" | "insert";
};

export type WhitbyQuestion = {
  questionText: string;
  type: "multiple_choice" | "true_false";
  options: string[];
  correctAnswer: string;
};

export type WhitbyOp =
  | {
      kind: "set_overview";
      name?: string;
      description?: string;
      category?: string;
      type?: string;
    }
  | { kind: "replace_lesson"; moduleIndex: number; lessonIndex: number; lesson: PersistedLesson }
  | { kind: "append_lessons"; moduleIndex: number; lessons: PersistedLesson[] }
  | {
      kind: "insert_lessons";
      moduleIndex: number;
      afterIndex: number;
      lessons: PersistedLesson[];
    }
  | { kind: "append_modules"; modules: PersistedModule[] }
  | {
      kind: "append_quiz_questions";
      moduleIndex: number;
      lessonIndex: number;
      questions: WhitbyQuestion[];
      passingScore?: string;
    }
  | { kind: "remove_lesson"; moduleIndex: number; lessonIndex: number }
  | { kind: "remove_module"; moduleIndex: number }
  | { kind: "rename_lesson"; moduleIndex: number; lessonIndex: number; title: string }
  | { kind: "rename_module"; moduleIndex: number; title: string };

export type WhitbyAgentResult = {
  ops: WhitbyOp[];
  summary: string;
  agent: string;
};

export type OrchestratedRefine = PersistedProgramDraft & {
  summary: string;
  mutated?: boolean;
};

export function clampCount(value: number, max = 8): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(max, Math.max(1, Math.round(value)));
}

export function outlineDraft(draft: PersistedProgramDraft) {
  return {
    name: draft.name,
    description: draft.description.slice(0, 400),
    type: draft.type,
    modules: draft.modules.map((module, moduleIndex) => ({
      index: moduleIndex,
      title: module.title,
      lessons: module.lessons.map((lesson, lessonIndex) => ({
        index: lessonIndex,
        title: lesson.title,
        type: lesson.type,
        quizQuestions: lesson.quiz?.questions.length ?? 0,
        hasAssignment: Boolean(lesson.assignment),
        hasVideo: Boolean(lesson.videoUrl),
      })),
    })),
  };
}

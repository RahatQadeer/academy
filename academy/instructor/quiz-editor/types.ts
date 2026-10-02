import type { AcademyProgramStatus, AcademyQuestionType } from "@/academy/lib/domain";

export const QUESTION_TEXT_MAX = 500;
export const OPTION_LABEL_MAX = 200;
export const MAX_QUESTIONS = 48;
export const MIN_MC_OPTIONS = 2;
export const MAX_MC_OPTIONS = 8;

export type EditorQuestionOption = {
  id: string;
  label: string;
};

export type EditorQuestion = {
  id: string;
  questionText: string;
  type: AcademyQuestionType;
  options: EditorQuestionOption[];
  correctAnswer: string;
  sortOrder: number;
  fromBank?: boolean;
};

export type QuizEditorData = {
  programId: string;
  programName: string;
  programStatus: AcademyProgramStatus;
  lessonId: string;
  lessonTitle: string;
  quizId: string;
  passingScore: number;
  questions: EditorQuestion[];
};

export type QuizEditorLoadResult =
  | { ok: true; data: QuizEditorData }
  | { ok: false; reason: "unauthorized" | "not_found" | "mismatch" | "failed" };

export type SaveQuizDraftInput = {
  programId: string;
  lessonId: string;
  passingScore: number;
  questions: {
    id: string | null;
    questionText: string;
    type: string;
    options: { id: string; label: string }[];
    correctAnswer: string;
    fromBank?: boolean;
  }[];
};

export type SaveQuizDraftResult =
  | { ok: true; data: QuizEditorData }
  | { ok: false; reason: "unauthorized" | "invalid" | "published" | "failed"; message?: string };

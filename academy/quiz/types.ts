export {
  ACADEMY_QUESTION_TYPES,
  isAcademyQuestionType,
  type AcademyQuestionType,
} from "@/academy/lib/domain";
import type { AcademyQuestionType } from "@/academy/lib/domain";

export type LearnerQuizOption = {
  id: string;
  label: string;
};

export type LearnerQuizQuestion = {
  id: string;
  questionText: string;
  type: AcademyQuestionType;
  options: LearnerQuizOption[];
  sortOrder: number;
};

export type LearnerQuizView = {
  quizId: string;
  programId: string;
  lessonId: string;
  passingScore: number;
  questions: LearnerQuizQuestion[];
};

export type LearnerQuizUnavailableReason =
  | "unauthenticated"
  | "no_academy_access"
  | "no_learner_capability"
  | "no_enrollment"
  | "not_found"
  | "mismatch"
  | "locked"
  | "malformed"
  | "empty"
  | "invalid"
  | "failed";

export type LearnerQuizLoadResult =
  | { ok: true; data: LearnerQuizView }
  | { ok: false; reason: LearnerQuizUnavailableReason };

export type LearnerQuizAnswer = {
  questionId: string;
  answer: string;
};

export type LearnerQuizItemResult = {
  questionId: string;
  correct: boolean;
};

export type LearnerQuizScore = {
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  passingScore: number;
  itemResults: LearnerQuizItemResult[];
};

export type SubmitLearnerQuizResult =
  | { status: "scored"; result: LearnerQuizScore }
  | { status: "unavailable"; reason: LearnerQuizUnavailableReason };

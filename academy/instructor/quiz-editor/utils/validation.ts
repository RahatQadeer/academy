import { isAcademyQuestionType, type AcademyQuestionType } from "@/academy/lib/domain";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";
import { normalizeQuizOptions } from "@/academy/quiz/utils/options";
import type { EditorQuestionOption } from "../types";
import { MAX_MC_OPTIONS, MIN_MC_OPTIONS, OPTION_LABEL_MAX, QUESTION_TEXT_MAX } from "../types";

export const TRUE_FALSE_OPTIONS: EditorQuestionOption[] = [
  { id: "true", label: "True" },
  { id: "false", label: "False" },
];

export function trimQuestionText(raw: string) {
  return stripQuizAnswerLeaks(raw).slice(0, QUESTION_TEXT_MAX);
}

export function parsePassingScore(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 100) return null;
  return rounded;
}

export function parseEditorQuestionType(value: string): AcademyQuestionType | null {
  return isAcademyQuestionType(value) ? value : null;
}

export function sanitizeOptions(
  type: AcademyQuestionType,
  options: { id: string; label: string }[],
): EditorQuestionOption[] | null {
  if (type === "true_false") return TRUE_FALSE_OPTIONS;

  const seen = new Set<string>();
  const cleaned: EditorQuestionOption[] = [];
  for (const option of options) {
    const id = option.id.trim().slice(0, 80);
    const label = option.label.trim().slice(0, OPTION_LABEL_MAX);
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    cleaned.push({ id, label });
    if (cleaned.length >= MAX_MC_OPTIONS) break;
  }
  if (cleaned.length < MIN_MC_OPTIONS) return null;
  return cleaned;
}

export function validateCorrectAnswer(
  type: AcademyQuestionType,
  options: EditorQuestionOption[],
  correctAnswer: string,
): string | null {
  const value = correctAnswer.trim();
  if (!value) return null;
  if (type === "true_false") {
    const lowered = value.toLowerCase();
    if (lowered !== "true" && lowered !== "false") return null;
    return lowered;
  }
  const match = options.find((option) => option.id === value);
  return match ? match.id : null;
}

export function optionsFromStorage(type: AcademyQuestionType, raw: unknown): EditorQuestionOption[] {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as { choices?: unknown }).choices)
      ? (raw as { choices: unknown }).choices
      : raw;
  return normalizeQuizOptions(type, source).map((option) => ({
    id: option.id,
    label: option.label,
  }));
}

export function fromBankFromStorage(raw: unknown): boolean {
  return Boolean(
    raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      (raw as { fromBank?: unknown }).fromBank,
  );
}

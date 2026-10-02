import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type { LearnerQuizAnswer } from "../types";

export function isUuid(value: string) {
  return PROGRAM_ID.test(value);
}

export function parseLearnerAnswers(input: unknown): LearnerQuizAnswer[] | null {
  if (!Array.isArray(input)) return null;
  const answers: LearnerQuizAnswer[] = [];
  const seen = new Set<string>();

  for (const row of input) {
    if (!row || typeof row !== "object") return null;
    const questionId =
      "questionId" in row && typeof row.questionId === "string"
        ? row.questionId
        : "question_id" in row && typeof row.question_id === "string"
          ? row.question_id
          : "";
    const answer = "answer" in row && typeof row.answer === "string" ? row.answer.trim() : "";
    if (!isUuid(questionId) || !answer) return null;
    if (seen.has(questionId)) return null;
    seen.add(questionId);
    answers.push({ questionId, answer });
  }

  return answers;
}

export function answersCoverQuestions(
  answers: LearnerQuizAnswer[],
  questionIds: string[],
): boolean {
  if (answers.length !== questionIds.length) return false;
  const submitted = new Set(answers.map((item) => item.questionId));
  return questionIds.every((id) => submitted.has(id));
}

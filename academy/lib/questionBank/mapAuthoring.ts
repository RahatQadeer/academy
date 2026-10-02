import type { AuthoringBankQuestion } from "./types";
import { serializeQuizOptions, wrapBankBriefPrompt } from "./bankOrigin";

export function catalogQuestionFromBank(
  question: AuthoringBankQuestion,
  sortOrder: number,
): {
  id: string;
  questionText: string;
  type: "multiple_choice" | "true_false";
  options: string[];
  correctAnswer: string;
  sortOrder: number;
  fromBank: true;
} | null {
  if (question.type !== "multiple_choice" && question.type !== "true_false") return null;
  const options =
    question.type === "true_false"
      ? question.options.length >= 2
        ? question.options.map((option) => option.label)
        : ["True", "False"]
      : question.options.map((option) => option.label).filter((label) => label.trim());
  if (options.length < 2) return null;
  const matched = question.options.find((option) => option.id === question.correctAnswer);
  const correctAnswer =
    matched?.label ??
    (options.includes(question.correctAnswer) ? question.correctAnswer : options[0] ?? "");
  return {
    id: "",
    questionText: question.questionText,
    type: question.type,
    options,
    correctAnswer,
    sortOrder,
    fromBank: true,
  };
}

export function editorQuestionFromBank(
  question: AuthoringBankQuestion,
  sortOrder: number,
): {
  id: string;
  questionText: string;
  type: "multiple_choice" | "true_false";
  options: { id: string; label: string }[];
  correctAnswer: string;
  sortOrder: number;
  fromBank: true;
} | null {
  if (question.type !== "multiple_choice" && question.type !== "true_false") return null;
  const options =
    question.type === "true_false"
      ? [
          { id: "true", label: "True" },
          { id: "false", label: "False" },
        ]
      : question.options.filter((option) => option.id.trim() && option.label.trim());
  if (options.length < 2) return null;
  const correctAnswer =
    question.type === "true_false"
      ? question.correctAnswer.trim().toLowerCase() === "false"
        ? "false"
        : "true"
      : options.some((option) => option.id === question.correctAnswer)
        ? question.correctAnswer
        : options[0]?.id ?? "";
  return {
    id: "",
    questionText: question.questionText,
    type: question.type,
    options,
    correctAnswer,
    sortOrder,
    fromBank: true,
  };
}

export function assignmentPromptFromBank(question: AuthoringBankQuestion) {
  const prompt = question.questionText.trim();
  if (!prompt) return "";
  if (
    question.type === "assignment" ||
    question.type === "exercise" ||
    question.type === "other"
  ) {
    return wrapBankBriefPrompt(prompt);
  }
  const options = question.options
    .map((option, index) => {
      const label = option.label.trim();
      if (!label) return "";
      return `${String.fromCharCode(65 + index)}. ${label}`;
    })
    .filter(Boolean);
  if (options.length === 0) return wrapBankBriefPrompt(prompt);
  return wrapBankBriefPrompt(`${prompt}\n${options.join("\n")}`);
}

export function mergeAssignmentBrief(current: string, prompts: string[]) {
  let next = current.trim();
  for (const prompt of prompts) {
    const block = prompt.trim();
    if (!block) continue;
    // Already present (raw or wrapped).
    const bare = block
      .replace(/<!--pa-bank-->/g, "")
      .replace(/<!--\/pa-bank-->/g, "")
      .trim();
    if (next.includes(block) || (bare && next.includes(bare))) continue;
    next = next ? `${next}\n\n${block}` : block;
  }
  return next;
}

/** Persist helper — keep choices as strings for UI, encode fromBank for DB. */
export function quizOptionsForStorage(choices: string[], fromBank?: boolean) {
  return serializeQuizOptions(choices, fromBank);
}

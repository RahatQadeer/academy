import "server-only";

import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import { QUESTION_TEXT_MAX } from "@/academy/instructor/quiz-editor/types";
import {
  parseEditorQuestionType,
  sanitizeOptions,
  trimQuestionText,
  validateCorrectAnswer,
} from "@/academy/instructor/quiz-editor/utils/validation";
import { authorizeBankProgram } from "./authorizeWrite";
import type { AppendManualQuestionInput, AppendManualQuestionResult } from "./types";

const OPEN_PROMPT_TYPES = new Set(["assignment", "exercise", "other"]);

function parseBankQuestionType(value: string) {
  if (OPEN_PROMPT_TYPES.has(value)) {
    return value as "assignment" | "exercise" | "other";
  }
  return parseEditorQuestionType(value);
}

export async function appendManualQuestion(
  input: AppendManualQuestionInput,
): Promise<AppendManualQuestionResult> {
  const programId = input.programId.trim().toLowerCase();
  if (!PROGRAM_ID.test(programId)) {
    return { ok: false, reason: "invalid", message: "Choose a course for this question." };
  }

  const questionText = trimQuestionText(input.questionText);
  const type = parseBankQuestionType(input.type);
  if (!questionText || !type) {
    return {
      ok: false,
      reason: "invalid",
      message: "Write the question and choose a type.",
    };
  }

  const isOpen = OPEN_PROMPT_TYPES.has(type);
  let options: { id: string; label: string }[] = [];
  let correctAnswer = "";
  if (isOpen) {
    correctAnswer = (input.correctAnswer ?? "").trim().slice(0, QUESTION_TEXT_MAX);
  } else {
    if (type !== "multiple_choice" && type !== "true_false") {
      return {
        ok: false,
        reason: "invalid",
        message: "Write the question and choose a type.",
      };
    }
    const closed = sanitizeOptions(type, input.options ?? []);
    if (!closed) {
      return {
        ok: false,
        reason: "invalid",
        message: "Multiple-choice questions need at least two options with labels.",
      };
    }
    options = closed;
    const answer = validateCorrectAnswer(type, options, input.correctAnswer);
    if (!answer) {
      return {
        ok: false,
        reason: "invalid",
        message: "Mark which option is the correct answer.",
      };
    }
    correctAnswer = answer;
  }

  const access = await authorizeBankProgram(programId);
  if (!access.ok) {
    return { ok: false, reason: access.reason, message: access.message };
  }

  try {
    const { supabase } = access.ctx;
    // Avoid an extra round-trip for sort_order — bank list orders by text / type.
    const { data: createdQuestion, error: insertError } = await supabase
      .from("academy_questions")
      .insert({
        program_id: programId,
        quiz_id: null,
        question_text: questionText,
        type,
        options,
        correct_answer: correctAnswer || null,
        sort_order: Math.floor(Date.now() / 1000) % 2_000_000_000,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !createdQuestion) {
      return { ok: false, reason: "failed", message: "The question could not be saved. Try again." };
    }

    return {
      ok: true,
      questionId: (createdQuestion as { id: string }).id,
    };
  } catch {
    return { ok: false, reason: "failed", message: "The question could not be saved. Try again." };
  }
}

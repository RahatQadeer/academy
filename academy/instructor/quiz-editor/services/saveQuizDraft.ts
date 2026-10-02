import "server-only";

import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type { SaveQuizDraftInput, SaveQuizDraftResult } from "../types";
import { MAX_QUESTIONS } from "../types";
import {
  parseEditorQuestionType,
  parsePassingScore,
  sanitizeOptions,
  trimQuestionText,
  validateCorrectAnswer,
} from "../utils/validation";
import { clampScorePercent } from "@/academy/lib/scorePercent";
import { authorizeQuizEditor } from "./authorizeQuizEditor";
import { loadQuizEditor } from "./loadQuizEditor";

export async function saveQuizDraft(input: SaveQuizDraftInput): Promise<SaveQuizDraftResult> {
  const access = await authorizeQuizEditor(input.programId, input.lessonId);
  if (!access.ok) {
    return { ok: false, reason: access.reason === "failed" ? "failed" : "unauthorized" };
  }

  const passingScore = parsePassingScore(clampScorePercent(input.passingScore));
  if (passingScore == null) {
    return {
      ok: false,
      reason: "invalid",
      message: "Passing score must be a whole number from 0 to 100.",
    };
  }
  if (input.questions.length > MAX_QUESTIONS) {
    return { ok: false, reason: "invalid", message: "Too many questions." };
  }

  const { ctx } = access;
  if (ctx.programStatus === "published") {
    return {
      ok: false,
      reason: "published",
      message: "Live programs cannot be edited in this editor.",
    };
  }
  const quizId = ctx.quiz.id;

  try {
    const { error: quizError } = await ctx.supabase
      .from("academy_quizzes")
      .update({ passing_score: passingScore })
      .eq("id", quizId)
      .eq("lesson_id", ctx.lessonId);
    if (quizError) return { ok: false, reason: "failed" };

    const { data: existingRows, error: existingError } = await ctx.supabase
      .from("academy_questions")
      .select("id")
      .eq("quiz_id", quizId)
      .limit(MAX_QUESTIONS);
    if (existingError) return { ok: false, reason: "failed" };

    const existingIds = new Set(
      (existingRows ?? []).map((row) => (row as { id: string }).id).filter((id) => PROGRAM_ID.test(id)),
    );
    const keptIds = new Set<string>();

    for (let index = 0; index < input.questions.length; index += 1) {
      const raw = input.questions[index];
      if (!raw) continue;
      const questionText = trimQuestionText(raw.questionText);
      const type = parseEditorQuestionType(raw.type);
      if (!questionText || !type) {
        return { ok: false, reason: "invalid", message: "Every question needs text and a supported type." };
      }
      const options = sanitizeOptions(type, raw.options ?? []);
      if (!options) {
        return {
          ok: false,
          reason: "invalid",
          message: "Multiple-choice questions need at least two options.",
        };
      }
      const correctAnswer = validateCorrectAnswer(type, options, raw.correctAnswer);
      if (!correctAnswer) {
        return {
          ok: false,
          reason: "invalid",
          message: "The correct answer must match a valid option.",
        };
      }

      const payload = {
        quiz_id: quizId,
        question_text: questionText,
        type,
        options: raw.fromBank ? { choices: options, fromBank: true } : options,
        correct_answer: correctAnswer,
        sort_order: index,
      };

      const requestedId = raw.id && PROGRAM_ID.test(raw.id) ? raw.id : null;
      if (requestedId) {
        if (!existingIds.has(requestedId)) {
          return { ok: false, reason: "unauthorized" };
        }
        const { error } = await ctx.supabase
          .from("academy_questions")
          .update(payload)
          .eq("id", requestedId)
          .eq("quiz_id", quizId);
        if (error) return { ok: false, reason: "failed" };
        keptIds.add(requestedId);
      } else {
        const { data: created, error } = await ctx.supabase
          .from("academy_questions")
          .insert(payload)
          .select("id")
          .maybeSingle();
        if (error || !created) return { ok: false, reason: "failed" };
        keptIds.add((created as { id: string }).id);
      }
    }

    const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
    if (toDelete.length > 0) {
      const { error: deleteError } = await ctx.supabase
        .from("academy_questions")
        .delete()
        .eq("quiz_id", quizId)
        .in("id", toDelete);
      if (deleteError) return { ok: false, reason: "failed" };
    }

    const reloaded = await loadQuizEditor(input.programId, input.lessonId);
    if (!reloaded.ok) return { ok: false, reason: "failed" };
    return { ok: true, data: reloaded.data };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

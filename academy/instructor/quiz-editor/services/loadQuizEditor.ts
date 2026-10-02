import "server-only";

import { isAcademyQuestionType } from "@/academy/lib/domain";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type { EditorQuestion, QuizEditorLoadResult } from "../types";
import { MAX_QUESTIONS } from "../types";
import { optionsFromStorage, fromBankFromStorage, TRUE_FALSE_OPTIONS } from "../utils/validation";
import { authorizeQuizEditor } from "./authorizeQuizEditor";

type QuestionRow = {
  id: string;
  quiz_id: string;
  question_text: string;
  type: string;
  options: unknown;
  correct_answer: string | null;
  sort_order: number;
};

export async function loadQuizEditor(
  programId: string,
  lessonId: string,
): Promise<QuizEditorLoadResult> {
  const access = await authorizeQuizEditor(programId, lessonId);
  if (!access.ok) return access;

  try {
    const { ctx } = access;
    const { data, error } = await ctx.supabase
      .from("academy_questions")
      .select("id, quiz_id, question_text, type, options, correct_answer, sort_order")
      .eq("quiz_id", ctx.quiz.id)
      .order("sort_order", { ascending: true })
      .limit(MAX_QUESTIONS);

    if (error) return { ok: false, reason: "failed" };

    const questions: EditorQuestion[] = [];
    for (const row of (data ?? []) as QuestionRow[]) {
      if (row.quiz_id !== ctx.quiz.id || !PROGRAM_ID.test(row.id)) continue;
      if (!isAcademyQuestionType(row.type)) continue;
      const options =
        row.type === "true_false" ? TRUE_FALSE_OPTIONS : optionsFromStorage(row.type, row.options);
      questions.push({
        id: row.id,
        questionText: row.question_text,
        type: row.type,
        options,
        correctAnswer: row.correct_answer ?? "",
        sortOrder: row.sort_order,
        fromBank: fromBankFromStorage(row.options) || undefined,
      });
    }

    questions.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

    return {
      ok: true,
      data: {
        programId: ctx.programId,
        programName: ctx.programName,
        programStatus: ctx.programStatus,
        lessonId: ctx.lessonId,
        lessonTitle: ctx.lessonTitle,
        quizId: ctx.quiz.id,
        passingScore: ctx.quiz.passing_score,
        questions,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

import "server-only";

import { getSessionProfile } from "@/base/identity/session";
import { isAcademyQuestionType } from "@/academy/lib/domain";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import { MAX_QUESTIONS } from "@/academy/instructor/quiz-editor/types";
import { authorizeBankWrite } from "./authorizeWrite";
import { authorableProgramIds } from "./loadQuizTargets";
import { parseStoredQuizOptions, serializeQuizOptions } from "./bankOrigin";
import type { CopyBankQuestionsInput, CopyBankQuestionsResult } from "./types";

type QuizRow = { id: string; lesson_id: string };
type QuestionRow = {
  id: string;
  quiz_id: string | null;
  program_id: string | null;
  question_text: string;
  type: string;
  options: unknown;
  correct_answer: string | null;
};

function uniqueIds(values: string[]) {
  return [...new Set(values.map((id) => id.trim().toLowerCase()))].filter((id) => PROGRAM_ID.test(id));
}

export async function copyBankQuestionsToQuiz(
  input: CopyBankQuestionsInput,
): Promise<CopyBankQuestionsResult> {
  const questionIds = uniqueIds(input.questionIds);
  if (questionIds.length === 0) {
    return { ok: false, reason: "invalid", message: "Select at least one question." };
  }

  const access = await authorizeBankWrite(input.programId, input.lessonId);
  if (!access.ok) {
    return { ok: false, reason: access.reason, message: access.message };
  }

  const { ctx } = access;
  if (ctx.lesson.type !== "quiz") {
    return {
      ok: false,
      reason: "no_quiz",
      message: "Pick a quiz lesson. Add one in the course builder if this course has none.",
    };
  }

  try {
    const { supabase, isAdmin, program } = ctx;
    const { data: quizzes, error: quizError } = await supabase
      .from("academy_quizzes")
      .select("id, lesson_id")
      .eq("lesson_id", ctx.lesson.id)
      .order("id", { ascending: true })
      .limit(1);
    if (quizError) return { ok: false, reason: "failed", message: "The quiz could not be loaded." };

    let quiz = ((quizzes ?? [])[0] as QuizRow | undefined) ?? null;
    if (!quiz) {
      if (!isAdmin && program.status === "published") {
        return {
          ok: false,
          reason: "no_quiz",
          message: "This live course has no quiz record yet. An admin needs to add it in the catalog.",
        };
      }
      const { data: created, error: createError } = await supabase
        .from("academy_quizzes")
        .insert({ lesson_id: ctx.lesson.id, passing_score: 80 })
        .select("id, lesson_id")
        .maybeSingle();
      if (createError || !created) {
        return { ok: false, reason: "failed", message: "The quiz could not be created for this lesson." };
      }
      quiz = created as QuizRow;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("academy_questions")
      .select("id, question_text, sort_order")
      .eq("quiz_id", quiz.id)
      .order("sort_order", { ascending: false })
      .limit(MAX_QUESTIONS);
    if (existingError) return { ok: false, reason: "failed", message: "Existing questions could not be loaded." };

    const existing = (existingRows ?? []) as { id: string; question_text: string; sort_order: number }[];
    if (existing.length >= MAX_QUESTIONS) {
      return {
        ok: false,
        reason: "full",
        message: `This quiz already has ${MAX_QUESTIONS} questions, the maximum.`,
      };
    }

    const { data: sourceRows, error: sourceError } = await supabase
      .from("academy_questions")
      .select("id, quiz_id, program_id, question_text, type, options, correct_answer")
      .in("id", questionIds);
    if (sourceError || !sourceRows?.length) {
      return { ok: false, reason: "invalid", message: "Selected questions could not be loaded." };
    }

    const sources = (sourceRows as QuestionRow[]).filter(
      (row) => isAcademyQuestionType(row.type) && row.quiz_id !== quiz.id,
    );
    if (sources.length === 0) {
      return {
        ok: false,
        reason: "invalid",
        message: "Those questions are already in this quiz, or are not quiz questions.",
      };
    }

    // Only resolve lineage for in-quiz rows missing program_id (bank rows already have it).
    const sourceQuizIds = [
      ...new Set(
        sources.filter((row) => !row.program_id && row.quiz_id).map((row) => row.quiz_id as string),
      ),
    ];
    const { data: sourceQuizzes } = sourceQuizIds.length
      ? await supabase.from("academy_quizzes").select("id, lesson_id").in("id", sourceQuizIds)
      : { data: [] as QuizRow[] };
    const lessonIds = [...new Set(((sourceQuizzes ?? []) as QuizRow[]).map((row) => row.lesson_id))];
    const { data: sourceLessons } = lessonIds.length
      ? await supabase.from("academy_lessons").select("id, module_id").in("id", lessonIds)
      : { data: [] as { id: string; module_id: string }[] };
    const moduleIds = [
      ...new Set(((sourceLessons ?? []) as { id: string; module_id: string }[]).map((row) => row.module_id)),
    ];
    const { data: sourceModules } = moduleIds.length
      ? await supabase.from("academy_modules").select("id, program_id").in("id", moduleIds)
      : { data: [] as { id: string; program_id: string }[] };

    const programByModule = new Map(
      ((sourceModules ?? []) as { id: string; program_id: string }[]).map((row) => [row.id, row.program_id]),
    );
    const moduleByLesson = new Map(
      ((sourceLessons ?? []) as { id: string; module_id: string }[]).map((row) => [row.id, row.module_id]),
    );
    const lessonByQuiz = new Map(((sourceQuizzes ?? []) as QuizRow[]).map((row) => [row.id, row.lesson_id]));

    // Destination is already authorized. Skip cross-course allow-list when all sources
    // belong to that same course (typical question-bank copy).
    let allowedPrograms: string[] | "all" = "all";
    if (!isAdmin) {
      const needsCrossCourseCheck = sources.some((row) => {
        const lessonId = row.quiz_id ? lessonByQuiz.get(row.quiz_id) : undefined;
        const moduleId = lessonId ? moduleByLesson.get(lessonId) : undefined;
        const programId = row.program_id ?? (moduleId ? programByModule.get(moduleId) : undefined);
        return programId !== ctx.program.id;
      });
      if (needsCrossCourseCheck) {
        const profile = await getSessionProfile();
        const ids = await authorableProgramIds(supabase, profile?.user.id ?? "", "instructor");
        allowedPrograms = ids;
      } else {
        allowedPrograms = [ctx.program.id];
      }
    }

    const existingTexts = new Set(existing.map((row) => row.question_text.trim().toLowerCase()));
    const room = MAX_QUESTIONS - existing.length;
    let nextSort = (existing[0]?.sort_order ?? -1) + 1;
    const inserts: {
      quiz_id: string;
      program_id: string;
      question_text: string;
      type: string;
      options: unknown;
      correct_answer: string | null;
      sort_order: number;
    }[] = [];
    let skipped = 0;

    for (const row of sources) {
      if (inserts.length >= room) {
        skipped += 1;
        continue;
      }
      const lessonId = row.quiz_id ? lessonByQuiz.get(row.quiz_id) : undefined;
      const moduleId = lessonId ? moduleByLesson.get(lessonId) : undefined;
      const programId = row.program_id ?? (moduleId ? programByModule.get(moduleId) : undefined);
      if (!programId || (allowedPrograms !== "all" && !allowedPrograms.includes(programId))) {
        skipped += 1;
        continue;
      }
      const key = row.question_text.trim().toLowerCase();
      if (!key || existingTexts.has(key)) {
        skipped += 1;
        continue;
      }
      existingTexts.add(key);
      const parsed = parseStoredQuizOptions(row.options);
      inserts.push({
        quiz_id: quiz.id,
        program_id: ctx.program.id,
        question_text: row.question_text,
        type: row.type,
        options: serializeQuizOptions(parsed.choices.length ? parsed.choices : ["True", "False"], true),
        correct_answer: row.correct_answer,
        sort_order: nextSort,
      });
      nextSort += 1;
    }

    if (inserts.length === 0) {
      return {
        ok: false,
        reason: "invalid",
        message: skipped
          ? "Those questions are already in this quiz, or you cannot reuse them here."
          : "No valid questions to add.",
      };
    }

    const { error: insertError } = await supabase.from("academy_questions").insert(inserts);
    if (insertError) {
      return { ok: false, reason: "failed", message: "The questions could not be added. Try again." };
    }

    return {
      ok: true,
      added: inserts.length,
      skipped,
      questionCount: existing.length + inserts.length,
    };
  } catch {
    return { ok: false, reason: "failed", message: "The questions could not be added. Try again." };
  }
}

import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAcademy, canAccessLearnerArea } from "@/academy/lib/authorization";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type { LearnerQuizLoadResult, LearnerQuizQuestion, LearnerQuizUnavailableReason } from "../types";
import { normalizeQuizOptions, parseQuestionType } from "../utils/options";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";

type QuizRow = { id: string; lesson_id: string; passing_score: number };

type RpcEnvelope = {
  status?: string;
  reason?: string;
  questions?: unknown;
};

function asReason(value: string | undefined): LearnerQuizUnavailableReason {
  if (
    value === "unauthenticated" ||
    value === "no_academy_access" ||
    value === "no_learner_capability" ||
    value === "no_enrollment" ||
    value === "not_found" ||
    value === "mismatch" ||
    value === "locked" ||
    value === "malformed" ||
    value === "empty" ||
    value === "invalid"
  ) {
    return value;
  }
  return "failed";
}

function mapQuestions(raw: unknown): LearnerQuizQuestion[] | null {
  if (!Array.isArray(raw)) return null;
  const questions: LearnerQuizQuestion[] = [];

  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const record = row as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const questionText =
      typeof record.question_text === "string"
        ? record.question_text
        : typeof record.questionText === "string"
          ? record.questionText
          : "";
    const type = parseQuestionType(record.type);
    const sortOrder =
      typeof record.sort_order === "number"
        ? record.sort_order
        : typeof record.sortOrder === "number"
          ? record.sortOrder
          : 0;
    if (!PROGRAM_ID.test(id) || !questionText || !type) return null;
    if ("correct_answer" in record || "correctAnswer" in record) return null;
    const options = normalizeQuizOptions(type, record.options);
    if (type === "multiple_choice" && options.length < 2) return null;
    questions.push({
      id,
      questionText: stripQuizAnswerLeaks(questionText),
      type,
      options,
      sortOrder,
    });
  }

  return questions.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export async function loadLearnerQuiz(
  programId: string,
  lessonId: string,
): Promise<LearnerQuizLoadResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" };
  if (!PROGRAM_ID.test(programId) || !PROGRAM_ID.test(lessonId)) {
    return { ok: false, reason: "mismatch" };
  }

  const profile = await getSessionProfile();
  if (!profile) return { ok: false, reason: "unauthenticated" };

  const user = { id: profile.user.id };
  if (!(await canAccessAcademy(user))) return { ok: false, reason: "no_academy_access" };
  if (!(await canAccessLearnerArea(user))) return { ok: false, reason: "no_learner_capability" };

  try {
    const supabase = await createClient();

    const { data: enrollment } = await supabase
      .from("academy_enrollments")
      .select("id, user_id")
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .maybeSingle();

    if (!enrollment || (enrollment as { user_id: string }).user_id !== user.id) {
      return { ok: false, reason: "no_enrollment" };
    }

    const { data: lesson } = await supabase
      .from("academy_lessons")
      .select("id, module_id, type")
      .eq("id", lessonId)
      .maybeSingle();

    if (!lesson || (lesson as { type?: string }).type !== "quiz") {
      return { ok: false, reason: "mismatch" };
    }

    const { data: module } = await supabase
      .from("academy_modules")
      .select("id, program_id")
      .eq("id", (lesson as { module_id: string }).module_id)
      .maybeSingle();

    if (!module || (module as { program_id: string }).program_id !== programId) {
      return { ok: false, reason: "mismatch" };
    }

    const { data: quiz } = await supabase
      .from("academy_quizzes")
      .select("id, lesson_id, passing_score")
      .eq("lesson_id", lessonId)
      .maybeSingle();

    const quizRow = quiz as QuizRow | null;
    if (!quizRow || quizRow.lesson_id !== lessonId) {
      return { ok: false, reason: "not_found" };
    }

    const { data, error } = await supabase.rpc("academy_learner_quiz_questions", {
      p_program_id: programId,
      p_lesson_id: lessonId,
      p_quiz_id: quizRow.id,
    });

    if (error) return { ok: false, reason: "failed" };

    const envelope = (
      typeof data === "string" ? JSON.parse(data) : data
    ) as RpcEnvelope | null;
    if (envelope && typeof envelope === "object" && "correct_answer" in envelope) {
      return { ok: false, reason: "failed" };
    }
    if (!envelope || envelope.status !== "ok") {
      return { ok: false, reason: asReason(envelope?.reason) };
    }

    const questions = mapQuestions(envelope.questions);
    if (!questions) return { ok: false, reason: "malformed" };
    if (questions.length === 0) return { ok: false, reason: "empty" };

    return {
      ok: true,
      data: {
        quizId: quizRow.id,
        programId,
        lessonId,
        passingScore: quizRow.passing_score,
        questions,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAcademy, canAccessLearnerArea } from "@/academy/lib/authorization";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type {
  LearnerQuizItemResult,
  LearnerQuizUnavailableReason,
  SubmitLearnerQuizResult,
} from "../types";
import { parseLearnerAnswers } from "../utils/validation";
import { recalculateEnrollmentProgress } from "@/academy/progress/services/recalculateEnrollmentProgress";

type RpcEnvelope = {
  status?: string;
  reason?: string;
  score?: number;
  passed?: boolean;
  total_questions?: number;
  correct_answers?: number;
  passing_score?: number;
  item_results?: unknown;
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

function mapItemResults(raw: unknown): LearnerQuizItemResult[] | null {
  if (!Array.isArray(raw)) return [];
  const items: LearnerQuizItemResult[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if ("correct_answer" in record || "correctAnswer" in record) return null;
    const questionId =
      typeof record.question_id === "string"
        ? record.question_id
        : typeof record.questionId === "string"
          ? record.questionId
          : "";
    if (!PROGRAM_ID.test(questionId) || typeof record.correct !== "boolean") continue;
    items.push({ questionId, correct: record.correct });
  }
  return items;
}

export async function submitLearnerQuiz(input: {
  programId: string;
  lessonId: string;
  quizId: string;
  answers: unknown;
}): Promise<SubmitLearnerQuizResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable", reason: "failed" };
  if (
    !PROGRAM_ID.test(input.programId) ||
    !PROGRAM_ID.test(input.lessonId) ||
    !PROGRAM_ID.test(input.quizId)
  ) {
    return { status: "unavailable", reason: "mismatch" };
  }

  const answers = parseLearnerAnswers(input.answers);
  if (!answers || answers.length === 0) {
    return { status: "unavailable", reason: "invalid" };
  }

  const profile = await getSessionProfile();
  if (!profile) return { status: "unavailable", reason: "unauthenticated" };

  const user = { id: profile.user.id };
  if (!(await canAccessAcademy(user))) {
    return { status: "unavailable", reason: "no_academy_access" };
  }
  if (!(await canAccessLearnerArea(user))) {
    return { status: "unavailable", reason: "no_learner_capability" };
  }

  try {
    const supabase = await createClient();

    const { data: enrollment } = await supabase
      .from("academy_enrollments")
      .select("id, user_id")
      .eq("user_id", user.id)
      .eq("program_id", input.programId)
      .maybeSingle();

    if (!enrollment || (enrollment as { user_id: string }).user_id !== user.id) {
      return { status: "unavailable", reason: "no_enrollment" };
    }

    const { data: quiz } = await supabase
      .from("academy_quizzes")
      .select("id, lesson_id")
      .eq("id", input.quizId)
      .maybeSingle();

    if (!quiz || (quiz as { lesson_id: string }).lesson_id !== input.lessonId) {
      return { status: "unavailable", reason: "mismatch" };
    }

    const { data: lesson } = await supabase
      .from("academy_lessons")
      .select("id, module_id, type")
      .eq("id", input.lessonId)
      .maybeSingle();

    if (!lesson || (lesson as { type?: string }).type !== "quiz") {
      return { status: "unavailable", reason: "mismatch" };
    }

    const { data: module } = await supabase
      .from("academy_modules")
      .select("program_id")
      .eq("id", (lesson as { module_id: string }).module_id)
      .maybeSingle();

    if (!module || (module as { program_id: string }).program_id !== input.programId) {
      return { status: "unavailable", reason: "mismatch" };
    }

    const { data, error } = await supabase.rpc("academy_submit_learner_quiz", {
      p_program_id: input.programId,
      p_lesson_id: input.lessonId,
      p_quiz_id: input.quizId,
      p_answers: answers.map((item) => ({
        question_id: item.questionId,
        answer: item.answer,
      })),
    });

    if (error) return { status: "unavailable", reason: "failed" };

    const envelope = (
      typeof data === "string" ? JSON.parse(data) : data
    ) as RpcEnvelope | null;
    if (envelope && typeof envelope === "object" && "correct_answer" in envelope) {
      return { status: "unavailable", reason: "failed" };
    }
    if (!envelope || envelope.status !== "scored") {
      return { status: "unavailable", reason: asReason(envelope?.reason) };
    }

    if (
      typeof envelope.score !== "number" ||
      typeof envelope.passed !== "boolean" ||
      typeof envelope.total_questions !== "number" ||
      typeof envelope.correct_answers !== "number" ||
      typeof envelope.passing_score !== "number"
    ) {
      return { status: "unavailable", reason: "failed" };
    }

    const itemResults = mapItemResults(envelope.item_results);
    if (!itemResults) return { status: "unavailable", reason: "failed" };

    if (envelope.passed) {
      await recalculateEnrollmentProgress((enrollment as { id: string }).id);
    }

    return {
      status: "scored",
      result: {
        score: envelope.score,
        passed: envelope.passed,
        totalQuestions: envelope.total_questions,
        correctAnswers: envelope.correct_answers,
        passingScore: envelope.passing_score,
        itemResults,
      },
    };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}

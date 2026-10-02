import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessInstructorArea,
  canAuthorProgram,
  isInstructor,
} from "@/academy/lib/authorization";
import type { AcademyProgramStatus } from "@/academy/lib/domain";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";

type LessonRow = { id: string; module_id: string; title: string; type: string };
type ModuleRow = { id: string; program_id: string };
type ProgramRow = { id: string; name: string; status: AcademyProgramStatus };
type QuizRow = { id: string; lesson_id: string; passing_score: number };

export type QuizAuthoringContext = {
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  programId: string;
  programName: string;
  programStatus: AcademyProgramStatus;
  lessonId: string;
  lessonTitle: string;
  quiz: QuizRow;
};

export async function authorizeQuizEditor(
  programId: string,
  lessonId: string,
): Promise<{ ok: true; ctx: QuizAuthoringContext } | { ok: false; reason: "unauthorized" | "not_found" | "mismatch" | "failed" }> {
  if (!PROGRAM_ID.test(programId) || !PROGRAM_ID.test(lessonId)) {
    return { ok: false, reason: "mismatch" };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, instructor, allowed] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
      canAuthorProgram(actor, programId),
    ]);
    if (!area || !instructor || !allowed) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: lesson, error: lessonError } = await supabase
      .from("academy_lessons")
      .select("id, module_id, title, type")
      .eq("id", lessonId)
      .maybeSingle();
    if (lessonError) return { ok: false, reason: "failed" };
    const lessonRow = lesson as LessonRow | null;
    if (!lessonRow || lessonRow.type !== "quiz") return { ok: false, reason: "mismatch" };

    const { data: module, error: moduleError } = await supabase
      .from("academy_modules")
      .select("id, program_id")
      .eq("id", lessonRow.module_id)
      .maybeSingle();
    if (moduleError) return { ok: false, reason: "failed" };
    const moduleRow = module as ModuleRow | null;
    if (!moduleRow || moduleRow.program_id !== programId) return { ok: false, reason: "mismatch" };

    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select("id, name, status")
      .eq("id", programId)
      .maybeSingle();
    if (programError) return { ok: false, reason: "failed" };
    const programRow = program as ProgramRow | null;
    if (!programRow) return { ok: false, reason: "not_found" };
    if (
      programRow.status !== "draft" &&
      programRow.status !== "pending_approval" &&
      programRow.status !== "published"
    ) {
      return { ok: false, reason: "failed" };
    }

    const { data: quizzes, error: quizError } = await supabase
      .from("academy_quizzes")
      .select("id, lesson_id, passing_score")
      .eq("lesson_id", lessonId)
      .order("id", { ascending: true })
      .limit(1);
    if (quizError) return { ok: false, reason: "failed" };

    let quiz = ((quizzes ?? [])[0] as QuizRow | undefined) ?? null;
    if (!quiz) {
      if (programRow.status === "published") return { ok: false, reason: "not_found" };
      const { data: created, error: createError } = await supabase
        .from("academy_quizzes")
        .insert({ lesson_id: lessonId, passing_score: 80 })
        .select("id, lesson_id, passing_score")
        .maybeSingle();
      if (createError || !created) return { ok: false, reason: "failed" };
      quiz = created as QuizRow;
    }
    if (quiz.lesson_id !== lessonId) return { ok: false, reason: "mismatch" };

    return {
      ok: true,
      ctx: {
        userId: actor.id,
        supabase,
        programId,
        programName: programRow.name,
        programStatus: programRow.status,
        lessonId,
        lessonTitle: lessonRow.title,
        quiz,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

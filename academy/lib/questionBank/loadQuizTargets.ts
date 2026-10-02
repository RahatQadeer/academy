import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import type { AcademyProgramStatus } from "@/academy/lib/domain";
import { GENERAL_BANK_CATEGORY, isGeneralBankProgram } from "./generalBankConstants";
import type { QuestionBankAuthorScope, QuestionBankProgramTarget } from "./types";

type ProgramRow = { id: string; name: string; status: string; category: string | null };
type ModuleRow = { id: string; program_id: string; title: string; sort_order: number };
type LessonRow = { id: string; module_id: string; title: string; sort_order: number };
type QuizRow = { id: string; lesson_id: string };

type OrderedQuizTarget = QuestionBankProgramTarget["quizzes"][number] & {
  moduleSort: number;
  lessonSort: number;
};
type OrderedAssignmentTarget = QuestionBankProgramTarget["assignments"][number] & {
  moduleSort: number;
  lessonSort: number;
};

function compareOutline(
  a: { moduleSort: number; lessonSort: number; moduleTitle: string; lessonTitle: string },
  b: { moduleSort: number; lessonSort: number; moduleTitle: string; lessonTitle: string },
) {
  if (a.moduleSort !== b.moduleSort) return a.moduleSort - b.moduleSort;
  if (a.lessonSort !== b.lessonSort) return a.lessonSort - b.lessonSort;
  const moduleCmp = a.moduleTitle.localeCompare(b.moduleTitle);
  if (moduleCmp !== 0) return moduleCmp;
  return a.lessonTitle.localeCompare(b.lessonTitle);
}

function stripOrder<T extends { moduleSort: number; lessonSort: number }>(
  items: T[],
): Omit<T, "moduleSort" | "lessonSort">[] {
  return items.map(({ moduleSort: _m, lessonSort: _l, ...rest }) => rest);
}

const STATUSES = new Set<AcademyProgramStatus>(["draft", "pending_approval", "published"]);

function asStatus(value: string): AcademyProgramStatus | null {
  return STATUSES.has(value as AcademyProgramStatus) ? (value as AcademyProgramStatus) : null;
}

function builderHref(scope: QuestionBankAuthorScope, programId: string) {
  return scope === "admin"
    ? `/academy/admin/catalog/${programId}`
    : `/academy/instructor/programs/${programId}`;
}

export async function authorableProgramIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  scope: QuestionBankAuthorScope,
): Promise<string[] | "all"> {
  if (scope === "admin") return "all";

  const [{ data: assigned }, { data: created }] = await Promise.all([
    supabase.from("academy_instructor_assignments").select("program_id").eq("user_id", userId),
    supabase.from("academy_programs").select("id").eq("created_by_user_id", userId),
  ]);

  const ids = new Set<string>();
  for (const row of (assigned ?? []) as { program_id: string }[]) {
    if (row.program_id) ids.add(row.program_id);
  }
  for (const row of (created ?? []) as { id: string }[]) {
    if (row.id) ids.add(row.id);
  }
  return [...ids];
}

export async function loadQuestionBankQuizTargets(input: {
  userId: string;
  scope: QuestionBankAuthorScope;
  /** Programs only — skip quiz/assignment trees. Use for the page shell. */
  lite?: boolean;
  /** When set, only load quiz/assignment trees for this course. */
  programId?: string;
}): Promise<{ ok: true; programs: QuestionBankProgramTarget[] } | { ok: false }> {
  if (!input.userId) return { ok: false };

  try {
    const supabase = await createClient();
    const programIds = await authorableProgramIds(supabase, input.userId, input.scope);
    if (programIds !== "all" && programIds.length === 0) {
      return { ok: true, programs: [] };
    }

    const requested = (input.programId ?? "").trim().toLowerCase();
    let programQuery = supabase
      .from("academy_programs")
      .select("id, name, status, category")
      .order("name");
    if (programIds !== "all") {
      programQuery = programQuery.in("id", programIds);
    }
    if (requested) {
      programQuery = programQuery.eq("id", requested);
    }
    const { data: programRows, error: programError } = await programQuery.limit(requested ? 1 : 400);
    if (programError) return { ok: false };

    const programs = ((programRows ?? []) as ProgramRow[])
      .map((row) => {
        if (isGeneralBankProgram(row) || row.category === GENERAL_BANK_CATEGORY) return null;
        const status = asStatus(row.status);
        if (!status) return null;
        return { id: row.id, name: row.name, status };
      })
      .filter((row): row is { id: string; name: string; status: AcademyProgramStatus } => Boolean(row));

    if (programs.length === 0) return { ok: true, programs: [] };

    if (input.lite && !requested) {
      return {
        ok: true,
        programs: programs.map((program) => ({
          ...program,
          locked: input.scope === "instructor" && program.status === "published",
          builderHref: builderHref(input.scope, program.id),
          quizzes: [],
          assignments: [],
        })),
      };
    }

    const ids = programs.map((program) => program.id);
    const { data: moduleRows, error: moduleError } = await supabase
      .from("academy_modules")
      .select("id, program_id, title, sort_order")
      .in("program_id", ids)
      .order("sort_order", { ascending: true });
    if (moduleError) return { ok: false };

    const modules = (moduleRows ?? []) as ModuleRow[];
    const modulesById = new Map(modules.map((module) => [module.id, module]));
    const moduleIds = modules.map((module) => module.id);
    if (moduleIds.length === 0) {
      return {
        ok: true,
        programs: programs.map((program) => ({
          ...program,
          locked: input.scope === "instructor" && program.status === "published",
          builderHref: builderHref(input.scope, program.id),
          quizzes: [],
          assignments: [],
        })),
      };
    }

    const { data: lessonRows, error: lessonError } = await supabase
      .from("academy_lessons")
      .select("id, module_id, title, type, sort_order")
      .in("module_id", moduleIds)
      .in("type", ["quiz", "assignment"])
      .order("sort_order", { ascending: true });
    if (lessonError) return { ok: false };

    const lessons = (lessonRows ?? []) as (LessonRow & { type: string })[];
    const quizLessons = lessons.filter((lesson) => lesson.type === "quiz");
    const assignmentLessons = lessons.filter((lesson) => lesson.type === "assignment");
    const lessonIds = quizLessons.map((lesson) => lesson.id);
    const quizzesByLesson = new Map<string, string>();
    const countsByQuiz = new Map<string, number>();

    if (lessonIds.length > 0) {
      const { data: quizRows, error: quizError } = await supabase
        .from("academy_quizzes")
        .select("id, lesson_id")
        .in("lesson_id", lessonIds);
      if (quizError) return { ok: false };

      const quizzes = (quizRows ?? []) as QuizRow[];
      for (const quiz of quizzes) {
        if (!quizzesByLesson.has(quiz.lesson_id)) quizzesByLesson.set(quiz.lesson_id, quiz.id);
      }

      const quizIds = quizzes.map((quiz) => quiz.id);
      if (quizIds.length > 0) {
        // Exact counts per quiz without downloading every question row.
        const countResults = await Promise.all(
          quizIds.map(async (quizId) => {
            const { count, error } = await supabase
              .from("academy_questions")
              .select("id", { count: "exact", head: true })
              .eq("quiz_id", quizId);
            return { quizId, count: error ? 0 : (count ?? 0) };
          }),
        );
        for (const row of countResults) {
          countsByQuiz.set(row.quizId, row.count);
        }
      }
    }

    const quizzesByProgram = new Map<string, OrderedQuizTarget[]>();
    for (const lesson of quizLessons) {
      const parent = modulesById.get(lesson.module_id);
      if (!parent) continue;
      const quizId = quizzesByLesson.get(lesson.id) ?? null;
      const list = quizzesByProgram.get(parent.program_id) ?? [];
      list.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        moduleId: parent.id,
        moduleTitle: parent.title,
        quizId,
        questionCount: quizId ? (countsByQuiz.get(quizId) ?? 0) : 0,
        moduleSort: parent.sort_order,
        lessonSort: lesson.sort_order,
      });
      quizzesByProgram.set(parent.program_id, list);
    }

    const assignmentIdsByLesson = new Map<string, string>();
    if (assignmentLessons.length > 0) {
      const { data: assignmentRows, error: assignmentError } = await supabase
        .from("academy_assignments")
        .select("id, lesson_id")
        .in(
          "lesson_id",
          assignmentLessons.map((lesson) => lesson.id),
        );
      if (assignmentError) return { ok: false };
      for (const row of (assignmentRows ?? []) as { id: string; lesson_id: string }[]) {
        if (!assignmentIdsByLesson.has(row.lesson_id)) assignmentIdsByLesson.set(row.lesson_id, row.id);
      }
    }

    const assignmentsByProgram = new Map<string, OrderedAssignmentTarget[]>();
    for (const lesson of assignmentLessons) {
      const parent = modulesById.get(lesson.module_id);
      if (!parent) continue;
      const list = assignmentsByProgram.get(parent.program_id) ?? [];
      list.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        moduleId: parent.id,
        moduleTitle: parent.title,
        assignmentId: assignmentIdsByLesson.get(lesson.id) ?? null,
        moduleSort: parent.sort_order,
        lessonSort: lesson.sort_order,
      });
      assignmentsByProgram.set(parent.program_id, list);
    }

    return {
      ok: true,
      programs: programs.map((program) => {
        const quizzes = [...(quizzesByProgram.get(program.id) ?? [])].sort(compareOutline);
        const assignments = [...(assignmentsByProgram.get(program.id) ?? [])].sort(compareOutline);
        return {
          ...program,
          locked: input.scope === "instructor" && program.status === "published",
          builderHref: builderHref(input.scope, program.id),
          quizzes: stripOrder(quizzes),
          assignments: stripOrder(assignments),
        };
      }),
    };
  } catch {
    return { ok: false };
  }
}

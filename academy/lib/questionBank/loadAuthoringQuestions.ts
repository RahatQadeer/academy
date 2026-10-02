import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessInstructorArea,
  isAcademyAdmin,
  isInstructor,
} from "@/academy/lib/authorization";
import { isAcademyQuestionType } from "@/academy/lib/domain";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import { optionsFromStorage } from "@/academy/instructor/quiz-editor/utils/validation";
import { isGeneralBankProgram } from "./generalBankConstants";
import { authorableProgramIds } from "./loadQuizTargets";
import type { AuthoringBankQuestion, QuestionBankAuthorScope } from "./types";

const PICKER_LIMIT = 200;

type QuestionRow = {
  id: string;
  quiz_id: string | null;
  program_id: string | null;
  question_text: string;
  type: string;
  options: unknown;
  correct_answer: string | null;
  sort_order: number;
};

export async function loadAuthoringQuestions(input: {
  programId?: string;
  /** Bank-only skips scraping quiz/assignment lessons — much faster for the picker. */
  bankOnly?: boolean;
}): Promise<{ ok: true; items: AuthoringBankQuestion[] } | { ok: false }> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false };

    const actor = { id: profile.user.id };
    const [adminArea, admin, instructorArea, instructor] = await Promise.all([
      canAccessAdminArea(actor),
      isAcademyAdmin(actor),
      canAccessInstructorArea(actor),
      isInstructor(actor),
    ]);

    const isAdmin = adminArea && admin;
    const isAssignedInstructor = instructorArea && instructor;
    if (!isAdmin && !isAssignedInstructor) return { ok: false };

    const scope: QuestionBankAuthorScope = isAdmin ? "admin" : "instructor";
    const supabase = await createClient();
    const allowed = await authorableProgramIds(supabase, profile.user.id, scope);
    const requested = (input.programId ?? "").trim().toLowerCase();
    const programFilter = PROGRAM_ID.test(requested) ? requested : "";

    let programIds: string[] = [];
    if (allowed === "all") {
      if (programFilter) {
        programIds = [programFilter];
      } else {
        // Unrestricted library query below; program IDs filled only if we scrape quizzes.
        programIds = [];
      }
    } else {
      programIds = programFilter ? allowed.filter((id) => id === programFilter) : allowed;
    }
    if (allowed !== "all" && programIds.length === 0) return { ok: true, items: [] };
    if (allowed === "all" && programFilter && programIds.length === 0) return { ok: true, items: [] };

    const items: AuthoringBankQuestion[] = [];

    // Custom bank questions (not yet attached to a quiz).
    let libraryQuery = supabase
      .from("academy_questions")
      .select("id, quiz_id, program_id, question_text, type, options, correct_answer, sort_order")
      .is("quiz_id", null)
      .order("sort_order", { ascending: true })
      .limit(PICKER_LIMIT);
    if (programIds.length > 0) {
      libraryQuery = libraryQuery.in("program_id", programIds);
    } else if (allowed !== "all") {
      return { ok: true, items: [] };
    }

    const { data: libraryRows } = await libraryQuery;

    const libraryProgramIds = [
      ...new Set(
        ((libraryRows ?? []) as QuestionRow[])
          .map((row) => row.program_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const nameIds =
      programIds.length > 0
        ? programIds
        : libraryProgramIds.length > 0
          ? libraryProgramIds
          : [];
    const { data: programRows } =
      nameIds.length > 0
        ? await supabase.from("academy_programs").select("id, name").in("id", nameIds)
        : { data: [] as { id: string; name: string }[] };
    const programs = new Map(
      ((programRows ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]),
    );

    for (const row of (libraryRows ?? []) as QuestionRow[]) {
      if (!row.program_id) continue;
      const programName = programs.get(row.program_id);
      if (!programName) continue;

      if (isAcademyQuestionType(row.type)) {
        const options = optionsFromStorage(row.type, row.options);
        if (options.length < 2) continue;
        items.push({
          id: row.id,
          questionText: row.question_text,
          type: row.type,
          options,
          correctAnswer: row.correct_answer ?? "",
          programId: row.program_id,
          programName: isGeneralBankProgram({ name: programName }) ? "General" : programName,
          moduleTitle: "Question bank",
          lessonTitle: "Not in a quiz yet",
          lessonId: "",
        });
        continue;
      }

      if (row.type !== "assignment" && row.type !== "exercise" && row.type !== "other") continue;
      items.push({
        id: row.id,
        questionText: row.question_text,
        type: row.type,
        options: [],
        correctAnswer: row.correct_answer ?? "",
        programId: row.program_id,
        programName: isGeneralBankProgram({ name: programName }) ? "General" : programName,
        moduleTitle: "Question bank",
        lessonTitle: "Not in a quiz yet",
        lessonId: "",
      });
    }

    if (input.bankOnly || items.length >= PICKER_LIMIT) {
      return { ok: true, items: items.slice(0, PICKER_LIMIT) };
    }

    if (programIds.length === 0) {
      const { data } = await supabase.from("academy_programs").select("id").order("name").limit(120);
      programIds = ((data ?? []) as { id: string }[]).map((row) => row.id);
      if (programIds.length === 0) return { ok: true, items };
      const { data: morePrograms } = await supabase
        .from("academy_programs")
        .select("id, name")
        .in("id", programIds);
      for (const row of (morePrograms ?? []) as { id: string; name: string }[]) {
        programs.set(row.id, row.name);
      }
    }

    const { data: moduleRows } = await supabase
      .from("academy_modules")
      .select("id, program_id, title, sort_order")
      .in("program_id", programIds)
      .order("sort_order", { ascending: true });
    const modules = (moduleRows ?? []) as {
      id: string;
      program_id: string;
      title: string;
      sort_order: number;
    }[];
    const modulesById = new Map(modules.map((module) => [module.id, module]));
    const moduleIds = modules.map((module) => module.id);

    if (moduleIds.length === 0) return { ok: true, items };

    const { data: lessonRows } = await supabase
      .from("academy_lessons")
      .select("id, module_id, title, type, sort_order")
      .in("module_id", moduleIds)
      .in("type", ["quiz", "assignment"])
      .order("sort_order", { ascending: true });
    const lessons = (lessonRows ?? []) as {
      id: string;
      module_id: string;
      title: string;
      type: string;
      sort_order: number;
    }[];
    const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    const quizLessonIds = lessons.filter((lesson) => lesson.type === "quiz").map((lesson) => lesson.id);
    const assignmentLessonIds = lessons
      .filter((lesson) => lesson.type === "assignment")
      .map((lesson) => lesson.id);

    if (quizLessonIds.length > 0) {
      const { data: quizRows } = await supabase
        .from("academy_quizzes")
        .select("id, lesson_id")
        .in("lesson_id", quizLessonIds);
      const quizzes = (quizRows ?? []) as { id: string; lesson_id: string }[];
      const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
      const quizIds = quizzes.map((quiz) => quiz.id);
      if (quizIds.length > 0) {
        const { data: questionRows } = await supabase
          .from("academy_questions")
          .select("id, quiz_id, question_text, type, options, correct_answer, sort_order")
          .in("quiz_id", quizIds)
          .order("sort_order", { ascending: true })
          .limit(PICKER_LIMIT);
        for (const row of (questionRows ?? []) as QuestionRow[]) {
          if (!isAcademyQuestionType(row.type)) continue;
          const quiz = row.quiz_id ? quizById.get(row.quiz_id) : undefined;
          const lesson = quiz ? lessonsById.get(quiz.lesson_id) : undefined;
          const module = lesson ? modulesById.get(lesson.module_id) : undefined;
          if (!quiz || !lesson || !module) continue;
          const programName = programs.get(module.program_id);
          if (!programName) continue;
          const options = optionsFromStorage(row.type, row.options);
          if (options.length < 2) continue;
          items.push({
            id: row.id,
            questionText: row.question_text,
            type: row.type,
            options,
            correctAnswer: row.correct_answer ?? "",
            programId: module.program_id,
            programName,
            moduleTitle: module.title,
            lessonTitle: lesson.title,
            lessonId: lesson.id,
          });
          if (items.length >= PICKER_LIMIT) break;
        }
      }
    }

    if (items.length < PICKER_LIMIT && assignmentLessonIds.length > 0) {
      const { data: assignmentRows } = await supabase
        .from("academy_assignments")
        .select("id, lesson_id, brief")
        .in("lesson_id", assignmentLessonIds);
      for (const row of (assignmentRows ?? []) as { id: string; lesson_id: string; brief: string | null }[]) {
        const brief = (row.brief ?? "").trim();
        if (!brief) continue;
        const lesson = lessonsById.get(row.lesson_id);
        const module = lesson ? modulesById.get(lesson.module_id) : undefined;
        if (!lesson || !module) continue;
        const programName = programs.get(module.program_id);
        if (!programName) continue;
        items.push({
          id: row.id,
          questionText: brief.slice(0, 500),
          type: "assignment",
          options: [],
          correctAnswer: "",
          programId: module.program_id,
          programName,
          moduleTitle: module.title,
          lessonTitle: lesson.title,
          lessonId: lesson.id,
        });
        if (items.length >= PICKER_LIMIT) break;
      }
    }

    return { ok: true, items };
  } catch {
    return { ok: false };
  }
}

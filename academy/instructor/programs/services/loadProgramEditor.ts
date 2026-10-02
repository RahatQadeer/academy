import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { canAccessInstructorArea, canAuthorProgram, isInstructor } from "@/academy/lib/authorization";
import {
  isAcademyLessonType,
  isAcademyProgramType,
  type AcademyLessonType,
  type AcademyProgramStatus,
  type AcademyProgramType,
  type AcademyPublishRequestStatus,
} from "@/academy/lib/domain";
import {
  coerceAccess,
  coerceCredentialValidity,
  coerceLearningPath,
  coerceRecognitionForType,
  normalizeLegacyProgramType,
} from "@/academy/lib/courseMetadata";
import { parseStoredQuizOptions } from "@/academy/lib/questionBank/bankOrigin";
import { loadProgramTagIds } from "@/academy/lib/courseTags/services";
import type {
  EditorAssignment,
  EditorLesson,
  EditorLessonResource,
  EditorModule,
  EditorProgram,
  EditorQuiz,
  EditorQuizQuestion,
  PrerequisiteOption,
  ProgramEditorLoadResult,
} from "../types";
import { loadInstructorAssignmentScope } from "./loadInstructorAssignmentScope";
import { PROGRAM_ID } from "../utils/validation";

type ProgramRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  description: string | null;
  prerequisite_program_id: string | null;
  price: number | string | null;
  status: string;
  updated_at: string;
  created_by_user_id: string | null;
  cover_image_url: string | null;
  unpublished_draft?: unknown;
};

type ModuleRow = { id: string; title: string; sort_order: number };
type LessonRow = {
  id: string;
  module_id: string;
  title: string;
  type: string;
  content_url: string | null;
  content_body: string | null;
  content_summary: string | null;
  learning_objectives: string[] | null;
  video_url: string | null;
  video_duration_seconds: number | null;
  sort_order: number;
};
type RequestRow = { status: string; created_at: string };
type PrerequisiteRow = { id: string; name: string };

const STATUSES = new Set<AcademyProgramStatus>(["draft", "pending_approval", "published"]);
const REQUESTS = new Set<AcademyPublishRequestStatus>(["pending", "approved", "rejected"]);

function asStatus(value: string): AcademyProgramStatus | null {
  return STATUSES.has(value as AcademyProgramStatus) ? (value as AcademyProgramStatus) : null;
}

function asRequest(value: string): AcademyPublishRequestStatus | null {
  return REQUESTS.has(value as AcademyPublishRequestStatus)
    ? (value as AcademyPublishRequestStatus)
    : null;
}

function priceToString(value: number | string | null) {
  if (value == null || value === "") return "";
  return String(value);
}

export async function loadProgramEditor(
  userId: string,
  programId: string,
  options?: { skipAccessCheck?: boolean },
): Promise<ProgramEditorLoadResult> {
  if (!userId || !PROGRAM_ID.test(programId)) {
    return { ok: false, reason: "not_found" };
  }

  try {
    if (!options?.skipAccessCheck) {
      const actor = { id: userId };
      const [area, instructor] = await Promise.all([
        canAccessInstructorArea(actor),
        isInstructor(actor),
      ]);
      if (!area || !instructor) return { ok: false, reason: "unauthorized" };
      if (!(await canAuthorProgram(actor, programId))) {
        return { ok: false, reason: "unauthorized" };
      }
    }

    const supabase = await createClient();
    const assignmentScope = await loadInstructorAssignmentScope(userId, programId);

    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select(
        "id, name, type, access, recognition, learning_path, credential_validity, category, description, prerequisite_program_id, price, status, updated_at, created_by_user_id, cover_image_url, unpublished_draft",
      )
      .eq("id", programId)
      .maybeSingle();

    if (programError) return { ok: false, reason: "failed" };
    if (!program) return { ok: false, reason: "not_found" };

    const row = program as ProgramRow;
    if (!isAcademyProgramType(row.type)) return { ok: false, reason: "failed" };
    const status = asStatus(row.status);
    if (!status) return { ok: false, reason: "failed" };

    const [{ data: moduleRows, error: moduleError }, { data: requestRows }, { data: prereqRows }] =
      await Promise.all([
        supabase
          .from("academy_modules")
          .select("id, title, sort_order")
          .eq("program_id", programId)
          .order("sort_order", { ascending: true })
          .limit(100),
        supabase
          .from("academy_publish_requests")
          .select("status, created_at")
          .eq("program_id", programId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("academy_programs")
          .select("id, name")
          .eq("status", "published")
          .order("name", { ascending: true })
          .limit(48),
      ]);

    if (moduleError) return { ok: false, reason: "failed" };

    let modulesMeta = ((moduleRows ?? []) as ModuleRow[]).sort((a, b) => a.sort_order - b.sort_order);

    const scopedModuleIds = assignmentScope?.moduleIds ?? [];
    const scopedModuleTitles: string[] = [];
    if (scopedModuleIds.length > 0) {
      const allowed = new Set(scopedModuleIds);
      modulesMeta = modulesMeta.filter((module) => {
        if (allowed.has(module.id)) {
          scopedModuleTitles.push(module.title);
          return true;
        }
        return false;
      });
    }

    const moduleIds = modulesMeta.map((item) => item.id);

    let lessons: LessonRow[] = [];
    if (moduleIds.length > 0) {
      const { data: lessonRows, error: lessonError } = await supabase
        .from("academy_lessons")
        .select(
          "id, module_id, title, type, content_url, content_body, content_summary, learning_objectives, video_url, video_duration_seconds, sort_order",
        )
        .in("module_id", moduleIds)
        .order("sort_order", { ascending: true })
        .limit(500);
      if (lessonError) return { ok: false, reason: "failed" };
      lessons = (lessonRows ?? []) as LessonRow[];
    }

    const lessonIds = lessons.map((item) => item.id);
    const [{ data: resources }, { data: assignments }, { data: quizzes }] = await Promise.all([
      lessonIds.length > 0
        ? supabase
            .from("academy_lesson_resources")
            .select("id, lesson_id, title, resource_type, url, notes, sort_order")
            .in("lesson_id", lessonIds)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [] }),
      lessonIds.length > 0
        ? supabase
            .from("academy_assignments")
            .select("id, lesson_id, brief, submission_instructions, rubric, estimated_minutes")
            .in("lesson_id", lessonIds)
        : Promise.resolve({ data: [] }),
      lessonIds.length > 0
        ? supabase
            .from("academy_quizzes")
            .select("id, lesson_id, passing_score")
            .in("lesson_id", lessonIds)
        : Promise.resolve({ data: [] }),
    ]);

    const quizIds = ((quizzes ?? []) as { id: string }[]).map((quiz) => quiz.id);
    const { data: questions } =
      quizIds.length > 0
        ? await supabase
            .from("academy_questions")
            .select("id, quiz_id, question_text, type, options, correct_answer, sort_order")
            .in("quiz_id", quizIds)
            .order("sort_order", { ascending: true })
        : { data: [] };

    const resourcesByLesson = new Map<string, EditorLessonResource[]>();
    for (const resource of (resources ?? []) as {
      id: string;
      lesson_id: string;
      title: string;
      resource_type: string;
      url: string | null;
      notes: string | null;
      sort_order: number;
    }[]) {
      const list = resourcesByLesson.get(resource.lesson_id) ?? [];
      list.push({
        id: resource.id,
        title: resource.title,
        resourceType: resource.resource_type,
        url: resource.url ?? "",
        notes: resource.notes ?? "",
        sortOrder: resource.sort_order,
      });
      resourcesByLesson.set(resource.lesson_id, list);
    }

    const assignmentByLesson = new Map<string, EditorAssignment>();
    for (const assignment of (assignments ?? []) as {
      id: string;
      lesson_id: string;
      brief: string;
      submission_instructions: string;
      rubric: string;
      estimated_minutes: number | null;
    }[]) {
      assignmentByLesson.set(assignment.lesson_id, {
        id: assignment.id,
        brief: assignment.brief,
        submissionInstructions: assignment.submission_instructions,
        rubric: assignment.rubric,
        estimatedMinutes:
          assignment.estimated_minutes == null ? "" : String(assignment.estimated_minutes),
      });
    }

    const questionsByQuiz = new Map<string, EditorQuizQuestion[]>();
    for (const question of (questions ?? []) as {
      id: string;
      quiz_id: string;
      question_text: string;
      type: "multiple_choice" | "true_false";
      options: unknown;
      correct_answer: string | null;
      sort_order: number;
    }[]) {
      const list = questionsByQuiz.get(question.quiz_id) ?? [];
      const parsed = parseStoredQuizOptions(question.options);
      list.push({
        id: question.id,
        questionText: question.question_text,
        type: question.type,
        options: parsed.choices,
        correctAnswer: question.correct_answer ?? "",
        sortOrder: question.sort_order,
        fromBank: parsed.fromBank || undefined,
      });
      questionsByQuiz.set(question.quiz_id, list);
    }

    const quizByLesson = new Map<string, EditorQuiz>();
    for (const quiz of (quizzes ?? []) as { id: string; lesson_id: string; passing_score: number }[]) {
      quizByLesson.set(quiz.lesson_id, {
        id: quiz.id,
        passingScore: String(quiz.passing_score),
        questions: questionsByQuiz.get(quiz.id) ?? [],
      });
    }

    const lessonsByModule = new Map<string, EditorLesson[]>();
    for (const lesson of lessons.sort((a, b) => a.sort_order - b.sort_order)) {
      if (!isAcademyLessonType(lesson.type)) continue;
      const quiz = quizByLesson.get(lesson.id) ?? null;
      const list = lessonsByModule.get(lesson.module_id) ?? [];
      list.push({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type as AcademyLessonType,
        contentUrl: lesson.content_url ?? "",
        contentBody: lesson.content_body ?? "",
        contentSummary: lesson.content_summary ?? "",
        learningObjectives: lesson.learning_objectives ?? [],
        videoUrl: lesson.video_url ?? "",
        videoDurationSeconds: lesson.video_duration_seconds ?? 0,
        sortOrder: lesson.sort_order,
        resources: resourcesByLesson.get(lesson.id) ?? [],
        assignment: assignmentByLesson.get(lesson.id) ?? null,
        quiz,
        quizId: quiz?.id ?? null,
      });
      lessonsByModule.set(lesson.module_id, list);
    }

    const modules: EditorModule[] = modulesMeta.map((module, index) => ({
      id: module.id,
      title: module.title,
      sortOrder: index,
      lessons: (lessonsByModule.get(module.id) ?? []).map((lesson, lessonIndex) => ({
        ...lesson,
        sortOrder: lessonIndex,
      })),
    }));

    const latest = (requestRows ?? [])[0] as RequestRow | undefined;
    const prerequisites: PrerequisiteOption[] = ((prereqRows ?? []) as PrerequisiteRow[])
      .filter((item) => item.id !== programId)
      .map((item) => ({ id: item.id, name: item.name }));

    const courseType = normalizeLegacyProgramType(String(row.type)) as AcademyProgramType;
    const data: EditorProgram = {
      id: row.id,
      name: row.name,
      type: courseType,
      access: coerceAccess((row as { access?: string | null }).access, courseType),
      recognition: coerceRecognitionForType(
        courseType,
        (row as { recognition?: string | null }).recognition,
      ),
      learningPath: coerceLearningPath(
        (row as { learning_path?: string | null }).learning_path,
        courseType,
      ),
      credentialValidity: coerceCredentialValidity(
        (row as { credential_validity?: string | null }).credential_validity,
        courseType,
        (row as { recognition?: string | null }).recognition,
      ),
      category: row.category ?? "",
      description: row.description ?? "",
      prerequisiteProgramId: row.prerequisite_program_id ?? "",
      price: priceToString(row.price),
      tagIds: await loadProgramTagIds(programId),
      status,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id,
      coverImageUrl: row.cover_image_url ?? "",
      modules,
      latestRequestStatus: latest ? asRequest(latest.status) : null,
      latestRequestAt: latest?.created_at ?? null,
      prerequisites,
      assignmentScope: assignmentScope
        ? {
            permissionLevel: assignmentScope.permissionLevel,
            moduleIds: assignmentScope.moduleIds,
            scopedModuleTitles,
            canPublishWithoutApproval: assignmentScope.canPublishWithoutApproval,
          }
        : null,
      canPublishWithoutApproval: assignmentScope?.canPublishWithoutApproval ?? false,
      hasUnpublishedChanges: false,
    };

    if (status === "published") {
      const { applyUnpublishedDraftToEditor, isUnpublishedDraftPayload } = await import(
        "@/academy/lib/unpublishedDraft"
      );
      if (isUnpublishedDraftPayload(row.unpublished_draft)) {
        return {
          ok: true,
          data: applyUnpublishedDraftToEditor(data, row.unpublished_draft),
        };
      }
    }

    return { ok: true, data };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

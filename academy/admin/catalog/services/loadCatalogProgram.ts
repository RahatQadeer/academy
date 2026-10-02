import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, canAuthorProgram, isAcademyAdmin } from "@/academy/lib/authorization";
import { ACTIVE_ACADEMY_ENROLLMENT_STATUSES } from "@/academy/lib/domain";
import {
  coerceAccess,
  coerceCredentialValidity,
  coerceLearningPath,
  coerceRecognitionForType,
  normalizeLegacyProgramType,
} from "@/academy/lib/courseMetadata";
import { parseStoredQuizOptions } from "@/academy/lib/questionBank/bankOrigin";
import { loadProgramTagIds } from "@/academy/lib/courseTags/services";
import type { CatalogAssignment, CatalogLesson, CatalogLessonResource, CatalogProgramDetail, CatalogQuiz, CatalogQuizQuestion } from "../types";

type Result =
  | { ok: true; program: CatalogProgramDetail }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" };

export async function loadCatalogProgram(programId: string): Promise<Result> {
  noStore();
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };

    const actor = { id: profile.user.id };
    const [area, admin, author] = await Promise.all([
      canAccessAdminArea(actor),
      isAcademyAdmin(actor),
      canAuthorProgram(actor, programId),
    ]);
    if (!(area && admin) && !author) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();

    const { data: program, error } = await supabase
      .from("academy_programs")
      .select("id, name, description, category, type, access, recognition, learning_path, credential_validity, status, cover_image_url, price, prerequisite_program_id, unpublished_draft")
      .eq("id", programId)
      .single();

    if (error || !program) return { ok: false, reason: "not_found" };

    const { data: modules } = await supabase
      .from("academy_modules")
      .select("id, title, sort_order")
      .eq("program_id", programId)
      .order("sort_order", { ascending: true });

    const moduleIds = (modules ?? []).map((m: { id: string }) => m.id);
    let lessonsMap: Record<string, CatalogLesson[]> = {};
    if (moduleIds.length > 0) {
      const { data: lessons } = await supabase
        .from("academy_lessons")
        .select(
          "id, title, type, content_url, content_body, content_summary, learning_objectives, video_url, module_id, sort_order",
        )
        .in("module_id", moduleIds)
        .order("sort_order", { ascending: true });

      const lessonRows = (lessons ??
        []) as {
        id: string;
        title: string;
        type: CatalogLesson["type"];
        content_url: string | null;
        content_body: string | null;
        content_summary: string | null;
        learning_objectives: string[] | null;
        video_url: string | null;
        module_id: string;
        sort_order: number;
      }[];

      const lessonIds = lessonRows.map((lesson) => lesson.id);
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

      const resourcesByLesson = new Map<string, CatalogLessonResource[]>();
      for (const resource of (resources ??
        []) as {
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

      const assignmentByLesson = new Map<string, CatalogAssignment>();
      for (const assignment of (assignments ??
        []) as {
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

      const questionsByQuiz = new Map<string, CatalogQuizQuestion[]>();
      for (const question of (questions ??
        []) as {
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

      const quizByLesson = new Map<string, CatalogQuiz>();
      for (const quiz of (quizzes ??
        []) as { id: string; lesson_id: string; passing_score: number }[]) {
        quizByLesson.set(quiz.lesson_id, {
          id: quiz.id,
          passingScore: String(quiz.passing_score),
          questions: questionsByQuiz.get(quiz.id) ?? [],
        });
      }

      for (const lesson of lessonRows) {
        if (!lessonsMap[lesson.module_id]) lessonsMap[lesson.module_id] = [];
        lessonsMap[lesson.module_id].push({
          id: lesson.id,
          title: lesson.title,
          type: lesson.type,
          contentUrl: lesson.content_url ?? "",
          contentBody: lesson.content_body ?? "",
          contentSummary: lesson.content_summary ?? "",
          learningObjectives: lesson.learning_objectives ?? [],
          videoUrl: lesson.video_url ?? "",
          videoDurationSeconds: (lesson as Record<string, unknown>).video_duration_seconds as number ?? 0,
          sortOrder: lesson.sort_order,
          resources: resourcesByLesson.get(lesson.id) ?? [],
          assignment: assignmentByLesson.get(lesson.id) ?? null,
          quiz: quizByLesson.get(lesson.id) ?? null,
        });
      }
    }

    const [{ count: enrollmentCount }, { count: activeEnrollmentCount }, { data: requestRows }, { data: prereqRows }, tagIds] = await Promise.all([
      supabase
        .from("academy_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("program_id", programId),
      supabase
        .from("academy_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("program_id", programId)
        .in("status", [...ACTIVE_ACADEMY_ENROLLMENT_STATUSES]),
      supabase
        .from("academy_publish_requests")
        .select("status")
        .eq("program_id", programId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("academy_programs")
        .select("id, name")
        .neq("id", programId)
        .in("status", ["published", "pending_approval", "draft"])
        .order("name", { ascending: true })
        .limit(80),
      loadProgramTagIds(programId),
    ]);

    const latestRequest = (requestRows ?? [])[0] as { status?: string } | undefined;
    const latestRequestStatus =
      latestRequest?.status === "pending" ||
      latestRequest?.status === "approved" ||
      latestRequest?.status === "rejected"
        ? latestRequest.status
        : null;

    const courseType = normalizeLegacyProgramType(String(program.type));
    let detail: CatalogProgramDetail = {
      id: program.id,
      name: program.name,
      description: program.description ?? "",
      category: program.category ?? "",
      type: courseType,
      access: coerceAccess(
        (program as { access?: string | null }).access,
        courseType,
      ),
      recognition: coerceRecognitionForType(
        courseType,
        (program as { recognition?: string | null }).recognition,
      ),
      learningPath: coerceLearningPath(
        (program as { learning_path?: string | null }).learning_path,
        courseType,
      ),
      credentialValidity: coerceCredentialValidity(
        (program as { credential_validity?: string | null }).credential_validity,
        courseType,
        (program as { recognition?: string | null }).recognition,
      ),
      price:
        program.price == null || program.price === ""
          ? ""
          : String(Number(program.price)),
      prerequisiteProgramId: (program as { prerequisite_program_id?: string | null }).prerequisite_program_id ?? "",
      prerequisites: ((prereqRows ?? []) as { id: string; name: string }[]).map((item) => ({
        id: item.id,
        name: item.name,
      })),
      status: program.status as CatalogProgramDetail["status"],
      enrollmentCount: enrollmentCount ?? 0,
      activeEnrollmentCount: activeEnrollmentCount ?? 0,
      coverImageUrl: program.cover_image_url ?? "",
      latestRequestStatus,
      hasUnpublishedChanges: false,
      tagIds,
      modules: (modules ?? []).map((m: { id: string; title: string; sort_order: number }) => ({
        id: m.id,
        title: m.title,
        sortOrder: m.sort_order,
        lessons: lessonsMap[m.id] ?? [],
      })),
    };

    if (program.status === "published") {
      const { applyUnpublishedDraftToCatalog, isUnpublishedDraftPayload } = await import(
        "@/academy/lib/unpublishedDraft"
      );
      const raw = (program as { unpublished_draft?: unknown }).unpublished_draft;
      if (isUnpublishedDraftPayload(raw)) {
        detail = applyUnpublishedDraftToCatalog(detail, raw);
      }
    }

    return {
      ok: true,
      program: detail,
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

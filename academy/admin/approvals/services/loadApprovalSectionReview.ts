import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  isAcademyLessonType,
  isAcademyProgramType,
  isAcademyPublishRequestStatus,
  programTypeLabel,
} from "@/academy/lib/domain";
import type { ApprovalSectionReviewDetail } from "../../types";
import { UUID } from "../../types";

export type ApprovalSectionReviewResult =
  | { ok: true; data: ApprovalSectionReviewDetail }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" };

function scopeLabel(moduleIds: string[], modules: { id: string; title: string }[]): string {
  if (moduleIds.length === 0) return "Full program";
  if (moduleIds.length === 1) {
    const index = modules.findIndex((module) => module.id === moduleIds[0]);
    return index >= 0 ? `Module ${index + 1} only` : "Scoped module";
  }
  return `${moduleIds.length} modules`;
}

export async function loadApprovalSectionReview(
  requestId: string,
  lessonId: string,
): Promise<ApprovalSectionReviewResult> {
  if (!UUID.test(requestId) || !UUID.test(lessonId)) {
    return { ok: false, reason: "not_found" };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: request, error: requestError } = await supabase
      .from("academy_publish_requests")
      .select("id, program_id, submitted_by_user_id, status, created_at")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError || !request) return { ok: false, reason: "not_found" };
    if (!isAcademyPublishRequestStatus(request.status)) return { ok: false, reason: "not_found" };

    const [{ data: program }, { data: lesson }, { data: user }, { data: assignment }] = await Promise.all([
      supabase
        .from("academy_programs")
        .select("id, name, type, category")
        .eq("id", request.program_id)
        .maybeSingle(),
      supabase
        .from("academy_lessons")
        .select(
          "id, title, type, content_body, content_summary, learning_objectives, video_url, module_id, sort_order",
        )
        .eq("id", lessonId)
        .maybeSingle(),
      supabase
        .from("users")
        .select("preferred_name, full_name")
        .eq("id", request.submitted_by_user_id)
        .maybeSingle(),
      supabase
        .from("academy_instructor_assignments")
        .select("module_ids")
        .eq("user_id", request.submitted_by_user_id)
        .eq("program_id", request.program_id)
        .maybeSingle(),
    ]);

    if (!program || !lesson || !isAcademyProgramType(program.type)) {
      return { ok: false, reason: "not_found" };
    }

    const lessonType = isAcademyLessonType(lesson.type) ? lesson.type : "reading";

    const { data: moduleRow } = await supabase
      .from("academy_modules")
      .select("id, title, sort_order, program_id")
      .eq("id", lesson.module_id)
      .maybeSingle();
    if (!moduleRow || moduleRow.program_id !== program.id) {
      return { ok: false, reason: "not_found" };
    }

    const { data: moduleRows } = await supabase
      .from("academy_modules")
      .select("id, title, sort_order")
      .eq("program_id", program.id)
      .order("sort_order", { ascending: true });

    const modules = (moduleRows ?? []) as { id: string; title: string; sort_order: number }[];
    const moduleIndex = modules.findIndex((module) => module.id === moduleRow.id);
    if (moduleIndex < 0) return { ok: false, reason: "not_found" };

    const [{ data: lessonRows }, { data: resourceRows }, { data: assignmentRow }, { data: quizRow }] =
      await Promise.all([
        supabase
          .from("academy_lessons")
          .select("id, title, sort_order")
          .eq("module_id", moduleRow.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("academy_lesson_resources")
          .select("id, title, resource_type, url, notes, sort_order")
          .eq("lesson_id", lesson.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("academy_assignments")
          .select("id, brief, submission_instructions, rubric, estimated_minutes")
          .eq("lesson_id", lesson.id)
          .maybeSingle(),
        supabase.from("academy_quizzes").select("id").eq("lesson_id", lesson.id).maybeSingle(),
      ]);

    const lessons = (lessonRows ?? []) as { id: string; title: string; sort_order: number }[];
    const lessonIndex = lessons.findIndex((entry) => entry.id === lesson.id);
    if (lessonIndex < 0) return { ok: false, reason: "not_found" };

    let quizQuestionCount = 0;
    if (quizRow?.id) {
      const { count } = await supabase
        .from("academy_questions")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", quizRow.id);
      quizQuestionCount = count ?? 0;
    }

    const previous = lessons[lessonIndex - 1];
    const next = lessons[lessonIndex + 1];
    const moduleNumber = moduleIndex + 1;

    const submittedByName =
      (user?.preferred_name || user?.full_name || "").trim() || "Instructor";
    const category = program.category?.trim() ?? "";
    const specialtyLabel = category || programTypeLabel(program.type);
    const lessonNumber = lessonIndex + 1;
    const sectionLabel = `Module ${moduleNumber}.${lessonNumber} — ${lesson.title}`;
    const moduleIds = (assignment?.module_ids ?? []) as string[];

    return {
      ok: true,
      data: {
        requestId: request.id,
        status: request.status,
        submittedByName,
        submittedAt: request.created_at,
        scopeLabel: scopeLabel(moduleIds, modules),
        sectionLabel,
        specialtyLabel,
        contentHeader: `${specialtyLabel} · Module ${moduleNumber}`,
        program: {
          id: program.id,
          name: program.name,
          category,
          type: program.type,
        },
        module: {
          id: moduleRow.id,
          index: moduleNumber,
          title: moduleRow.title,
        },
        lesson: {
          id: lesson.id,
          index: lessonNumber,
          title: lesson.title,
          type: lessonType,
          contentBody: lesson.content_body?.trim() ?? "",
          contentSummary: lesson.content_summary?.trim() ?? "",
          learningObjectives: Array.isArray(lesson.learning_objectives)
            ? lesson.learning_objectives.map((item: string) => String(item).trim()).filter(Boolean)
            : [],
          videoUrl: lesson.video_url?.trim() ?? "",
          resources: ((resourceRows ?? []) as {
            id: string;
            title: string;
            resource_type: string;
            url: string | null;
            notes: string | null;
            sort_order: number;
          }[]).map((resource) => ({
            id: resource.id,
            title: resource.title,
            resourceType: resource.resource_type,
            url: resource.url ?? "",
            notes: resource.notes ?? "",
            sortOrder: resource.sort_order,
          })),
          assignment: assignmentRow
            ? {
                id: assignmentRow.id,
                brief: assignmentRow.brief ?? "",
                submissionInstructions: assignmentRow.submission_instructions ?? "",
                rubric: assignmentRow.rubric ?? "",
                estimatedMinutes:
                  assignmentRow.estimated_minutes == null ? "" : String(assignmentRow.estimated_minutes),
              }
            : null,
          quizQuestionCount,
        },
        adjacent: {
          previous: previous
            ? {
                id: previous.id,
                label: `${moduleNumber}.${lessonIndex} ${previous.title}`,
              }
            : null,
          next: next
            ? {
                id: next.id,
                label: `${moduleNumber}.${lessonIndex + 2} ${next.title}`,
              }
            : null,
        },
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

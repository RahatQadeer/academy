import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  isAcademyLessonType,
  isAcademyProgramType,
  isAcademyPublishRequestStatus,
  type AcademyProgramStatus,
} from "@/academy/lib/domain";
import {
  collectProgramContentSnapshot,
  lessonWasChanged,
  loadProgramContentSnapshotBefore,
} from "@/academy/lib/programContentSnapshot";
import type { ApprovalRequestResult, ReviewLesson, ReviewModule, InstructorRecentActivity } from "../../types";
import { UUID } from "../../types";

type RequestRow = {
  id: string;
  program_id: string;
  submitted_by_user_id: string;
  status: string;
  notes: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
};

type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  category: string | null;
  price: number | string | null;
  status: string;
  prerequisite_program_id: string | null;
};

type ModuleRow = { id: string; title: string; sort_order: number };
type LessonRow = {
  id: string;
  module_id: string;
  title: string;
  type: string;
  sort_order: number;
  content_body: string | null;
  content_summary: string | null;
};
type QuizRow = { lesson_id: string };

const PROGRAM_STATUSES = new Set<AcademyProgramStatus>(["draft", "pending_approval", "published"]);

function asProgramStatus(value: string): AcademyProgramStatus | null {
  return PROGRAM_STATUSES.has(value as AcademyProgramStatus) ? (value as AcademyProgramStatus) : null;
}

function formatActivityWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}

function priceLabel(value: number | string | null) {
  if (value == null || value === "") return "Free";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Free";
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function lessonReviewState(input: {
  inScope: boolean;
  isPending: boolean;
  changed: boolean;
}): ReviewLesson["reviewState"] {
  if (!input.inScope) return "out_of_scope";
  if (!input.isPending) return "unchanged";
  return input.changed ? "changed" : "unchanged";
}

export async function loadPublishRequest(requestId: string): Promise<ApprovalRequestResult> {
  if (!UUID.test(requestId)) return { ok: false, reason: "not_found" };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: request, error: requestError } = await supabase
      .from("academy_publish_requests")
      .select(
        "id, program_id, submitted_by_user_id, status, notes, reviewed_at, published_at, created_at",
      )
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) return { ok: false, reason: "failed" };
    const requestRow = request as RequestRow | null;
    if (!requestRow || !isAcademyPublishRequestStatus(requestRow.status)) {
      return { ok: false, reason: "not_found" };
    }

    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select(
        "id, name, description, type, category, price, status, prerequisite_program_id",
      )
      .eq("id", requestRow.program_id)
      .maybeSingle();

    if (programError) return { ok: false, reason: "failed" };
    const programRow = program as ProgramRow | null;
    if (!programRow || !isAcademyProgramType(programRow.type)) {
      return { ok: false, reason: "not_found" };
    }
    const programStatus = asProgramStatus(programRow.status);
    if (!programStatus) return { ok: false, reason: "failed" };

    const [{ data: moduleRows, error: moduleError }, { data: userRow }, { data: prereqRow }, { data: assignmentRow }, enrollmentCountResult, { data: activityRows }] =
      await Promise.all([
        supabase
          .from("academy_modules")
          .select("id, title, sort_order")
          .eq("program_id", programRow.id)
          .order("sort_order", { ascending: true })
          .limit(100),
        supabase
          .from("users")
          .select("preferred_name, full_name")
          .eq("id", requestRow.submitted_by_user_id)
          .maybeSingle(),
        programRow.prerequisite_program_id
          ? supabase
              .from("academy_programs")
              .select("name")
              .eq("id", programRow.prerequisite_program_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("academy_instructor_assignments")
          .select("module_ids")
          .eq("user_id", requestRow.submitted_by_user_id)
          .eq("program_id", programRow.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("academy_enrollments")
          .select("id", { count: "exact", head: true })
          .eq("program_id", programRow.id),
        supabase
          .from("academy_publish_requests")
          .select("id, status, reviewed_at, published_at, created_at, program_id")
          .eq("submitted_by_user_id", requestRow.submitted_by_user_id)
          .neq("id", requestId)
          .eq("status", "approved")
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
          .limit(5),
      ]);

    if (moduleError) return { ok: false, reason: "failed" };

    const modulesMeta = ((moduleRows ?? []) as ModuleRow[]).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const moduleIds = modulesMeta.map((item) => item.id);
    const scopedModuleIds = ((assignmentRow as { module_ids?: string[] | null } | null)?.module_ids ??
      []) as string[];
    const usesScopedModules = scopedModuleIds.length > 0;
    const moduleInScope = (moduleId: string) =>
      !usesScopedModules || scopedModuleIds.includes(moduleId);
    const isPending = requestRow.status === "pending";
    const [currentSnapshot, baseline] = await Promise.all([
      collectProgramContentSnapshot(supabase, programRow.id),
      isPending
        ? loadProgramContentSnapshotBefore(programRow.id, requestRow.created_at)
        : Promise.resolve(null),
    ]);

    let lessons: LessonRow[] = [];
    let quizLessonIds = new Set<string>();
    if (moduleIds.length > 0) {
      const { data: lessonRows, error: lessonError } = await supabase
        .from("academy_lessons")
        .select("id, module_id, title, type, sort_order, content_body, content_summary")
        .in("module_id", moduleIds)
        .order("sort_order", { ascending: true })
        .limit(500);
      if (lessonError) return { ok: false, reason: "failed" };
      lessons = (lessonRows ?? []) as LessonRow[];

      const quizLessons = lessons.filter((item) => item.type === "quiz").map((item) => item.id);
      if (quizLessons.length > 0) {
        const { data: quizRows, error: quizError } = await supabase
          .from("academy_quizzes")
          .select("lesson_id")
          .in("lesson_id", quizLessons)
          .limit(500);
        if (quizError) return { ok: false, reason: "failed" };
        quizLessonIds = new Set(((quizRows ?? []) as QuizRow[]).map((item) => item.lesson_id));
      }
    }

    const lessonsByModule = new Map<string, ReviewLesson[]>();
    const lessonsInModule = new Map<string, LessonRow[]>();
    for (const lesson of lessons.sort((a, b) => a.sort_order - b.sort_order)) {
      if (!isAcademyLessonType(lesson.type)) continue;
      const list = lessonsInModule.get(lesson.module_id) ?? [];
      list.push(lesson);
      lessonsInModule.set(lesson.module_id, list);
    }

    for (let moduleIndex = 0; moduleIndex < modulesMeta.length; moduleIndex += 1) {
      const module = modulesMeta[moduleIndex];
      const moduleLessons = lessonsInModule.get(module.id) ?? [];
      const reviewLessons: ReviewLesson[] = [];
      for (let lessonIndex = 0; lessonIndex < moduleLessons.length; lessonIndex += 1) {
        const lesson = moduleLessons[lessonIndex];
        const inScope = moduleInScope(lesson.module_id);
        const current = currentSnapshot.find(
          (item) => item.moduleIndex === moduleIndex && item.lessonIndex === lessonIndex,
        );
        reviewLessons.push({
          id: lesson.id,
          title: lesson.title,
          type: lesson.type,
          hasQuiz: lesson.type === "quiz" && quizLessonIds.has(lesson.id),
          reviewState: lessonReviewState({
            inScope,
            isPending,
            changed: current ? lessonWasChanged(current, baseline) : false,
          }),
        });
      }
      lessonsByModule.set(module.id, reviewLessons);
    }

    const modules: ReviewModule[] = modulesMeta.map((module) => ({
      id: module.id,
      title: module.title,
      inScope: moduleInScope(module.id),
      lessons: lessonsByModule.get(module.id) ?? [],
    }));

    let sectionsChanged = 0;
    let sectionsTotal = 0;
    for (const module of modules) {
      if (!module.inScope) continue;
      for (const lesson of module.lessons) {
        sectionsTotal += 1;
        if (lesson.reviewState === "changed") sectionsChanged += 1;
      }
    }
    if (sectionsTotal === 0) {
      sectionsTotal = modules.filter((module) => module.inScope).length;
      sectionsChanged = isPending ? Math.min(1, sectionsTotal) : 0;
    }

    const submitter = userRow as { preferred_name: string | null; full_name: string | null } | null;
    const submittedByName = (submitter?.preferred_name || submitter?.full_name || "").trim() || "Instructor";
    const prereq = prereqRow as { name: string } | null;

    const activityProgramIds = [
      ...new Set(((activityRows ?? []) as { program_id: string }[]).map((row) => row.program_id)),
    ];
    const activityProgramNames = new Map<string, string>();
    if (activityProgramIds.length > 0) {
      const { data: activityPrograms } = await supabase
        .from("academy_programs")
        .select("id, name")
        .in("id", activityProgramIds);
      for (const row of (activityPrograms ?? []) as { id: string; name: string }[]) {
        activityProgramNames.set(row.id, row.name);
      }
    }

    const recentActivity: InstructorRecentActivity[] = ((activityRows ?? []) as {
      id: string;
      program_id: string;
      published_at: string | null;
    }[]).map((row, index) => {
      let title = activityProgramNames.get(row.program_id) ?? "Program update";
      if (row.program_id === programRow.id) {
        const scopedModule = modules.find((module) => module.inScope && module.lessons.length > 0);
        const lesson = scopedModule?.lessons[0];
        if (scopedModule && lesson) {
          const moduleIndex = modules.findIndex((module) => module.id === scopedModule.id) + 1;
          title = `Module ${moduleIndex}.1 — ${lesson.title}`;
        }
      } else if (index === 0) {
        title = activityProgramNames.get(row.program_id) ?? title;
      }
      return {
        id: row.id,
        title,
        detail: `Approved & published · ${formatActivityWhen(row.published_at ?? "")}`,
      };
    });

    return {
      ok: true,
      data: {
        id: requestRow.id,
        status: requestRow.status,
        notes: requestRow.notes,
        submittedByName,
        submittedByUserId: requestRow.submitted_by_user_id,
        submittedAt: requestRow.created_at,
        reviewedAt: requestRow.reviewed_at,
        publishedAt: requestRow.published_at,
        enrollmentCount: enrollmentCountResult.count ?? 0,
        sectionsChanged,
        sectionsTotal,
        recentActivity,
        program: {
          id: programRow.id,
          name: programRow.name,
          description: programRow.description ?? "",
          type: programRow.type,
          category: programRow.category ?? "",
          price: priceLabel(programRow.price),
          status: programStatus,
          prerequisiteName: prereq?.name ?? null,
        },
        modules,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

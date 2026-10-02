import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import type { AcademyLessonType, AcademyProgressStatus, AcademyEntitlementSource } from "@/academy/lib/domain";
import { learnerCanAccessProgramContent, isPaidProgram } from "@/academy/lib/learnerProgramAccess";
import { isAcademyAssignmentSubmissionStatus } from "@/academy/lib/domain";
import type { AssignmentSubmissionView } from "@/academy/assignments/types";
import { learnerAssignmentState } from "@/academy/assignments/utils/labels";
import type {
  CurriculumModule,
  LessonMedia,
  LessonPlayerResult,
  LessonRichContent,
} from "../types";
import {
  PROGRAM_ID,
  academyObjectPath,
  adjacentLessons,
  fileNameFromPath,
  firstPlayableLessonId,
  isHttpUrl,
} from "../utils/curriculum";

const SIGNED_URL_SECONDS = 60 * 60;
const READING_TEXT_LIMIT = 100_000;

type ModuleRow = { id: string; title: string; sort_order: number };
type LessonRow = {
  id: string;
  module_id: string;
  title: string;
  type: AcademyLessonType;
  content_url: string | null;
  sort_order: number;
};
type ProgressRow = { lesson_id: string; status: AcademyProgressStatus };
type EnrollmentRow = {
  id: string;
  user_id: string;
  program_id: string;
  entitlement_source: AcademyEntitlementSource | null;
};

async function signedAcademyUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  objectPath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("academy")
    .createSignedUrl(objectPath, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function loadReadingText(signedUrl: string): Promise<string | null> {
  try {
    const response = await fetch(signedUrl);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (
      contentType &&
      !contentType.includes("text") &&
      !contentType.includes("json") &&
      !contentType.includes("markdown")
    ) {
      return null;
    }
    const text = await response.text();
    if (text.length > READING_TEXT_LIMIT) {
      return `${text.slice(0, READING_TEXT_LIMIT)}\n\n[Reading truncated]`;
    }
    return text;
  } catch {
    return null;
  }
}

async function loadAssignmentSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  assignmentId: string | null,
): Promise<AssignmentSubmissionView | null> {
  if (!assignmentId) return null;

  const { data, error } = await supabase
    .from("academy_assignment_submissions")
    .select(
      "id, status, body, file_storage_path, file_name, score, max_score, feedback, submitted_at, graded_at, attempt_count",
    )
    .eq("assignment_id", assignmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string;
    status: string;
    body: string;
    file_storage_path: string | null;
    file_name: string | null;
    score: number | string | null;
    max_score: number | string | null;
    feedback: string;
    submitted_at: string | null;
    graded_at: string | null;
    attempt_count: number;
  };

  if (!isAcademyAssignmentSubmissionStatus(row.status)) return null;

  let fileUrl: string | null = null;
  if (row.file_storage_path) {
    fileUrl = await signedAcademyUrl(supabase, row.file_storage_path);
  }

  const score = row.score == null ? null : Number(row.score);
  const maxScore = row.max_score == null ? 100 : Number(row.max_score);

  return {
    id: row.id,
    status: row.status,
    learnerState: learnerAssignmentState(row.status),
    body: row.body ?? "",
    fileName: row.file_name,
    fileUrl,
    score: score != null && Number.isFinite(score) ? score : null,
    maxScore: Number.isFinite(maxScore) && maxScore > 0 ? maxScore : 100,
    feedback: row.feedback ?? "",
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    attemptCount: row.attempt_count ?? 0,
  };
}

async function loadRichContent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string,
): Promise<LessonRichContent> {
  const empty: LessonRichContent = {
    contentSummary: "",
    contentBody: "",
    learningObjectives: [],
    videoUrl: "",
    resources: [],
    assignment: null,
  };

  const { data: lesson, error } = await supabase
    .from("academy_lessons")
    .select("content_body, content_summary, learning_objectives, video_url")
    .eq("id", lessonId)
    .maybeSingle();

  if (error || !lesson) return empty;

  const row = lesson as {
    content_body: string | null;
    content_summary: string | null;
    learning_objectives: string[] | null;
    video_url: string | null;
  };

  const [{ data: resources }, { data: assignment }] = await Promise.all([
    supabase
      .from("academy_lesson_resources")
      .select("title, resource_type, url, notes, sort_order")
      .eq("lesson_id", lessonId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("academy_assignments")
      .select("id, brief, submission_instructions, estimated_minutes")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
  ]);

  const assignmentRow = assignment as {
    id: string;
    brief: string;
    submission_instructions: string;
    estimated_minutes: number | null;
  } | null;

  return {
    contentSummary: row.content_summary ?? "",
    contentBody: row.content_body ?? "",
    learningObjectives: row.learning_objectives ?? [],
    videoUrl: row.video_url ?? "",
    resources: ((resources ?? []) as {
      title: string;
      resource_type: string;
      url: string | null;
      notes: string | null;
    }[]).map((resource) => ({
      title: resource.title,
      resourceType: resource.resource_type,
      url: resource.url ?? "",
      notes: resource.notes ?? "",
    })),
    assignment: assignmentRow
      ? {
          id: assignmentRow.id,
          brief: assignmentRow.brief,
          submissionInstructions: assignmentRow.submission_instructions,
          // Rubric is instructor-only — never expose to learners.
          rubric: "",
          estimatedMinutes:
            assignmentRow.estimated_minutes == null
              ? ""
              : String(assignmentRow.estimated_minutes),
        }
      : null,
  };
}

async function resolveMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: AcademyLessonType,
  contentUrl: string | null,
): Promise<LessonMedia> {
  const empty: LessonMedia = {
    signedUrl: null,
    fileName: null,
    externalUrl: null,
    readingText: null,
    missing: true,
  };
  if (type === "quiz" || !contentUrl?.trim()) return empty;

  const trimmed = contentUrl.trim();
  if (isHttpUrl(trimmed)) {
    return {
      signedUrl: null,
      fileName: fileNameFromPath(trimmed),
      externalUrl: trimmed,
      readingText: null,
      missing: false,
    };
  }

  const objectPath = academyObjectPath(trimmed);
  if (!objectPath) return empty;

  const signedUrl = await signedAcademyUrl(supabase, objectPath);
  if (!signedUrl) {
    return { ...empty, fileName: fileNameFromPath(objectPath), missing: true };
  }

  let readingText: string | null = null;
  if (type === "reading") {
    readingText = await loadReadingText(signedUrl);
  }

  return {
    signedUrl,
    fileName: fileNameFromPath(objectPath),
    externalUrl: null,
    readingText,
    missing: false,
  };
}

export async function loadLessonPlayer(
  userId: string,
  programId: string,
  lessonId: string | null,
): Promise<LessonPlayerResult> {
  if (!userId || !PROGRAM_ID.test(programId)) {
    return { ok: false, reason: "not_found" };
  }
  if (lessonId && !PROGRAM_ID.test(lessonId)) {
    return { ok: false, reason: "mismatch" };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: "failed" };
  }

  try {
    const supabase = await createClient();

    // Enrollment, program, and modules only depend on user/program ids, so
    // fetch them together instead of paying three sequential round-trips.
    const [
      { data: enrollment, error: enrollmentError },
      { data: program, error: programError },
      { data: moduleRows, error: moduleError },
    ] = await Promise.all([
      supabase
        .from("academy_enrollments")
        .select("id, user_id, program_id, entitlement_source")
        .eq("user_id", userId)
        .eq("program_id", programId)
        .maybeSingle(),
      supabase
        .from("academy_programs")
        .select("id, name, status, price, access")
        .eq("id", programId)
        .maybeSingle(),
      supabase
        .from("academy_modules")
        .select("id, title, sort_order")
        .eq("program_id", programId)
        .order("sort_order", { ascending: true }),
    ]);

    if (enrollmentError) return { ok: false, reason: "failed" };
    const enrollmentRow = enrollment as EnrollmentRow | null;

    if (programError) return { ok: false, reason: "failed" };
    if (!program) return { ok: false, reason: "not_found" };
    const programRow = program as {
      id: string;
      name: string;
      status: string;
      price: number | null;
      access: string | null;
    };

    if (!enrollmentRow || enrollmentRow.user_id !== userId) {
      // Hidden/draft programs stay available to existing enrollments only.
      if (programRow.status !== "published") {
        return { ok: false, reason: "unpublished" };
      }
      if (isPaidProgram(programRow.price)) {
        return { ok: false, reason: "payment_required" };
      }
      return { ok: false, reason: "no_enrollment" };
    }

    if (
      !learnerCanAccessProgramContent({
        price: programRow.price,
        entitlementSource: enrollmentRow.entitlement_source,
        enrolled: true,
        access: programRow.access,
      })
    ) {
      return { ok: false, reason: "payment_required" };
    }

    if (moduleError) return { ok: false, reason: "failed" };
    const modules = (moduleRows ?? []) as ModuleRow[];
    const moduleIds = modules.map((row) => row.id);

    // Lessons depend on the module ids; progress depends on the enrollment id.
    // They are independent of each other, so run them side by side.
    const [
      { data: lessonRows, error: lessonError },
      { data: progressRows, error: progressError },
    ] = await Promise.all([
      moduleIds.length
        ? supabase
            .from("academy_lessons")
            .select("id, module_id, title, type, content_url, sort_order")
            .in("module_id", moduleIds)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [] as LessonRow[], error: null }),
      supabase
        .from("academy_lesson_progress")
        .select("lesson_id, status")
        .eq("enrollment_id", enrollmentRow.id),
    ]);

    if (lessonError) return { ok: false, reason: "failed" };
    const lessons = (lessonRows ?? []) as LessonRow[];

    if (progressError) return { ok: false, reason: "failed" };
    const progress = new Map(
      ((progressRows ?? []) as ProgressRow[]).map((row) => [row.lesson_id, row.status]),
    );

    const lessonsByModule = new Map<string, LessonRow[]>();
    for (const lesson of lessons) {
      const list = lessonsByModule.get(lesson.module_id) ?? [];
      list.push(lesson);
      lessonsByModule.set(lesson.module_id, list);
    }

    const curriculum: CurriculumModule[] = modules.map((module) => ({
      id: module.id,
      title: module.title,
      sortOrder: module.sort_order,
      lessons: (lessonsByModule.get(module.id) ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          type: lesson.type,
          moduleId: module.id,
          moduleTitle: module.title,
          progressStatus: progress.get(lesson.id) ?? null,
        })),
    }));

    if (curriculum.every((module) => module.lessons.length === 0)) {
      return { ok: false, reason: "empty" };
    }

    if (!lessonId) {
      const redirectToLessonId = firstPlayableLessonId(curriculum, progress);
      if (!redirectToLessonId) return { ok: false, reason: "empty" };
      return { ok: true, redirectToLessonId, programId };
    }

    const current = curriculum
      .flatMap((module) => module.lessons)
      .find((lesson) => lesson.id === lessonId);

    if (!current) return { ok: false, reason: "mismatch" };
    if (current.progressStatus === "locked") return { ok: false, reason: "locked" };

    const lessonRow = lessons.find((row) => row.id === lessonId);
    if (!lessonRow) return { ok: false, reason: "mismatch" };

    const { previous, next } = adjacentLessons(curriculum, lessonId);
    const richContent = await loadRichContent(supabase, lessonId);
    const mediaSource =
      lessonRow.type === "video" && richContent.videoUrl.trim()
        ? richContent.videoUrl
        : lessonRow.content_url;
    // Media resolution and the assignment submission both hang off richContent
    // but not off each other — resolve them concurrently.
    const [media, assignmentSubmission] = await Promise.all([
      resolveMedia(supabase, lessonRow.type, mediaSource),
      loadAssignmentSubmission(
        supabase,
        userId,
        richContent.assignment?.id ?? null,
      ),
    ]);

    return {
      ok: true,
      data: {
        programId,
        programName: programRow.name,
        enrollmentId: enrollmentRow.id,
        modules: curriculum,
        current,
        previous,
        next,
        media,
        richContent,
        assignmentSubmission,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

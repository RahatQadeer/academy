import "server-only";

import { createHash } from "crypto";
import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";

export const PROGRAM_CONTENT_ENTITY = "academy_program";
export const PROGRAM_CONTENT_ACTION = "content_snapshot";

export type ContentSnapshotLesson = {
  moduleTitle: string;
  lessonTitle: string;
  moduleIndex: number;
  lessonIndex: number;
  hash: string;
};

type AnyClient = { from: (table: string) => any };

function norm(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function auditClient() {
  if (isSupabaseAdminConfigured()) return createAdminClient();
  return createClient();
}

export async function collectProgramContentSnapshot(
  supabase: AnyClient,
  programId: string,
): Promise<ContentSnapshotLesson[]> {
  const { data: moduleRows } = await supabase
    .from("academy_modules")
    .select("id, title, sort_order")
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });
  const modules = ((moduleRows ?? []) as { id: string; title: string; sort_order: number }[]).sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const moduleIds = modules.map((module) => module.id);
  if (moduleIds.length === 0) return [];

  const { data: lessonRows } = await supabase
    .from("academy_lessons")
    .select(
      "id, module_id, title, type, sort_order, content_body, content_summary, learning_objectives, video_url",
    )
    .in("module_id", moduleIds)
    .order("sort_order", { ascending: true });
  const lessons = (lessonRows ?? []) as {
    id: string;
    module_id: string;
    title: string;
    type: string;
    sort_order: number;
    content_body: string | null;
    content_summary: string | null;
    learning_objectives: string[] | null;
    video_url: string | null;
  }[];
  const lessonIds = lessons.map((lesson) => lesson.id);

  const [{ data: resources }, { data: assignments }, { data: quizzes }] = await Promise.all([
    lessonIds.length > 0
      ? supabase
          .from("academy_lesson_resources")
          .select("lesson_id, title, resource_type, url, notes, sort_order")
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length > 0
      ? supabase
          .from("academy_assignments")
          .select("lesson_id, brief, submission_instructions, rubric, estimated_minutes")
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length > 0
      ? supabase.from("academy_quizzes").select("id, lesson_id, passing_score").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
  ]);

  const quizIds = ((quizzes ?? []) as { id: string }[]).map((quiz) => quiz.id);
  const { data: questions } =
    quizIds.length > 0
      ? await supabase
          .from("academy_questions")
          .select("quiz_id, question_text, type, options, correct_answer, sort_order")
          .in("quiz_id", quizIds)
      : { data: [] };

  const resourcesByLesson = new Map<string, unknown[]>();
  for (const row of (resources ?? []) as {
    lesson_id: string;
    title: string;
    resource_type: string;
    url: string | null;
    notes: string | null;
    sort_order: number;
  }[]) {
    const list = resourcesByLesson.get(row.lesson_id) ?? [];
    list.push([row.sort_order, norm(row.title), norm(row.resource_type), norm(row.url), norm(row.notes)]);
    resourcesByLesson.set(row.lesson_id, list);
  }

  const assignmentByLesson = new Map<string, unknown>();
  for (const row of (assignments ?? []) as {
    lesson_id: string;
    brief: string | null;
    submission_instructions: string | null;
    rubric: string | null;
    estimated_minutes: number | null;
  }[]) {
    assignmentByLesson.set(row.lesson_id, [
      norm(row.brief),
      norm(row.submission_instructions),
      norm(row.rubric),
      row.estimated_minutes ?? null,
    ]);
  }

  const questionsByQuiz = new Map<string, unknown[]>();
  for (const row of (questions ?? []) as {
    quiz_id: string;
    question_text: string;
    type: string;
    options: unknown;
    correct_answer: string | null;
    sort_order: number;
  }[]) {
    const list = questionsByQuiz.get(row.quiz_id) ?? [];
    list.push([
      row.sort_order,
      norm(row.question_text),
      row.type,
      Array.isArray(row.options) ? row.options.map((item) => norm(String(item))) : [],
      norm(row.correct_answer),
    ]);
    questionsByQuiz.set(row.quiz_id, list);
  }

  const quizByLesson = new Map<string, unknown>();
  for (const row of (quizzes ?? []) as { id: string; lesson_id: string; passing_score: number }[]) {
    quizByLesson.set(row.lesson_id, [row.passing_score, questionsByQuiz.get(row.id) ?? []]);
  }

  const lessonsByModule = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push(lesson);
    lessonsByModule.set(lesson.module_id, list);
  }

  const snapshot: ContentSnapshotLesson[] = [];
  for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
    const module = modules[moduleIndex];
    const moduleLessons = (lessonsByModule.get(module.id) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    for (let lessonIndex = 0; lessonIndex < moduleLessons.length; lessonIndex += 1) {
      const lesson = moduleLessons[lessonIndex];
      snapshot.push({
        moduleTitle: norm(module.title),
        lessonTitle: norm(lesson.title),
        moduleIndex,
        lessonIndex,
        hash: hashPayload({
          type: lesson.type,
          title: norm(lesson.title),
          body: (lesson.content_body ?? "").trim(),
          summary: (lesson.content_summary ?? "").trim(),
          objectives: (lesson.learning_objectives ?? []).map((item) => item.trim()).filter(Boolean),
          video: norm(lesson.video_url),
          resources: resourcesByLesson.get(lesson.id) ?? [],
          assignment: assignmentByLesson.get(lesson.id) ?? null,
          quiz: quizByLesson.get(lesson.id) ?? null,
        }),
      });
    }
  }
  return snapshot;
}

export async function writeProgramContentSnapshot(input: {
  programId: string;
  actorUserId: string;
  supabase: AnyClient;
}): Promise<void> {
  try {
    const lessons = await collectProgramContentSnapshot(input.supabase, input.programId);
    const client = await auditClient();
    await client.from("audit_log").insert({
      actor_user_id: input.actorUserId,
      entity_type: PROGRAM_CONTENT_ENTITY,
      entity_id: input.programId,
      action: PROGRAM_CONTENT_ACTION,
      new_value: { lessons },
    });
  } catch {
    // Review can still proceed without a snapshot.
  }
}

export async function loadProgramContentSnapshotBefore(
  programId: string,
  beforeIso: string,
): Promise<ContentSnapshotLesson[] | null> {
  const client = await auditClient();
  const { data } = await client
    .from("audit_log")
    .select("new_value, created_at")
    .eq("entity_type", PROGRAM_CONTENT_ENTITY)
    .eq("entity_id", programId)
    .eq("action", PROGRAM_CONTENT_ACTION)
    .lt("created_at", beforeIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as { new_value?: { lessons?: ContentSnapshotLesson[] } | null } | null;
  const lessons = row?.new_value?.lessons;
  if (!Array.isArray(lessons) || lessons.length === 0) return null;
  return lessons.filter(
    (item) =>
      item &&
      typeof item.moduleTitle === "string" &&
      typeof item.lessonTitle === "string" &&
      typeof item.hash === "string",
  );
}

export function lessonWasChanged(
  current: ContentSnapshotLesson,
  baseline: ContentSnapshotLesson[] | null,
): boolean {
  if (!baseline || baseline.length === 0) return false;
  const byTitle = baseline.find(
    (item) => item.moduleTitle === current.moduleTitle && item.lessonTitle === current.lessonTitle,
  );
  const byPosition = baseline.find(
    (item) => item.moduleIndex === current.moduleIndex && item.lessonIndex === current.lessonIndex,
  );
  const prior = byTitle ?? byPosition;
  if (!prior) return true;
  return prior.hash !== current.hash;
}

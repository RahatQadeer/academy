import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessInstructorArea,
  canAuthorProgram,
  isAcademyAdmin,
  isInstructor,
} from "@/academy/lib/authorization";
import { teachingContentIsComplete, lessonNeedsTeachingBody } from "@/academy/admin/lib/courseAttachmentText";
import { sanitizeLessonMarkdown } from "@/academy/admin/catalog/lib/lessonContentText";
import { generateLessonBody } from "./catalogPipeline/lessons";
import { mapLimit } from "./catalogPipeline/deepseek";
import { normalizeDifficulty } from "./catalogPipeline/prompts";
import type { Blueprint, CatalogGenerationRequest, CatalogLessonKind } from "./catalogPipeline/types";

export type FillMissingLessonBodiesResult =
  | { ok: true; filled: number; attempted: number }
  | { ok: false; reason: "unauthorized" | "invalid" | "failed"; message?: string };

function asLessonKind(type: string): CatalogLessonKind {
  if (type === "scenario" || type === "assignment" || type === "quiz" || type === "video" || type === "resource") {
    return type;
  }
  return "reading";
}

export async function fillMissingLessonBodies(programId: string): Promise<FillMissingLessonBodiesResult> {
  const id = programId.trim();
  if (!id) return { ok: false, reason: "invalid", message: "Missing program." };

  const profile = await getSessionProfile();
  if (!profile) return { ok: false, reason: "unauthorized" };
  const actor = { id: profile.user.id };
  const [adminArea, admin, instructorArea, instructor, author] = await Promise.all([
    canAccessAdminArea(actor),
    isAcademyAdmin(actor),
    canAccessInstructorArea(actor),
    isInstructor(actor),
    canAuthorProgram(actor, id),
  ]);
  if (!((adminArea && admin) || (instructorArea && instructor && author))) {
    return { ok: false, reason: "unauthorized" };
  }

  const supabase = await createClient();
  const { data: program, error: programError } = await supabase
    .from("academy_programs")
    .select("id, name, description")
    .eq("id", id)
    .maybeSingle();
  if (programError || !program) {
    return { ok: false, reason: "invalid", message: "Program not found." };
  }

  const { data: modules, error: moduleError } = await supabase
    .from("academy_modules")
    .select("id, title, sort_order")
    .eq("program_id", id)
    .order("sort_order");
  if (moduleError) {
    return { ok: false, reason: "failed", message: "Could not load modules." };
  }
  if (!modules?.length) {
    return { ok: true, filled: 0, attempted: 0 };
  }

  const moduleIds = modules.map((module) => module.id);
  const { data: lessons, error: lessonError } = await supabase
    .from("academy_lessons")
    .select("id, module_id, title, type, content_body, content_summary, learning_objectives, sort_order")
    .in("module_id", moduleIds)
    .order("sort_order");
  if (lessonError || !lessons) {
    return { ok: false, reason: "failed", message: "Could not load lessons." };
  }

  const missing = lessons.filter((lesson) => lessonNeedsTeachingBody(String(lesson.type), lesson.content_body));
  if (!missing.length) return { ok: true, filled: 0, attempted: 0 };

  const request: CatalogGenerationRequest = {
    prompt: program.name,
    length: `${modules.length} modules`,
    difficulty: "Intermediate",
    type: "Paid Course",
    moduleCount: modules.length,
    programType: "Paid Course",
  };
  const blueprint: Blueprint = {
    title: program.name,
    subtitle: "",
    description: program.description ?? "",
    audience: "Professional learners",
    difficulty: normalizeDifficulty("Intermediate"),
    prerequisites: [],
    estimatedHours: 8,
    domainAnalysis: program.description ?? program.name,
    inScope: [],
    outOfScope: [],
  };

  const written = await mapLimit(missing, 2, async (lesson) => {
    const module = modules.find((item) => item.id === lesson.module_id);
    const plan = {
      title: lesson.title,
      summary: lesson.content_summary || lesson.title,
      lessonKind: asLessonKind(String(lesson.type)),
      learningObjectives: Array.isArray(lesson.learning_objectives)
        ? lesson.learning_objectives.map(String)
        : [],
      durationMinutes: 20,
      outline: Array.isArray(lesson.learning_objectives) ? lesson.learning_objectives.map(String) : [],
    };
    const generated = await generateLessonBody(
      plan,
      {
        request,
        blueprint,
        moduleTitle: module?.title || "Module",
        moduleIndex: module?.sort_order ?? 0,
        lessonIndex: lesson.sort_order ?? 0,
        priorLessons: [],
      },
    ).catch(() => null);
    const contentBody = sanitizeLessonMarkdown(generated?.contentBody || "");
    if (!teachingContentIsComplete(contentBody, blueprint.difficulty, plan.lessonKind)) {
      return false;
    }
    const { data: latest } = await supabase
      .from("academy_lessons")
      .select("content_body")
      .eq("id", lesson.id)
      .maybeSingle();
    if (!lessonNeedsTeachingBody(String(lesson.type), latest?.content_body)) {
      return true;
    }
    const { error } = await supabase
      .from("academy_lessons")
      .update({ content_body: contentBody, content_summary: generated?.contentSummary || lesson.content_summary })
      .eq("id", lesson.id);
    if (error) {
      console.error("[fillMissingLessonBodies] update", lesson.id, error);
      return false;
    }
    return Boolean(contentBody.trim());
  });

  return { ok: true, filled: written.filter(Boolean).length, attempted: missing.length };
}

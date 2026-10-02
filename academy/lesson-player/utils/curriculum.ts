import type { AcademyProgressStatus } from "@/academy/lib/domain";
import type { CurriculumLesson, CurriculumModule } from "../types";

export const PROGRAM_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lessonPlayerHref(programId: string, lessonId?: string) {
  if (!lessonId) return `/academy/learning/${programId}`;
  return `/academy/learning/${programId}/${lessonId}`;
}

export function flattenLessons(modules: CurriculumModule[]): CurriculumLesson[] {
  return modules.flatMap((module) => module.lessons);
}

export function adjacentLessons(
  modules: CurriculumModule[],
  lessonId: string,
): { previous: CurriculumLesson | null; next: CurriculumLesson | null } {
  const flat = flattenLessons(modules);
  const index = flat.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return { previous: null, next: null };

  let previous: CurriculumLesson | null = null;
  for (let i = index - 1; i >= 0; i -= 1) {
    const lesson = flat[i]!;
    if (lesson.progressStatus !== "locked") {
      previous = lesson;
      break;
    }
  }

  let next: CurriculumLesson | null = null;
  for (let i = index + 1; i < flat.length; i += 1) {
    const lesson = flat[i]!;
    if (lesson.progressStatus !== "locked") {
      next = lesson;
      break;
    }
  }

  return { previous, next };
}

export function firstPlayableLessonId(
  modules: CurriculumModule[],
  progress: Map<string, AcademyProgressStatus>,
): string | null {
  const flat = flattenLessons(modules);
  const unlocked = (lesson: CurriculumLesson) => progress.get(lesson.id) !== "locked";
  const incomplete = flat.find(
    (lesson) => unlocked(lesson) && progress.get(lesson.id) !== "completed",
  );
  if (incomplete) return incomplete.id;
  return flat.find(unlocked)?.id ?? flat[0]?.id ?? null;
}

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function academyObjectPath(contentUrl: string): string | null {
  const trimmed = contentUrl.trim();
  if (!trimmed || isHttpUrl(trimmed)) return null;
  return trimmed.replace(/^\/+/, "").replace(/^academy\//, "");
}

export function fileNameFromPath(path: string) {
  const segment = path.split("/").filter(Boolean).pop();
  return segment || path;
}

export function isLikelyMediaFile(name: string) {
  return /\.(mp4|webm|ogg|m4v|mov|m3u8)(\?|$)/i.test(name);
}

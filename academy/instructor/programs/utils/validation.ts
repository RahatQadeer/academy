import {
  ACADEMY_LESSON_TYPES,
  isAcademyCourseAccess,
  isAcademyCourseRecognition,
  isAcademyLearningPath,
  isAcademyLessonType,
  isAcademyProgramType,
  type AcademyCourseAccess,
  type AcademyCourseRecognition,
  type AcademyLearningPath,
  type AcademyLessonType,
  type AcademyProgramType,
} from "@/academy/lib/domain";
import {
  coerceAccess,
  coerceLearningPath,
  coerceRecognitionForType,
  isRecognitionAllowedForType,
  mapLegacyProgramType,
  programTypeOptions as metadataProgramTypeOptions,
} from "@/academy/lib/courseMetadata";

export const PROGRAM_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 4000;
export const CATEGORY_MAX = 80;
export const CONTENT_URL_MAX = 2000;

export function trimText(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function parsePrice(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 999999) return { ok: false };
  return { ok: true, value };
}

export function parsePrerequisite(raw: string, selfId?: string): string | null | false {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!PROGRAM_ID.test(trimmed)) return false;
  if (selfId && trimmed.toLowerCase() === selfId.toLowerCase()) return false;
  return trimmed.toLowerCase();
}

export function parseProgramType(raw: string): AcademyProgramType | null {
  if (isAcademyProgramType(raw)) return raw;
  return mapLegacyProgramType(raw)?.type ?? null;
}

export function parseCourseAccess(raw: string, type: AcademyProgramType): AcademyCourseAccess {
  return coerceAccess(raw, type);
}

export function parseCourseRecognition(
  raw: string,
  type: AcademyProgramType,
): AcademyCourseRecognition | null {
  if (!isAcademyCourseRecognition(raw)) return coerceRecognitionForType(type, raw);
  if (!isRecognitionAllowedForType(type, raw)) return null;
  return raw;
}

export function parseLearningPath(raw: string, type: AcademyProgramType): AcademyLearningPath {
  return coerceLearningPath(raw, type);
}

export function parseLessonType(raw: string): AcademyLessonType | null {
  return isAcademyLessonType(raw) ? raw : null;
}

export function sanitizeContentUrl(raw: string): string | null | false {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > CONTENT_URL_MAX) return false;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  return trimmed;
}

export function validateProgramName(raw: string) {
  const name = trimText(raw, TITLE_MAX);
  if (!name) return null;
  return name;
}

export function programTypeOptions(): { value: AcademyProgramType; label: string }[] {
  return metadataProgramTypeOptions();
}

export function lessonTypeOptions(): { value: AcademyLessonType; label: string }[] {
  return ACADEMY_LESSON_TYPES.map((value) => ({
    value,
    label: value[0].toUpperCase() + value.slice(1),
  }));
}

export { isAcademyCourseAccess, isAcademyCourseRecognition, isAcademyLearningPath };

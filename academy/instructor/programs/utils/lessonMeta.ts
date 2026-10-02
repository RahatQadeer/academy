import type { AcademyLessonType } from "@/academy/lib/domain";

const LABELS: Record<AcademyLessonType, string> = {
  reading: "Reading",
  video: "Video",
  quiz: "Quiz",
  scenario: "Scenario",
  assignment: "Assignment",
  resource: "Resource",
  attachment: "File",
};

export function lessonTypeLabel(type: AcademyLessonType) {
  return LABELS[type] ?? type;
}

export function isImageUrl(url: string, resourceType?: string) {
  if (/^(image|img|diagram|screenshot|photo|figure)$/i.test(resourceType?.trim() ?? "")) {
    return Boolean(url.trim());
  }
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url.trim());
}

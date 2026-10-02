import type { CurriculumLesson, LessonMedia, LessonRichContent } from "../types";

export function hasPlayableVideo(
  lesson: CurriculumLesson,
  rich: LessonRichContent,
  media: LessonMedia,
) {
  if (lesson.type === "quiz" || lesson.type === "assignment") return false;
  if (rich.videoUrl.trim()) return true;
  if (media.signedUrl) return true;
  if (lesson.type === "video" && Boolean(media.externalUrl)) return true;
  return false;
}

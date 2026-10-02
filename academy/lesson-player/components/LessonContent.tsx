import type { AcademyLessonType } from "@/academy/lib/domain";
import type { LessonMedia } from "../types";
import { AttachmentLesson } from "./AttachmentLesson";
import { ReadingLesson } from "./ReadingLesson";
import { VideoLesson } from "./VideoLesson";

export function LessonContent({
  type,
  media,
}: {
  type: AcademyLessonType;
  media: LessonMedia;
}) {
  if (type === "video") return <VideoLesson media={media} />;
  if (type === "reading") return <ReadingLesson media={media} />;
  if (type === "attachment") return <AttachmentLesson media={media} />;
  return null;
}

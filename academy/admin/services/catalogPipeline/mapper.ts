import "server-only";

import type { PersistedProgramDraft } from "../catalogPersistence";
import type { PipelineCourse, PipelineLesson } from "./types";
import { mapLegacyProgramType, toDbProgramType } from "@/academy/lib/courseMetadata";

function toPersistedLesson(lesson: PipelineLesson) {
  const type =
    lesson.lessonKind === "quiz"
      ? ("quiz" as const)
      : lesson.lessonKind === "assignment"
        ? ("assignment" as const)
        : lesson.lessonKind === "scenario"
          ? ("scenario" as const)
          : lesson.lessonKind === "video"
            ? ("video" as const)
            : lesson.lessonKind === "resource"
              ? ("resource" as const)
              : ("reading" as const);

  return {
    title: lesson.title,
    type,
    contentUrl: "",
    contentBody: lesson.contentBody,
    contentSummary: lesson.contentSummary,
    learningObjectives: lesson.learningObjectives,
    videoUrl: lesson.lessonKind === "video" ? "" : "",
    videoDurationSeconds: 0,
    resources: lesson.resources,
    assignment: lesson.assignment,
    quiz: lesson.quiz,
  };
}

export function toPersistedDraft(
  course: PipelineCourse,
  requestType: string,
): PersistedProgramDraft {
  const type = toDbProgramType(course.type || requestType);
  const mapped = mapLegacyProgramType(requestType) ?? mapLegacyProgramType(type);
  return {
    name: course.name,
    description: course.description,
    category: course.category || mapped?.type || type,
    type,
    modules: course.modules.map((module) => ({
      title: module.title,
      lessons: module.lessons.map(toPersistedLesson),
    })),
  };
}

export function parseModuleCount(length: string): number {
  const match = length.match(/(\d+)/);
  const count = match ? Number(match[1]) : 4;
  // Must match Whitby Length options (1–12). Never bump the user's choice.
  return Math.min(12, Math.max(1, Number.isFinite(count) ? count : 4));
}

export function metadataFromRequestType(requestType: string) {
  return (
    mapLegacyProgramType(requestType) ?? {
      type: "course" as const,
      access: "free" as const,
      recognition: "certificate_of_completion" as const,
      learningPath: "business_and_practice" as const,
    }
  );
}

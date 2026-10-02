import {
  isOutlineOnlyBody,
  looksLikeGenericCourseGen,
  sourceMentionsGenericCourseGen,
  titleReflectsSource,
} from "@/academy/admin/lib/courseAttachmentText";
import { contentWordCount, lessonWordTarget } from "./prompts";
import type { CatalogDifficulty, PipelineCourse, PipelineLesson, SourceKnowledge } from "./types";

export type SourceFidelityReport = {
  ok: boolean;
  usedSource: boolean;
  titleMatches: boolean;
  descriptionMatches: boolean;
  genericCourse: boolean;
  outlineOnlyLessons: string[];
  thinLessons: string[];
  quizGrounded: boolean;
  reasons: string[];
};

export function sourceFidelityCheck(
  course: PipelineCourse,
  source: SourceKnowledge | undefined,
  difficulty: CatalogDifficulty = "intermediate",
): SourceFidelityReport {
  const reasons: string[] = [];
  const usedSource = Boolean(source?.hasSource);
  const haystack = sourceHaystack(source);

  const titleMatches = !usedSource || titleReflectsSource(course.name, haystack, source?.fileNames ?? []);
  const descriptionMatches =
    !usedSource || titleReflectsSource(`${course.name} ${course.description}`, haystack, source?.fileNames ?? []);
  const genericCourse =
    usedSource &&
    !sourceMentionsGenericCourseGen(haystack) &&
    (looksLikeGenericCourseGen(`${course.name} ${course.description}`) ||
      course.modules.some((module) => looksLikeGenericCourseGen(`${module.title} ${module.description}`)));

  if (usedSource && !titleMatches) reasons.push("title does not reflect the source document");
  if (usedSource && !descriptionMatches) reasons.push("description does not reflect the source document");
  if (genericCourse) reasons.push("generated a generic CourseGen/AI-course topic instead of the source subject");

  const outlineOnlyLessons: string[] = [];
  const thinLessons: string[] = [];
  let quizCount = 0;
  let contentLessonCount = 0;

  for (const module of course.modules) {
    for (const lesson of module.lessons) {
      if (lesson.lessonKind === "quiz") {
        quizCount += lesson.quiz?.questions.length ?? 0;
        continue;
      }
      if (lesson.lessonKind === "assignment") {
        if (!lesson.assignment?.brief || contentWordCount(lesson.contentBody) < 200) {
          thinLessons.push(lesson.title);
        }
        continue;
      }
      contentLessonCount += 1;
      const minWords = lessonWordTarget(difficulty, lesson.lessonKind).min;
      if (isOutlineOnlyBody(lesson.contentBody)) {
        outlineOnlyLessons.push(lesson.title);
      } else if (contentWordCount(lesson.contentBody) < Math.round(minWords * 0.55)) {
        thinLessons.push(lesson.title);
      }
    }
  }

  if (outlineOnlyLessons.length) {
    reasons.push(`lessons are outline-only: ${outlineOnlyLessons.slice(0, 4).join(", ")}`);
  }
  if (thinLessons.length) {
    reasons.push(`thin lessons: ${thinLessons.slice(0, 4).join(", ")}`);
  }

  const quizGrounded = quizCount >= Math.min(5, Math.max(2, contentLessonCount));
  if (!quizGrounded) reasons.push("quizzes are missing or too thin for the generated lessons");

  const ok =
    !genericCourse &&
    titleMatches &&
    descriptionMatches &&
    outlineOnlyLessons.length === 0 &&
    thinLessons.length <= 1 &&
    quizGrounded;

  return {
    ok,
    usedSource,
    titleMatches,
    descriptionMatches,
    genericCourse,
    outlineOnlyLessons,
    thinLessons,
    quizGrounded,
    reasons,
  };
}

export function needsSourceRegeneration(report: SourceFidelityReport) {
  return report.usedSource && (report.genericCourse || !report.titleMatches || !report.descriptionMatches);
}

function sourceHaystack(source: SourceKnowledge | undefined) {
  if (!source?.hasSource) return "";
  return [source.subjectHint, source.headings.join(" "), source.concepts.join(" "), source.consolidated, source.fullText ?? ""]
    .join("\n");
}

export function lessonNeedsRewrite(lesson: PipelineLesson, difficulty: CatalogDifficulty) {
  if (lesson.lessonKind === "quiz") return false;
  if (lesson.lessonKind === "assignment") {
    return !lesson.assignment?.brief || contentWordCount(lesson.contentBody) < 200;
  }
  if (isOutlineOnlyBody(lesson.contentBody)) return true;
  const minWords = lessonWordTarget(difficulty, lesson.lessonKind).min;
  return contentWordCount(lesson.contentBody) < Math.round(minWords * 0.55);
}

import "server-only";

import { teachingContentIsComplete } from "@/academy/admin/lib/courseAttachmentText";
import type { CatalogDifficulty, PipelineCourse, PipelineLesson } from "./types";

export type IncompleteLessonRef = {
  moduleIndex: number;
  lessonIndex: number;
  lesson: PipelineLesson;
};

export function incompleteCourseLessons(
  course: PipelineCourse,
  difficulty: CatalogDifficulty = "intermediate",
): IncompleteLessonRef[] {
  const missing: IncompleteLessonRef[] = [];
  course.modules.forEach((module, moduleIndex) => {
    module.lessons.forEach((lesson, lessonIndex) => {
      if (lesson.lessonKind === "quiz") return;
      if (lesson.lessonKind === "assignment") {
        if (!lesson.assignment?.brief || !teachingContentIsComplete(lesson.contentBody, difficulty, "assignment")) {
          missing.push({ moduleIndex, lessonIndex, lesson });
        }
        return;
      }
      if (!teachingContentIsComplete(lesson.contentBody, difficulty, lesson.lessonKind)) {
        missing.push({ moduleIndex, lessonIndex, lesson });
      }
    });
  });
  return missing;
}

export function courseBodiesAreComplete(
  course: PipelineCourse,
  difficulty: CatalogDifficulty = "intermediate",
) {
  return incompleteCourseLessons(course, difficulty).length === 0;
}

export function structuralCheck(
  course: PipelineCourse,
  difficulty: CatalogDifficulty = "intermediate",
): {
  thinLessons: PipelineLesson[];
  quizCount: number;
} {
  const thinLessons = incompleteCourseLessons(course, difficulty).map((item) => item.lesson);
  let quizCount = 0;

  for (const module of course.modules) {
    for (const lesson of module.lessons) {
      if (lesson.lessonKind === "quiz") {
        quizCount += lesson.quiz?.questions.length ?? 0;
      }
    }
  }

  return { thinLessons, quizCount };
}

export function isPipelineCourseReady(course: PipelineCourse, difficulty: CatalogDifficulty = "intermediate"): boolean {
  const { thinLessons, quizCount } = structuralCheck(course, difficulty);
  const moduleCount = course.modules.length;
  const lessonCount = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  return moduleCount >= 1 && lessonCount >= 1 && thinLessons.length === 0 && quizCount >= 0;
}

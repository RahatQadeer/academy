import type { CatalogProgramDetail } from "../types";

export type FinalAssessmentTarget = {
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  quizId: string;
  questionCount: number;
};

export function findFinalAssessment(program: CatalogProgramDetail): FinalAssessmentTarget | null {
  const modules = [...program.modules].sort((a, b) => a.sortOrder - b.sortOrder);
  if (modules.length === 0) return null;

  const titled =
    modules.find((module) => /final assessment/i.test(module.title)) ??
    modules[modules.length - 1];

  const quizLesson =
    [...titled.lessons]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .find((lesson) => lesson.type === "quiz" && /final assessment|final exam|assessment/i.test(lesson.title)) ??
    [...titled.lessons].sort((a, b) => a.sortOrder - b.sortOrder).find((lesson) => lesson.type === "quiz");

  if (!quizLesson?.quiz?.id) return null;

  return {
    moduleId: titled.id,
    moduleTitle: titled.title,
    lessonId: quizLesson.id,
    lessonTitle: quizLesson.title,
    quizId: quizLesson.quiz.id,
    questionCount: quizLesson.quiz.questions.length,
  };
}

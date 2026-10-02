"use client";

import { LessonEditor as CatalogLessonEditor } from "@/academy/admin/catalog/components/LessonEditor";
import type { CatalogLesson } from "@/academy/admin/catalog/types";
import type { EditorLesson } from "../types";

function toCatalogLesson(lesson: EditorLesson): CatalogLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    contentUrl: lesson.contentUrl,
    contentBody: lesson.contentBody,
    contentSummary: lesson.contentSummary,
    learningObjectives: lesson.learningObjectives,
    videoUrl: lesson.videoUrl,
    videoDurationSeconds: lesson.videoDurationSeconds,
    sortOrder: lesson.sortOrder,
    resources: lesson.resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      resourceType: resource.resourceType,
      url: resource.url,
      notes: resource.notes,
      sortOrder: resource.sortOrder,
    })),
    assignment: lesson.assignment
      ? {
          id: lesson.assignment.id,
          brief: lesson.assignment.brief,
          submissionInstructions: lesson.assignment.submissionInstructions,
          rubric: lesson.assignment.rubric,
          estimatedMinutes: lesson.assignment.estimatedMinutes,
        }
      : null,
    quiz: lesson.quiz
      ? {
          id: lesson.quiz.id,
          passingScore: lesson.quiz.passingScore,
          questions: lesson.quiz.questions.map((question) => ({
            id: question.id,
            questionText: question.questionText,
            type: question.type,
            options: question.options,
            correctAnswer: question.correctAnswer,
            sortOrder: question.sortOrder,
          })),
        }
      : null,
  };
}

function fromCatalogPatch(patch: Partial<CatalogLesson>): Partial<EditorLesson> {
  const next: Partial<EditorLesson> = { ...patch };
  if (patch.quiz !== undefined) {
    next.quiz = patch.quiz
      ? {
          id: patch.quiz.id,
          passingScore: patch.quiz.passingScore,
          questions: patch.quiz.questions.map((question) => ({
            id: question.id,
            questionText: question.questionText,
            type: question.type,
            options: question.options,
            correctAnswer: question.correctAnswer,
            sortOrder: question.sortOrder,
          })),
        }
      : null;
    next.quizId = patch.quiz?.id ?? null;
  }
  if (patch.resources) {
    next.resources = patch.resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      resourceType: resource.resourceType,
      url: resource.url,
      notes: resource.notes,
      sortOrder: resource.sortOrder,
    }));
  }
  if (patch.assignment !== undefined) {
    next.assignment = patch.assignment
      ? {
          id: patch.assignment.id,
          brief: patch.assignment.brief,
          submissionInstructions: patch.assignment.submissionInstructions,
          rubric: patch.assignment.rubric,
          estimatedMinutes: patch.assignment.estimatedMinutes,
        }
      : null;
  }
  return next;
}

export function RichLessonEditor({
  programId,
  lesson,
  moduleTitle,
  moduleIndex,
  lessonIndex,
  disabled,
  onChange,
}: {
  programId: string;
  lesson: EditorLesson;
  moduleTitle?: string;
  moduleIndex?: number;
  lessonIndex?: number;
  disabled?: boolean;
  onChange: (patch: Partial<EditorLesson>) => void;
}) {
  return (
    <div className="[&>:first-child]:px-0 [&>:first-child]:py-0 [&>:first-child]:sm:px-0">
      <CatalogLessonEditor
        programId={programId}
        lesson={toCatalogLesson(lesson)}
        moduleTitle={moduleTitle}
        moduleIndex={moduleIndex}
        lessonIndex={lessonIndex}
        disabled={disabled}
        onChange={(patch) => onChange(fromCatalogPatch(patch))}
      />
    </div>
  );
}

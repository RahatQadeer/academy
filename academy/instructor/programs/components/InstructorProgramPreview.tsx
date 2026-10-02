"use client";

import { Pill } from "@/base/components/Pill";
import { LessonBody } from "@/academy/admin/catalog/components/lesson/LessonBody";
import { QuizView } from "@/academy/admin/catalog/components/lesson/QuizView";
import { VideoBlock } from "@/academy/admin/catalog/components/lesson/VideoBlock";
import { formatInlineMarkdownFragment } from "@/academy/admin/catalog/lib/formatInlineMarkdown";
import type { CatalogLesson } from "@/academy/admin/catalog/types";
import { EDITOR_CARD_SHADOW } from "./EditorCard";
import { isImageUrl, lessonTypeLabel } from "../utils/lessonMeta";
import type { EditorLesson, EditorProgram } from "../types";

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

function LessonFigure({ src, alt }: { src: string; alt: string }) {
  return (
    <figure
      className="overflow-hidden rounded-[10px]"
      style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="mx-auto block h-auto max-h-[520px] w-full object-contain" />
    </figure>
  );
}

function LessonPreview({
  programId,
  lesson,
  moduleIndex,
  lessonIndex,
}: {
  programId: string;
  lesson: EditorLesson;
  moduleIndex: number;
  lessonIndex: number;
}) {
  const catalogLesson = toCatalogLesson(lesson);
  const contentImage = isImageUrl(lesson.contentUrl) ? lesson.contentUrl : "";
  const hasBody =
    Boolean(lesson.contentBody.trim()) ||
    lesson.learningObjectives.length > 0 ||
    Boolean(lesson.assignment) ||
    lesson.resources.length > 0;

  return (
    <article
      className="overflow-hidden rounded-[12px] bg-surface"
      style={{ border: "1px solid var(--border)", boxShadow: EDITOR_CARD_SHADOW }}
    >
      <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            Lesson {moduleIndex + 1}.{lessonIndex + 1}
          </p>
          <Pill tone="neutral">{lessonTypeLabel(lesson.type)}</Pill>
        </div>
        <h3 className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em] text-pretty" style={{ color: "var(--ink)" }}>
          {lesson.title.trim() || "Untitled lesson"}
        </h3>
        {lesson.contentSummary ? (
          <p className="mt-2 text-[14px] leading-[1.65] text-pretty" style={{ color: "var(--text-secondary)" }}>
            {formatInlineMarkdownFragment(lesson.contentSummary)}
          </p>
        ) : null}
      </div>
      <div className="space-y-6 px-5 py-5 sm:px-6">
        {contentImage ? <LessonFigure src={contentImage} alt={lesson.title} /> : null}
        {lesson.videoUrl ? (
          <VideoBlock
            programId={programId}
            lessonId={lesson.id}
            videoUrl={lesson.videoUrl}
            canUpload={false}
            disabled
            onChange={() => undefined}
          />
        ) : null}
        {hasBody ? (
          <LessonBody lesson={catalogLesson} />
        ) : !contentImage && !lesson.videoUrl ? (
          <p className="text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
            No lesson body yet.
          </p>
        ) : null}
        {lesson.quiz && lesson.quiz.questions.length > 0 ? (
          <div className="border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <h4 className="mb-3 text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              Knowledge check
            </h4>
            <QuizView quiz={catalogLesson.quiz!} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function InstructorProgramPreview({ program }: { program: EditorProgram }) {
  if (program.modules.length === 0) {
    return (
      <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
        No modules in this draft yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {program.modules.map((module, moduleIndex) => (
        <section key={module.id || module.title} className="space-y-4">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-pretty" style={{ color: "var(--ink)" }}>
            {moduleIndex + 1}. {module.title.trim() || "Untitled module"}
          </h2>
          {module.lessons.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              No lessons in this module yet.
            </p>
          ) : (
            <div className="space-y-4">
              {module.lessons.map((lesson, lessonIndex) => (
                <LessonPreview
                  key={lesson.id || `${moduleIndex}-${lessonIndex}`}
                  programId={program.id}
                  lesson={lesson}
                  moduleIndex={moduleIndex}
                  lessonIndex={lessonIndex}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

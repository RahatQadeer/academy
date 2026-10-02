"use client";

import { LessonBody } from "@/academy/admin/catalog/components/lesson/LessonBody";
import { VideoBlock } from "@/academy/admin/catalog/components/lesson/VideoBlock";
import { formatInlineMarkdownFragment } from "@/academy/admin/catalog/lib/formatInlineMarkdown";
import type { CatalogLesson } from "@/academy/admin/catalog/types";
import type { AcademyLessonType } from "@/academy/lib/domain";
import type { CurriculumLesson, LessonMedia, LessonRichContent, LessonPlayerView } from "../types";
import { hasPlayableVideo } from "../lib/presence";
import { AttachmentLesson } from "./AttachmentLesson";
import { useLessonCompletionGate } from "./LessonCompletionGate";
import { ReadingLesson } from "./ReadingLesson";
import { VideoLesson } from "./VideoLesson";
import { LearnerAssignmentPanel } from "./LearnerAssignmentPanel";

function toCatalogLesson(
  lesson: CurriculumLesson,
  rich: LessonRichContent,
): CatalogLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    contentUrl: "",
    contentBody: rich.contentBody,
    contentSummary: rich.contentSummary,
    learningObjectives: rich.learningObjectives,
    videoUrl: rich.videoUrl,
    videoDurationSeconds: 0,
    sortOrder: 0,
    resources: rich.resources.map((resource, index) => ({
      id: `resource-${index}`,
      title: resource.title,
      resourceType: resource.resourceType,
      url: resource.url,
      notes: resource.notes,
      sortOrder: index,
    })),
    assignment: rich.assignment
      ? {
          id: rich.assignment.id,
          brief: rich.assignment.brief,
          submissionInstructions: rich.assignment.submissionInstructions,
          rubric: rich.assignment.rubric,
          estimatedMinutes: rich.assignment.estimatedMinutes,
        }
      : null,
    quiz: null,
  };
}

function hasLessonCopy(rich: LessonRichContent) {
  return (
    Boolean(rich.contentBody.trim()) ||
    rich.learningObjectives.length > 0 ||
    rich.resources.some((resource) => resource.title.trim() || resource.url.trim() || resource.notes.trim())
  );
}

export function LearnerLessonContent({
  programId,
  lesson,
  richContent,
  media,
  assignmentSubmission,
}: {
  programId: string;
  lesson: CurriculumLesson;
  richContent: LessonRichContent;
  media: LessonMedia;
  assignmentSubmission: LessonPlayerView["assignmentSubmission"];
}) {
  const gate = useLessonCompletionGate();
  const catalogLesson = toCatalogLesson(lesson, richContent);
  const showVideo = hasPlayableVideo(lesson, richContent, media);
  const showRichBody = hasLessonCopy(richContent);
  const assignment = richContent.assignment;
  const markVideoDone = gate?.markVideoDone;

  if (lesson.type === "quiz") {
    return null;
  }

  if (lesson.type === "attachment" && !showRichBody && !assignment) {
    return <AttachmentLesson media={media} />;
  }

  return (
    <div className="min-w-0 max-w-full space-y-8">
      {showVideo ? (
        richContent.videoUrl.trim() ? (
          <VideoBlock
            programId={programId}
            lessonId={lesson.id}
            videoUrl={richContent.videoUrl}
            canUpload={false}
            disabled
            onChange={() => undefined}
            onComplete={() => markVideoDone?.()}
          />
        ) : (
          <VideoLesson media={media} onComplete={() => markVideoDone?.()} />
        )
      ) : null}

      {richContent.contentSummary ? (
        <p className="text-[16px] leading-[1.7] text-pretty" style={{ color: "var(--text-secondary)" }}>
          {formatInlineMarkdownFragment(richContent.contentSummary)}
        </p>
      ) : null}

      {showRichBody ? (
        <LessonBody lesson={catalogLesson} hideAssignment />
      ) : lesson.type === "reading" || Boolean(media.readingText?.trim()) ? (
        <ReadingLesson media={media} />
      ) : lesson.type === "attachment" ? (
        <AttachmentLesson media={media} />
      ) : showVideo || assignment ? null : (
        <EmptyLessonFallback type={lesson.type} />
      )}

      {assignment ? (
        <LearnerAssignmentPanel
          programId={programId}
          lessonId={lesson.id}
          assignment={assignment}
          submission={assignmentSubmission}
          media={lesson.type === "assignment" ? media : null}
        />
      ) : null}
    </div>
  );
}

function EmptyLessonFallback({ type }: { type: AcademyLessonType }) {
  if (type === "video" || type === "scenario" || type === "resource") {
    return null;
  }
  return (
    <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
      No lesson content is available yet.
    </p>
  );
}

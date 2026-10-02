"use client";

import { useCallback, type ReactNode } from "react";
import { ScrollPane } from "@/academy/components/ScrollPane";
import type {
  CurriculumLesson,
  CurriculumModule,
  LessonMedia,
  LessonPlayerView,
  LessonRichContent,
} from "../types";
import {
  LessonCompletionProvider,
  useLessonCompletionGate,
  type LessonCompletionRequirements,
} from "./LessonCompletionGate";
import { LearnerLessonContent } from "./LearnerLessonContent";
import { LessonHeader } from "./LessonHeader";
import { LessonNavigation } from "./LessonNavigation";
import { LessonSidebar } from "./LessonSidebar";
import { MarkCompleteButton } from "./MarkCompleteButton";

export function LessonPlayerShell({
  programId,
  programName,
  modules,
  current,
  completedCount,
  totalCount,
  position,
  showComplete,
  requirements,
  richContent,
  media,
  assignmentSubmission,
  previous,
  next,
  quizSlot,
}: {
  programId: string;
  programName: string;
  modules: CurriculumModule[];
  current: CurriculumLesson;
  completedCount: number;
  totalCount: number;
  position: number;
  showComplete: boolean;
  requirements: LessonCompletionRequirements;
  richContent: LessonRichContent;
  media: LessonMedia;
  assignmentSubmission: LessonPlayerView["assignmentSubmission"];
  previous: CurriculumLesson | null;
  next: CurriculumLesson | null;
  /** Server-rendered quiz — keep out of the client import graph. */
  quizSlot?: ReactNode;
}) {
  return (
    <LessonCompletionProvider lessonId={current.id} requirements={requirements}>
      <LessonPlayerShellBody
        programId={programId}
        programName={programName}
        modules={modules}
        current={current}
        completedCount={completedCount}
        totalCount={totalCount}
        position={position}
        showComplete={showComplete}
        richContent={richContent}
        media={media}
        assignmentSubmission={assignmentSubmission}
        previous={previous}
        next={next}
        quizSlot={quizSlot}
      />
    </LessonCompletionProvider>
  );
}

function LessonPlayerShellBody({
  programId,
  programName,
  modules,
  current,
  completedCount,
  totalCount,
  position,
  showComplete,
  richContent,
  media,
  assignmentSubmission,
  previous,
  next,
  quizSlot,
}: {
  programId: string;
  programName: string;
  modules: CurriculumModule[];
  current: CurriculumLesson;
  completedCount: number;
  totalCount: number;
  position: number;
  showComplete: boolean;
  richContent: LessonRichContent;
  media: LessonMedia;
  assignmentSubmission: LessonPlayerView["assignmentSubmission"];
  previous: CurriculumLesson | null;
  next: CurriculumLesson | null;
  quizSlot?: ReactNode;
}) {
  const gate = useLessonCompletionGate();
  const markScrollDone = gate?.markScrollDone;
  const onReachEnd = useCallback(() => {
    markScrollDone?.();
  }, [markScrollDone]);

  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden academy-learner-player">
      <LessonSidebar
        programId={programId}
        programName={programName}
        modules={modules}
        currentLessonId={current.id}
        completedCount={completedCount}
        totalCount={totalCount}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface lg:overflow-hidden">
        <ScrollPane
          resetKey={current.id}
          className="min-h-0 flex-1 overflow-y-auto"
          onReachEnd={gate?.requirements.needsScroll ? onReachEnd : undefined}
        >
          <div
            className="sticky top-0 z-10 border-b px-5 pt-5 pb-4 sm:px-8 sm:pt-6 sm:pb-5 lg:px-10"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in srgb, var(--surface) 88%, transparent)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
            }}
          >
            <LessonHeader
              lesson={current}
              position={position}
              total={totalCount}
              action={
                current.progressStatus === "completed" ? (
                  <CompletedBadge />
                ) : showComplete ? (
                  <MarkCompleteButton
                    programId={programId}
                    lessonId={current.id}
                    nextLessonId={next?.id ?? null}
                  />
                ) : current.type === "quiz" ? (
                  <CompletionPathHint>
                    Pass the quiz to complete this lesson.
                  </CompletionPathHint>
                ) : current.type === "assignment" ? (
                  <CompletionPathHint>
                    Submit your work to complete this lesson.
                  </CompletionPathHint>
                ) : null
              }
            />
          </div>

          <div className="w-full max-w-[920px] px-5 pt-6 pb-8 sm:px-8 sm:pt-7 sm:pb-10 lg:px-10">
            {current.type === "quiz" ? (
              quizSlot
            ) : (
              <LearnerLessonContent
                programId={programId}
                lesson={current}
                richContent={richContent}
                media={media}
                assignmentSubmission={assignmentSubmission}
              />
            )}
            <LessonNavigation programId={programId} previous={previous} next={next} />
          </div>
        </ScrollPane>
      </div>
    </div>
  );
}

function CompletedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[7px] px-3 py-2 text-[12.5px] font-medium"
      style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M2.5 6.2 4.8 8.5 9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Completed
    </span>
  );
}

function CompletionPathHint({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[14rem] text-right text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
      {children}
    </p>
  );
}

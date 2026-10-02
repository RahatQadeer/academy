import { Suspense } from "react";
import type { LessonPlayerView } from "../types";
import { QuizLesson } from "@/academy/quiz/components/QuizLesson";
import { QuizSkeleton } from "@/academy/quiz/components/QuizSkeleton";
import { hasPlayableVideo } from "../lib/presence";
import type { LessonCompletionRequirements } from "./LessonCompletionGate";
import { LessonPlayerShell } from "./LessonPlayerShell";

function hasTextContent(data: LessonPlayerView) {
  const rich = data.richContent;
  return (
    Boolean(rich.contentBody.trim()) ||
    Boolean(rich.contentSummary.trim()) ||
    rich.learningObjectives.length > 0 ||
    Boolean(data.media.readingText?.trim()) ||
    data.current.type === "reading"
  );
}

/** Quiz / assignment complete via their own submit flows — not Mark complete. */
function usesOwnCompletionFlow(type: LessonPlayerView["current"]["type"]) {
  return type === "quiz" || type === "assignment";
}

function completionRequirements(data: LessonPlayerView): LessonCompletionRequirements {
  if (usesOwnCompletionFlow(data.current.type)) {
    return { needsScroll: false, needsVideo: false };
  }
  if (hasPlayableVideo(data.current, data.richContent, data.media)) {
    return { needsScroll: false, needsVideo: true };
  }
  if (hasTextContent(data)) {
    return { needsScroll: true, needsVideo: false };
  }
  return { needsScroll: false, needsVideo: false };
}

export function LessonPlayer({ data }: { data: LessonPlayerView }) {
  const lessons = data.modules.flatMap((module) => module.lessons);
  const completedCount = lessons.filter((lesson) => lesson.progressStatus === "completed").length;
  const showComplete =
    data.current.progressStatus !== "completed" && !usesOwnCompletionFlow(data.current.type);
  const position = lessons.findIndex((lesson) => lesson.id === data.current.id) + 1;
  const requirements = completionRequirements(data);

  const quizSlot =
    data.current.type === "quiz" ? (
      <Suspense fallback={<QuizSkeleton />}>
        <QuizLesson programId={data.programId} lessonId={data.current.id} />
      </Suspense>
    ) : null;

  return (
    <LessonPlayerShell
      programId={data.programId}
      programName={data.programName}
      modules={data.modules}
      current={data.current}
      completedCount={completedCount}
      totalCount={lessons.length}
      position={position > 0 ? position : 1}
      showComplete={showComplete}
      requirements={requirements}
      richContent={data.richContent}
      media={data.media}
      assignmentSubmission={data.assignmentSubmission}
      previous={data.previous}
      next={data.next}
      quizSlot={quizSlot}
    />
  );
}

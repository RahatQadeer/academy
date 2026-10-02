import { Suspense } from "react";
import { Callout } from "@/base/components/Callout";
import { QuizEditor } from "./components/QuizEditor";
import { QuizSkeleton } from "./components/QuizSkeleton";
import { loadQuizEditor } from "./services/loadQuizEditor";

async function QuizEditorBody({
  programId,
  lessonId,
}: {
  programId: string;
  lessonId: string;
}) {
  const result = await loadQuizEditor(programId, lessonId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Quiz not available">
          You can only edit quizzes for programs you created or were assigned.
        </Callout>
      </div>
    );
  }

  if (!result.ok && (result.reason === "not_found" || result.reason === "mismatch")) {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Quiz not found">
          This lesson is not a quiz in this program, or the quiz could not be opened.
        </Callout>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Quiz editor unavailable">
          This quiz could not be loaded. Try again in a moment.
        </Callout>
      </div>
    );
  }

  return <QuizEditor initial={result.data} />;
}

export function InstructorQuizEditorPage({
  programId,
  lessonId,
}: {
  programId: string;
  lessonId: string;
}) {
  return (
    <Suspense fallback={<QuizSkeleton />}>
      <QuizEditorBody programId={programId} lessonId={lessonId} />
    </Suspense>
  );
}

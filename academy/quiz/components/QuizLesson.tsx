import { loadLearnerQuiz } from "../services/loadLearnerQuiz";
import { QuizError } from "./QuizError";
import { QuizPlayer } from "./QuizPlayer";

export async function QuizLesson({
  programId,
  lessonId,
}: {
  programId: string;
  lessonId: string;
}) {
  const result = await loadLearnerQuiz(programId, lessonId);
  if (!result.ok) return <QuizError reason={result.reason} />;
  return <QuizPlayer quiz={result.data} />;
}

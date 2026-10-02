import type { EditorQuestion } from "../types";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";

export function QuizLearnerPreview({ questions }: { questions: EditorQuestion[] }) {
  return (
    <section
      className="rounded-[10px] bg-surface p-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <h2 className="text-[13.5px] font-medium">Learner view</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        This is a private outline of what learners will see. Correct answers are hidden here and are
        never sent on the learner quiz path.
      </p>
      <ol className="mt-4 space-y-4">
        {questions.map((question, index) => (
          <li key={question.id || `q-${index}`}>
            <p className="text-[14px] font-medium">
              {index + 1}. {stripQuizAnswerLeaks(question.questionText) || "Untitled question"}
            </p>
            <ul className="mt-2 space-y-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {question.options.map((option) => (
                <li key={option.id}>{option.label || option.id}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

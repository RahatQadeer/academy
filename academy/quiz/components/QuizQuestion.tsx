import type { LearnerQuizItemResult, LearnerQuizQuestion } from "../types";
import { QuizOptions } from "./QuizOptions";

export function QuizQuestion({
  index,
  question,
  value,
  onChange,
  disabled,
  result,
}: {
  index: number;
  question: LearnerQuizQuestion;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  result?: LearnerQuizItemResult;
}) {
  return (
    <fieldset
      className="rounded-[8px] bg-surface px-4 py-4"
      style={{ border: "1px solid var(--border)" }}
    >
      <legend className="text-[14.5px] font-medium leading-snug text-pretty">
        <span className="mr-2" style={{ color: "var(--text-tertiary)" }}>
          {index + 1}.
        </span>
        {question.questionText}
      </legend>
      <QuizOptions
        name={`question-${question.id}`}
        options={question.options}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      {result ? (
        <p
          className="mt-3 text-[12.5px]"
          style={{ color: result.correct ? "var(--success-fg)" : "var(--warning-fg)" }}
        >
          {result.correct ? "Correct" : "Incorrect"}
        </p>
      ) : null}
    </fieldset>
  );
}

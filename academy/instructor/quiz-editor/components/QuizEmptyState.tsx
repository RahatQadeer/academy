import type { ReactNode } from "react";

export function QuizEmptyState({
  onAdd,
  fromBank,
  disabled,
}: {
  onAdd: () => void;
  fromBank?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className="rounded-[10px] bg-surface px-6 py-8 text-center"
      style={{ border: "1px solid var(--border)" }}
    >
      <p className="text-[15px] font-medium">No questions yet</p>
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Write a new question, or add one you already saved in the question bank. Learners will not see the
        correct answer.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {fromBank}
        <button
          type="button"
          disabled={disabled}
          className="text-[13.5px] disabled:opacity-30"
          style={{ color: "var(--accent)" }}
          onClick={onAdd}
        >
          Add question
        </button>
      </div>
    </div>
  );
}

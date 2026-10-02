import type { LearnerQuizScore } from "../types";

export function QuizResult({
  result,
  onRetry,
}: {
  result: LearnerQuizScore;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-[10px] px-5 py-5"
      style={{
        border: "1px solid var(--border)",
        background: result.passed ? "var(--success-bg)" : "var(--warning-bg)",
      }}
    >
      <p
        className="text-[12.5px] font-medium"
        style={{ color: result.passed ? "var(--success-fg)" : "var(--warning-fg)" }}
      >
        {result.passed ? "Passed" : "Not passed"}
      </p>
      <p className="mt-1 text-[20px] font-semibold tracking-[-0.3px]">{result.score}%</p>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {result.correctAnswers} of {result.totalQuestions} correct. Passing score is{" "}
        {result.passingScore}%.
      </p>
      <button
        type="button"
        className="mt-4 inline-flex rounded-[6px] px-3 py-[7px] text-[13px]"
        style={{
          border: "1px solid var(--border-strong)",
          background: "transparent",
          color: "var(--ink)",
        }}
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

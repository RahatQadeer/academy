"use client";

import { useState } from "react";
import type { CatalogQuiz, CatalogQuizQuestion } from "../../types";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";
import { splitQuestion } from "./LessonBody";

function BankStar() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.6l1.76 3.56 3.93.57-2.84 2.77.67 3.91L8 10.56l-3.52 1.85.67-3.91L2.3 5.73l3.93-.57L8 1.6z"
        fill="currentColor"
      />
    </svg>
  );
}

export function QuizView({ quiz }: { quiz: CatalogQuiz }) {
  const [revealed, setRevealed] = useState(false);
  const passing = quiz.passingScore || "80";

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
            Quiz
          </h3>
          <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} · pass at {passing}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="rounded-[6px] border px-2.5 py-1.5 text-[12.5px] font-medium"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
        >
          {revealed ? "Hide answers" : "Show answers"}
        </button>
      </header>
      <ol className="space-y-4">
        {quiz.questions.map((question, index) => (
          <QuestionCard key={question.id || index} question={question} index={index} revealed={revealed} />
        ))}
      </ol>
    </section>
  );
}

function QuestionCard({
  question,
  index,
  revealed,
}: {
  question: CatalogQuizQuestion;
  index: number;
  revealed: boolean;
}) {
  const { question: prompt, explanation } = splitQuestion(question.questionText);
  const safePrompt = stripQuizAnswerLeaks(prompt);
  const options = question.type === "true_false" ? ["True", "False"] : question.options;

  return (
    <li
      className="list-none rounded-[10px] border px-4 py-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums"
          style={{ background: "var(--accent-tint-soft, #e7f1fb)", color: "var(--accent, #2383e2)" }}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[15px] font-medium leading-[1.6]" style={{ color: "var(--ink)" }}>
              {safePrompt}
            </p>
            {question.fromBank ? (
              <span
                className="mt-0.5 inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold"
                title="From question bank"
                style={{
                  background: "color-mix(in srgb, #c9a227 16%, white)",
                  color: "#8a6d12",
                }}
              >
                <BankStar />
                Bank
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            {question.type === "true_false" ? "True / False" : "Multiple choice"}
          </p>
        </div>
      </div>
      <ul className="ml-9 space-y-1.5">
        {options.map((option, optionIndex) => {
          const isCorrect = option === question.correctAnswer;
          return (
            <li
              key={`${option}-${optionIndex}`}
              className="flex items-start gap-2.5 rounded-[8px] border px-3 py-2 text-[14.5px] leading-[1.55]"
              style={{
                borderColor: revealed && isCorrect ? "#1c7a52" : "var(--border)",
                background: revealed && isCorrect ? "#d6ecd8" : "transparent",
                color: "var(--ink)",
              }}
            >
              <span
                className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold"
                style={{
                  borderColor: revealed && isCorrect ? "#1c7a52" : "var(--border-strong)",
                  background: revealed && isCorrect ? "#1c7a52" : "transparent",
                  color: revealed && isCorrect ? "white" : "var(--text-tertiary)",
                }}
              >
                {revealed && isCorrect ? "✓" : String.fromCharCode(65 + optionIndex)}
              </span>
              <span>{option}</span>
            </li>
          );
        })}
      </ul>
      {revealed && explanation ? (
        <p className="ml-9 mt-3 border-t pt-2.5 text-[13.5px] leading-[1.6]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <span className="font-semibold" style={{ color: "var(--accent, #2383e2)" }}>
            Why —{" "}
          </span>
          {explanation}
        </p>
      ) : null}
    </li>
  );
}

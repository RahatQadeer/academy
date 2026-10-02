"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitLearnerQuizAction } from "../actions";
import type { LearnerQuizScore, LearnerQuizView } from "../types";
import { learnerQuizMessage } from "../utils/messages";
import { QuizProgress } from "./QuizProgress";
import { QuizQuestion } from "./QuizQuestion";
import { QuizResult } from "./QuizResult";
import { QuizSubmit } from "./QuizSubmit";

export function QuizPlayer({ quiz }: { quiz: LearnerQuizView }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LearnerQuizScore | null>(null);

  const answered = useMemo(
    () => quiz.questions.filter((question) => Boolean(answers[question.id])).length,
    [answers, quiz.questions],
  );
  const complete = answered === quiz.questions.length;
  const submitted = result !== null;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!complete || pending || submitted) return;
        setError(null);
        startTransition(async () => {
          const response = await submitLearnerQuizAction({
            programId: quiz.programId,
            lessonId: quiz.lessonId,
            quizId: quiz.quizId,
            answers: quiz.questions.map((question) => ({
              questionId: question.id,
              answer: answers[question.id] ?? "",
            })),
          });
          if (response.status !== "scored") {
            setError(learnerQuizMessage(response.reason));
            return;
          }
          setResult(response.result);
          if (response.result.passed) {
            router.refresh();
          }
        });
      }}
    >
      <div
        className="flex flex-wrap items-end justify-between gap-3 rounded-[10px] px-4 py-3.5"
        style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
      >
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.2px]">Quiz</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Passing score is {quiz.passingScore}%.
          </p>
        </div>
        <QuizProgress answered={answered} total={quiz.questions.length} />
      </div>

      {result ? <QuizResult result={result} onRetry={() => setResult(null)} /> : null}

      {quiz.questions.map((question, index) => (
        <QuizQuestion
          key={question.id}
          index={index}
          question={question}
          value={answers[question.id] ?? ""}
          onChange={(next) => {
            if (submitted) return;
            setAnswers((current) => ({ ...current, [question.id]: next }));
          }}
          disabled={pending || submitted}
          result={result?.itemResults.find((item) => item.questionId === question.id)}
        />
      ))}

      {error ? (
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--warning-fg)" }}>
          {error}
        </p>
      ) : null}

      {!submitted ? <QuizSubmit disabled={!complete} pending={pending} /> : null}
    </form>
  );
}

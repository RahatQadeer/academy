"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import type { CatalogProgramDetail } from "../types";
import { findFinalAssessment } from "../lib/finalAssessment";
import {
  addQuestionsToFinalAssessmentAction,
  loadFinalAssessmentBankAction,
} from "../actions/finalAssessment";
import type { QuestionBankItem } from "@/academy/lib/questionBank/types";

export function FinalAssessmentPanel({
  program,
  disabled,
}: {
  program: CatalogProgramDetail;
  disabled?: boolean;
}) {
  const router = useRouter();
  const target = findFinalAssessment(program);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void loadFinalAssessmentBankAction(program.id).then((result) => {
      if (cancelled || !result.ok) return;
      setQuestions(result.items.filter((item) => item.quizId !== target?.quizId));
    });
    return () => {
      cancelled = true;
    };
  }, [program.id, target?.quizId]);

  if (!target) {
    return (
      <section className="rounded-[12px] border bg-surface p-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-[16px] font-semibold tracking-[-0.2px]">End-of-course assessment</h3>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Add a quiz lesson titled <strong>Final Assessment</strong> (typically in the last module) to
          manage questions from the question bank here.
        </p>
      </section>
    );
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function importSelected() {
    if (!target) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await addQuestionsToFinalAssessmentAction({
        programId: program.id,
        questionIds: [...selected],
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(`Added ${result.added} question${result.added === 1 ? "" : "s"} to ${target.lessonTitle}.`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <section className="rounded-[12px] border bg-surface p-5 sm:p-6" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-[16px] font-semibold tracking-[-0.2px]">End-of-course assessment</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {target.moduleTitle} · {target.lessonTitle} · {target.questionCount} question
        {target.questionCount === 1 ? "" : "s"} currently in the final quiz.
      </p>

      <div className="mt-4 max-h-[280px] overflow-y-auto rounded-[10px] border" style={{ borderColor: "var(--border)" }}>
        {questions.length === 0 ? (
          <p className="px-4 py-6 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            No other quiz questions in this program yet. Add questions to module quizzes first, then import
            them here.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {questions.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  disabled={disabled || pending}
                  onChange={() => toggle(item.id)}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium leading-snug">{item.questionText}</p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {item.moduleTitle} · {item.lessonTitle}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg, #c0392b)" }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--success-fg)" }}>
          {message}
        </p>
      ) : null}

      <div className="mt-4">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || pending || selected.size === 0}
          onClick={importSelected}
        >
          {pending ? "Adding…" : selected.size > 0 ? `Add ${selected.size} to final assessment` : "Add to final assessment"}
        </Button>
      </div>
    </section>
  );
}

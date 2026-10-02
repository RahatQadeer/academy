"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import type { EditorQuestionOption } from "@/academy/instructor/quiz-editor/types";
import { MAX_MC_OPTIONS, MIN_MC_OPTIONS, OPTION_LABEL_MAX, QUESTION_TEXT_MAX } from "@/academy/instructor/quiz-editor/types";
import { TRUE_FALSE_OPTIONS } from "@/academy/instructor/quiz-editor/utils/validation";
import { saveBankQuestionAction } from "@/academy/lib/questionBank/actions";
import { isGeneralBankProgram } from "@/academy/lib/questionBank/generalBankConstants";
import type { QuestionBankProgramTarget, QuestionBankQuestionType } from "@/academy/lib/questionBank/types";
import { questionBankTypeLabel } from "@/academy/lib/questionBank/types";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

type BankQuestionType = QuestionBankQuestionType;
type CourseMode = "existing" | "general";

type BankDraft = {
  questionText: string;
  type: BankQuestionType;
  options: EditorQuestionOption[];
  correctAnswer: string;
};

const BANK_TYPE_OPTIONS: { value: BankQuestionType; label: string; hint: string }[] = [
  { value: "multiple_choice", label: "Multiple choice", hint: "Quiz" },
  { value: "true_false", label: "True / false", hint: "Quiz" },
  { value: "assignment", label: "Open answer", hint: "Assignment" },
  { value: "exercise", label: "Lesson exercise", hint: "Prompt" },
  { value: "other", label: "Other", hint: "Prompt" },
];

function isOpenPromptType(type: BankQuestionType) {
  return type === "assignment" || type === "exercise" || type === "other";
}

function blankQuestion(): BankDraft {
  return {
    questionText: "",
    type: "multiple_choice",
    options: [
      { id: "opt-a", label: "" },
      { id: "opt-b", label: "" },
    ],
    correctAnswer: "opt-a",
  };
}

function pickProgramId(programs: QuestionBankProgramTarget[], preferred?: string) {
  if (preferred && programs.some((program) => program.id === preferred)) return preferred;
  const unlocked = programs.find((program) => !program.locked);
  return unlocked?.id ?? programs[0]?.id ?? "";
}

function optionLetter(index: number) {
  return String.fromCharCode(65 + index);
}

export function AddQuestionModal({
  programs,
  defaults,
  onClose,
  onAdded,
}: {
  programs: QuestionBankProgramTarget[];
  defaults: { programId?: string };
  onClose: () => void;
  onAdded: (message: string, meta?: { programId?: string; reload?: boolean }) => void;
}) {
  const titleId = useId();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [pending, startSubmit] = useTransition();
  const catalogPrograms = useMemo(
    () => programs.filter((item) => !isGeneralBankProgram(item)),
    [programs],
  );
  const [courseMode, setCourseMode] = useState<CourseMode>(() =>
    catalogPrograms.length === 0 ? "general" : "existing",
  );
  const [programId, setProgramId] = useState(() =>
    pickProgramId(catalogPrograms, defaults.programId),
  );
  const [question, setQuestion] = useState<BankDraft>(blankQuestion);
  const [error, setError] = useState<string | null>(null);

  const program = catalogPrograms.find((item) => item.id === programId);
  const locked = courseMode === "existing" && Boolean(program?.locked);
  const openPrompt = isOpenPromptType(question.type);

  useEffect(() => {
    promptRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  function patchQuestion(patch: Partial<BankDraft>) {
    setQuestion((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function changeType(type: BankQuestionType) {
    if (type === question.type) return;
    if (type === "true_false") {
      patchQuestion({
        type,
        options: TRUE_FALSE_OPTIONS,
        correctAnswer: "true",
      });
      return;
    }
    if (isOpenPromptType(type)) {
      patchQuestion({
        type,
        options: [],
        correctAnswer: "",
      });
      return;
    }
    patchQuestion({
      type,
      options: [
        { id: "opt-a", label: "" },
        { id: "opt-b", label: "" },
      ],
      correctAnswer: "opt-a",
    });
  }

  function submit() {
    startSubmit(async () => {
      setError(null);

      if (courseMode === "existing") {
        if (!programId) {
          setError("Choose a course.");
          return;
        }
        if (locked) {
          setError("Live courses cannot be edited from the question bank.");
          return;
        }
      }

      if (question.type === "multiple_choice") {
        const labeled = question.options.filter((item) => item.label.trim());
        if (labeled.length < 2) {
          setError("Give at least two answer options.");
          return;
        }
        if (!labeled.some((item) => item.id === question.correctAnswer)) {
          setError("Mark the correct answer.");
          return;
        }
      }

      const asGeneral = courseMode === "general";
      const result = await saveBankQuestionAction({
        programId: asGeneral ? undefined : programId,
        general: asGeneral,
        questionText: question.questionText,
        type: question.type,
        options: question.options,
        correctAnswer: question.correctAnswer,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      onAdded(
        asGeneral
          ? `Saved to General questions as ${questionBankTypeLabel(question.type)}.`
          : openPrompt
            ? `Saved as ${questionBankTypeLabel(question.type)}. Add it to an assignment when you’re ready.`
            : `Saved as ${questionBankTypeLabel(question.type)}. Add it to a quiz or assignment when you’re ready.`,
        { programId: result.programId, reload: true },
      );
    });
  }

  const labeledOptionCount =
    question.type === "true_false"
      ? 2
      : openPrompt
        ? 0
        : question.options.filter((item) => item.label.trim()).length;
  const courseReady =
    courseMode === "general" ? true : Boolean(programId) && !locked;
  const canSubmit =
    !pending &&
    courseReady &&
    question.questionText.trim().length > 0 &&
    (openPrompt || (labeledOptionCount >= 2 && Boolean(question.correctAnswer)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-3 py-3 sm:items-center sm:px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92vh,720px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[14px] bg-surface"
        style={{
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(15,15,15,.16), 0 2px 8px rgba(15,15,15,.06)",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-5 pt-5 pb-4 sm:px-6"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(180deg, color-mix(in srgb, #e9e4f3 40%, white) 0%, var(--surface) 100%)",
          }}
        >
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--module-academy-fg)" }}
            >
              Saved for later
            </p>
            <h2
              id={titleId}
              className="mt-1 text-[19px] font-semibold tracking-[-0.3px]"
              style={{ color: "var(--ink)" }}
            >
              New question
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Save a question to the bank for future quizzes and assignments — pick an existing course
              or General questions. Items already in quizzes stay under Library.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border-0 hover:bg-[var(--surface-soft)] disabled:opacity-40"
            style={{ color: "var(--text-tertiary)", background: "transparent" }}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
              <div>
                <span
                  className="mb-1.5 block text-[12.5px] font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Where to save
                </span>
                <div
                  className="mb-2.5 grid grid-cols-2 gap-1 rounded-[10px] p-1"
                  style={{ background: "var(--surface-soft)" }}
                  role="tablist"
                  aria-label="Question destination"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={courseMode === "existing"}
                    disabled={pending || catalogPrograms.length === 0}
                    onClick={() => {
                      setCourseMode("existing");
                      setError(null);
                    }}
                    className="rounded-[8px] px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-40"
                    style={{
                      background: courseMode === "existing" ? "var(--surface)" : "transparent",
                      color: courseMode === "existing" ? "var(--ink)" : "var(--text-secondary)",
                      boxShadow:
                        courseMode === "existing" ? "0 1px 2px rgba(15,15,15,.06)" : "none",
                      border: 0,
                    }}
                  >
                    Existing course
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={courseMode === "general"}
                    disabled={pending}
                    onClick={() => {
                      setCourseMode("general");
                      setError(null);
                    }}
                    className="rounded-[8px] px-3 py-2 text-[13px] font-medium transition-colors"
                    style={{
                      background: courseMode === "general" ? "var(--surface)" : "transparent",
                      color: courseMode === "general" ? "var(--ink)" : "var(--text-secondary)",
                      boxShadow: courseMode === "general" ? "0 1px 2px rgba(15,15,15,.06)" : "none",
                      border: 0,
                    }}
                  >
                    General questions
                  </button>
                </div>

                {courseMode === "existing" ? (
                  catalogPrograms.length === 0 ? (
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      No courses yet. Use{" "}
                      <span className="font-medium text-ink">General questions</span> to save questions
                      for later use.
                    </p>
                  ) : (
                    <FilterSelect
                      tone="field"
                      size="md"
                      label="Course"
                      hideLabel
                      value={programId}
                      disabled={pending}
                      onChange={(next) => {
                        setProgramId(next);
                        setError(null);
                      }}
                      options={catalogPrograms.map((item) => ({
                        value: item.id,
                        label: item.locked ? `${item.name} · Live` : item.name,
                      }))}
                    />
                  )
                ) : (
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Saves into the shared General pool. It appears under Saved for later, and when you
                    add from the bank into any course quiz or assignment — it does not create a blank
                    course.
                  </p>
                )}
              </div>

              <FilterSelect
                tone="field"
                size="md"
                label="Type"
                value={question.type}
                disabled={pending || locked}
                onChange={(next) => changeType(next as BankQuestionType)}
                options={BANK_TYPE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                  hint: option.hint,
                }))}
              />

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between gap-3 text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  <span>Question</span>
                  <span className="tabular-nums font-normal" style={{ color: "var(--text-tertiary)" }}>
                    {question.questionText.length}/{QUESTION_TEXT_MAX}
                  </span>
                </span>
                <textarea
                  ref={promptRef}
                  value={question.questionText}
                  maxLength={QUESTION_TEXT_MAX}
                  disabled={pending || locked}
                  rows={3}
                  placeholder="Ask the learner something…"
                  className="w-full resize-none rounded-[10px] border bg-surface px-3 py-2.5 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-[rgba(55,53,47,0.35)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-50"
                  style={{ borderColor: "var(--border-strong)" }}
                  onChange={(event) => patchQuestion({ questionText: event.target.value })}
                />
              </label>

              {question.type === "true_false" ? (
                <div className="grid grid-cols-2 gap-2">
                  {TRUE_FALSE_OPTIONS.map((option) => {
                    const selected = question.correctAnswer === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={pending || locked}
                        onClick={() => patchQuestion({ correctAnswer: option.id })}
                        className="rounded-[10px] px-3 py-3 text-[14px] font-medium"
                        style={{
                          background: selected ? "var(--accent-tint)" : "var(--surface-soft)",
                          color: selected ? "var(--accent)" : "var(--ink)",
                          boxShadow: selected
                            ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent)"
                            : "inset 0 0 0 1px var(--border)",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : openPrompt ? (
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    Sample answer
                    <span className="ml-1.5 font-normal" style={{ color: "var(--text-tertiary)" }}>
                      optional
                    </span>
                  </span>
                  <textarea
                    value={question.correctAnswer}
                    maxLength={QUESTION_TEXT_MAX}
                    disabled={pending || locked}
                    rows={3}
                    placeholder="Optional notes or a model answer. Stays in the bank — not shown to learners."
                    className="w-full resize-none rounded-[10px] border bg-surface px-3 py-2.5 text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-[rgba(55,53,47,0.35)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-50"
                    style={{ borderColor: "var(--border-strong)" }}
                    onChange={(event) => patchQuestion({ correctAnswer: event.target.value })}
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <span className="block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    Answers
                    <span className="ml-1.5 font-normal" style={{ color: "var(--text-tertiary)" }}>
                      tap the letter to mark correct
                    </span>
                  </span>
                  {question.options.map((option, index) => {
                    const selected = question.correctAnswer === option.id;
                    return (
                      <div key={option.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={pending || locked}
                          aria-label={`Mark ${optionLetter(index)} as correct`}
                          aria-pressed={selected}
                          onClick={() => patchQuestion({ correctAnswer: option.id })}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[12.5px] font-semibold"
                          style={{
                            background: selected ? "var(--accent)" : "var(--surface-soft)",
                            color: selected ? "#fff" : "var(--text-secondary)",
                            boxShadow: selected ? "none" : "inset 0 0 0 1px var(--border)",
                          }}
                        >
                          {optionLetter(index)}
                        </button>
                        <input
                          value={option.label}
                          maxLength={OPTION_LABEL_MAX}
                          disabled={pending || locked}
                          placeholder={`Option ${optionLetter(index)}`}
                          className="h-9 min-w-0 flex-1 rounded-[8px] border bg-surface px-3 text-[14px] text-ink outline-none placeholder:text-[rgba(55,53,47,0.35)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]"
                          style={{ borderColor: "var(--border-strong)" }}
                          onChange={(event) =>
                            patchQuestion({
                              options: question.options.map((item) =>
                                item.id === option.id ? { ...item, label: event.target.value } : item,
                              ),
                            })
                          }
                        />
                        {question.options.length > MIN_MC_OPTIONS ? (
                          <button
                            type="button"
                            disabled={pending || locked}
                            aria-label={`Remove option ${optionLetter(index)}`}
                            onClick={() => {
                              const next = question.options.filter((item) => item.id !== option.id);
                              patchQuestion({
                                options: next,
                                correctAnswer:
                                  question.correctAnswer === option.id ? (next[0]?.id ?? "") : question.correctAnswer,
                              });
                            }}
                            className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-[8px] border-0 text-[16px] leading-none hover:bg-[var(--surface-soft)]"
                            style={{ color: "var(--text-tertiary)", background: "transparent" }}
                          >
                            ×
                          </button>
                        ) : (
                          <span className="w-8 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {question.options.length < MAX_MC_OPTIONS ? (
                    <button
                      type="button"
                      disabled={pending || locked}
                      onClick={() =>
                        patchQuestion({
                          options: [
                            ...question.options,
                            { id: `opt-${Math.random().toString(36).slice(2, 8)}`, label: "" },
                          ],
                        })
                      }
                      className="text-[13px] font-medium"
                      style={{ color: "var(--accent)", background: "transparent", border: 0, padding: 0 }}
                    >
                      Add option
                    </button>
                  ) : null}
                </div>
              )}

              {locked ? (
                <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  This course is live. Instructors cannot add questions until it is unpublished.
                </p>
              ) : null}
          </div>

          {error ? (
            <p className="mt-4 text-[13.5px]" style={{ color: "var(--danger-fg)" }}>
              {error}
            </p>
          ) : null}
        </div>

        <div
          className="flex justify-end gap-2 border-t px-5 py-3.5 sm:px-6"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            {pending ? "Saving…" : courseMode === "general" ? "Save to General" : "Save to bank"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5l7 7M10.5 3.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

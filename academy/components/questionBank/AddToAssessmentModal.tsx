"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { programStatusLabel } from "@/academy/instructor/utils/labels";
import {
  appendAssignmentPromptAction,
  copyBankQuestionsToQuizAction,
  loadQuestionBankQuizTargetsAction,
} from "@/academy/lib/questionBank/actions";
import { assignmentPromptFromBank } from "@/academy/lib/questionBank/mapAuthoring";
import { wrapBankBriefPrompt } from "@/academy/lib/questionBank/bankOrigin";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";
import type {
  AuthoringBankQuestion,
  QuestionBankAuthorScope,
  QuestionBankProgramTarget,
} from "@/academy/lib/questionBank/types";

function pickProgramId(programs: QuestionBankProgramTarget[], preferred?: string) {
  if (preferred && programs.some((program) => program.id === preferred)) return preferred;
  const unlocked = programs.find((program) => !program.locked);
  return unlocked?.id ?? programs[0]?.id ?? "";
}

function mergeProgramTree(
  shell: QuestionBankProgramTarget[],
  loaded: QuestionBankProgramTarget[],
): QuestionBankProgramTarget[] {
  if (loaded.length === 0) return shell;
  const byId = new Map(loaded.map((item) => [item.id, item]));
  return shell.map((item) => byId.get(item.id) ?? item);
}

export function AddToAssessmentModal({
  programs: initialPrograms,
  questions,
  preferredProgramId,
  scope = "admin",
  onClose,
  onAdded,
}: {
  programs: QuestionBankProgramTarget[];
  questions: AuthoringBankQuestion[] | { id: string; questionText: string; type: string }[];
  preferredProgramId?: string;
  scope?: QuestionBankAuthorScope;
  onClose: () => void;
  onAdded: (message: string, meta?: { programId?: string; reload?: boolean }) => void;
}) {
  const titleId = useId();
  const [pending, startSubmit] = useTransition();
  const [programs, setPrograms] = useState(initialPrograms);
  const quizEligible = questions.filter(
    (item) => item.type === "multiple_choice" || item.type === "true_false",
  );
  const canQuiz = quizEligible.length > 0;
  const [kind, setKind] = useState<"quiz" | "assignment">(canQuiz ? "quiz" : "assignment");
  const [programId, setProgramId] = useState(() => pickProgramId(initialPrograms, preferredProgramId));
  const program = programs.find((item) => item.id === programId);
  const [lessonId, setLessonId] = useState("");
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedProgramsRef = useRef(new Set<string>());

  const lessons = kind === "quiz" ? (program?.quizzes ?? []) : (program?.assignments ?? []);
  const locked = Boolean(program?.locked);

  useEffect(() => {
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

  // Load only the selected course's quiz/assignment tree — never every program.
  useEffect(() => {
    if (!programId) {
      setLoadingTargets(false);
      return;
    }
    if (loadedProgramsRef.current.has(programId)) {
      const current = programs.find((item) => item.id === programId);
      setLessonId(
        canQuiz ? (current?.quizzes[0]?.lessonId ?? "") : (current?.assignments[0]?.lessonId ?? ""),
      );
      setLoadingTargets(false);
      return;
    }

    let cancelled = false;
    setLoadingTargets(true);
    void loadQuestionBankQuizTargetsAction({ scope, programId }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError("Could not load quiz and assignment destinations. Try again.");
        setLoadingTargets(false);
        return;
      }
      loadedProgramsRef.current.add(programId);
      setPrograms((current) => mergeProgramTree(current, result.programs));
      const next = result.programs.find((item) => item.id === programId) ?? result.programs[0];
      setLessonId(
        canQuiz ? (next?.quizzes[0]?.lessonId ?? "") : (next?.assignments[0]?.lessonId ?? ""),
      );
      setLoadingTargets(false);
    });
    return () => {
      cancelled = true;
    };
    // programs intentionally omitted — we merge into it; re-running on every merge would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canQuiz, programId, scope]);

  const hint = useMemo(() => {
    if (loadingTargets) return "Loading quiz and assignment destinations…";
    if (!program) return "Choose a course and a destination lesson.";
    if (locked) return "This course is live. Instructors cannot add questions until it is unpublished.";
    if (!canQuiz) {
      return "Other and open-answer prompts go on an assignment. Multiple choice and true/false can go into a quiz.";
    }
    if (kind === "quiz" && program.quizzes.length === 0) {
      return "This course has no quiz lessons yet. Add a quiz in the course builder first.";
    }
    if (kind === "assignment" && program.assignments.length === 0) {
      return "This course has no assignment lessons yet. Add an assignment in the course builder first.";
    }
    return kind === "quiz"
      ? "Selected questions are copied into the quiz. You can still edit them there."
      : "Selected prompts are added to the assignment brief. Answer keys stay out of the learner view.";
  }, [canQuiz, kind, loadingTargets, locked, program]);

  function changeProgram(nextId: string) {
    setProgramId(nextId);
    setLessonId("");
    setError(null);
  }

  function changeKind(next: "quiz" | "assignment") {
    setKind(next);
    setLessonId(
      next === "quiz" ? (program?.quizzes[0]?.lessonId ?? "") : (program?.assignments[0]?.lessonId ?? ""),
    );
    setError(null);
  }

  function submit() {
    startSubmit(async () => {
      setError(null);
      if (loadingTargets) {
        setError("Destinations are still loading.");
        return;
      }
      if (!programId || !lessonId) {
        setError("Choose a course and a lesson.");
        return;
      }
      if (locked) {
        setError("Live courses cannot be edited from the question bank.");
        return;
      }
      if (kind === "quiz") {
        const ids = quizEligible.map((item) => item.id);
        if (ids.length === 0) {
          setError("Select at least one multiple-choice or true/false question for a quiz. Other prompts go on an assignment.");
          return;
        }
        const result = await copyBankQuestionsToQuizAction({
          programId,
          lessonId,
          questionIds: ids,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        onAdded(
          result.skipped
            ? `Added ${result.added}. ${result.skipped} already in that quiz were skipped.`
            : `Added ${result.added} question${result.added === 1 ? "" : "s"} to the quiz.`,
          { reload: false },
        );
        return;
      }

      const prompts = questions
        .map((item) => {
          if ("options" in item) {
            return assignmentPromptFromBank(item as AuthoringBankQuestion);
          }
          return wrapBankBriefPrompt(item.questionText);
        })
        .filter(Boolean);
      if (prompts.length === 0) {
        setError("Select at least one prompt to add.");
        return;
      }
      const result = await appendAssignmentPromptAction({
        programId,
        lessonId,
        prompts,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onAdded(
        `Added ${prompts.length} prompt${prompts.length === 1 ? "" : "s"} to the assignment brief.`,
        { reload: false },
      );
    });
  }

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
        className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-[14px] bg-surface"
        style={{
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(15,15,15,.16), 0 2px 8px rgba(15,15,15,.06)",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="border-b px-5 py-4 sm:px-6"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(180deg, color-mix(in srgb, #e9e4f3 40%, white) 0%, var(--surface) 100%)",
          }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--module-academy-fg)" }}
          >
            Library
          </p>
          <h2 id={titleId} className="mt-1 text-[19px] font-semibold tracking-[-0.3px]">
            Add to quiz or assignment
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {hint}
          </p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div
            className="inline-flex rounded-[8px] p-0.5"
            style={{ background: "var(--surface-soft)", boxShadow: "inset 0 0 0 1px var(--border)" }}
          >
            <button
              type="button"
              disabled={!canQuiz || pending}
              onClick={() => changeKind("quiz")}
              className="h-8 rounded-[6px] border-0 px-3 text-[12.5px] font-medium disabled:opacity-40"
              style={{
                background: kind === "quiz" ? "var(--surface)" : "transparent",
                color: kind === "quiz" ? "var(--ink)" : "var(--text-secondary)",
              }}
            >
              Quiz
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => changeKind("assignment")}
              className="h-8 rounded-[6px] border-0 px-3 text-[12.5px] font-medium"
              style={{
                background: kind === "assignment" ? "var(--surface)" : "transparent",
                color: kind === "assignment" ? "var(--ink)" : "var(--text-secondary)",
              }}
            >
              Assignment
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FilterSelect
              tone="field"
              size="md"
              label="Course"
              value={programId}
              disabled={pending || loadingTargets}
              onChange={changeProgram}
              options={programs.map((item) => ({
                value: item.id,
                label: item.locked ? `${item.name} · Live` : item.name,
              }))}
            />
            <FilterSelect
              tone="field"
              size="md"
              label={kind === "quiz" ? "Quiz lesson" : "Assignment lesson"}
              value={lessonId}
              disabled={pending || loadingTargets || lessons.length === 0}
              placeholder={
                loadingTargets
                  ? "Loading…"
                  : kind === "quiz"
                    ? "No quiz lessons"
                    : "No assignment lessons"
              }
              onChange={(next) => {
                setLessonId(next);
                setError(null);
              }}
              options={
                loadingTargets
                  ? [{ value: "", label: "Loading…", disabled: true }]
                  : lessons.length === 0
                  ? [{ value: "", label: kind === "quiz" ? "No quiz lessons" : "No assignment lessons", disabled: true }]
                  : lessons.map((item) => ({
                      value: item.lessonId,
                      label:
                        "questionCount" in item
                          ? `${item.moduleTitle} · ${item.lessonTitle} · ${item.questionCount} question${item.questionCount === 1 ? "" : "s"}`
                          : `${item.moduleTitle} · ${item.lessonTitle}`,
                    }))
              }
            />
          </div>

          {program && !loadingTargets ? (
            <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {programStatusLabel(program.status)}
              {program.quizzes.length === 0 && program.assignments.length === 0 ? (
                <>
                  {" · "}
                  <a
                    href={program.builderHref}
                    className="font-medium no-underline hover:text-accent-hover"
                    style={{ color: "var(--accent)" }}
                  >
                    Open course builder
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {questions.length} selected
            {kind === "quiz" && quizEligible.length !== questions.length
              ? ` · ${quizEligible.length} can be copied into a quiz`
              : ""}
          </p>

          {error ? (
            <p className="text-[13.5px]" style={{ color: "var(--danger-fg)" }}>
              {error}
            </p>
          ) : null}
        </div>

        <div
          className="flex justify-end gap-2 border-t px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={pending || loadingTargets || locked || !programId || !lessonId}
            onClick={submit}
          >
            {pending
              ? "Adding…"
              : loadingTargets
                ? "Loading…"
                : kind === "quiz"
                  ? "Add to quiz"
                  : "Add to assignment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

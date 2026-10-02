"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";
import {
  groupQuestionBankByCourse,
  questionBankTypeLabel,
  type QuestionBankItem,
} from "@/academy/lib/questionBank/types";
import { deleteCustomBankQuestionAction } from "@/academy/lib/questionBank/actions";
import { useAddQuestion } from "./AddQuestionComposer";
import { CourseMark, QuestionTypeMark } from "./typeMark";

export type QuestionBankActionMode = "admin-catalog" | "instructor-quiz";

function buildActionHref(item: QuestionBankItem, mode: QuestionBankActionMode) {
  const isQuizItem = item.type === "multiple_choice" || item.type === "true_false" || item.type === "other";
  if (mode === "instructor-quiz" && isQuizItem && item.quizId) {
    return `/academy/instructor/programs/${item.programId}/quiz/${item.lessonId}`;
  }
  if (mode === "instructor-quiz") {
    return `/academy/instructor/programs/${item.programId}`;
  }
  return `/academy/admin/catalog/${item.programId}`;
}

function BankIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3.5" y="4.5" width="15" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9h8M7 12.5h5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2 5 8.7 9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function QuestionBankInteractiveList({
  items,
  emptyMessage,
  actionLabel,
  actionMode,
  canManageCustom = false,
}: {
  items: QuestionBankItem[];
  total: number;
  rangeStart: number;
  emptyMessage: string;
  actionLabel: string;
  actionMode: QuestionBankActionMode;
  canManageCustom?: boolean;
}) {
  const router = useRouter();
  const addQuestion = useAddQuestion();
  const courses = groupQuestionBankByCourse(items);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!addQuestion?.selectionEpoch) return;
    setSelected(new Set());
  }, [addQuestion?.selectionEpoch]);

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(item.id)),
    [items, selected],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function removeCustom(id: string) {
    setDeleteError(null);
    setDeletingId(id);
    const result = await deleteCustomBankQuestionAction(id);
    setDeletingId(null);
    if (!result.ok) {
      setDeleteError(result.message);
      return;
    }
    setConfirmingId(null);
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <EmptyState
        flush
        compact
        icon={<BankIcon />}
        title="Nothing in this view"
        body={emptyMessage}
        actions={
          addQuestion ? (
            <Button variant="primary" onClick={() => addQuestion.open()}>
              Add question
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="relative">
      {deleteError ? (
        <p className="px-5 pt-3 text-[13px] sm:px-6" style={{ color: "var(--danger-fg)" }}>
          {deleteError}
        </p>
      ) : null}

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {courses.map((course) => {
          const courseCount = course.lessons.reduce((sum, lesson) => sum + lesson.items.length, 0);
          return (
            <section key={course.programId} aria-labelledby={`course-${course.programId}`}>
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5 sm:px-6"
                style={{
                  borderColor: "var(--border)",
                  background: "color-mix(in srgb, var(--surface-soft) 80%, white)",
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CourseMark name={course.programName} />
                  <div className="min-w-0">
                    <h3
                      id={`course-${course.programId}`}
                      className="truncate text-[14.5px] font-semibold tracking-[-0.2px] text-pretty"
                    >
                      {course.programName}
                    </h3>
                    <p className="mt-0.5 text-[12px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                      {courseCount} on this page
                    </p>
                  </div>
                </div>
                {addQuestion ? (
                  <button
                    type="button"
                    onClick={() => addQuestion.open({ programId: course.programId })}
                    className="inline-flex h-8 shrink-0 items-center rounded-[8px] border-0 px-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--accent-tint)] hover:text-accent"
                    style={{ color: "var(--accent)", background: "transparent" }}
                  >
                    + Add here
                  </button>
                ) : null}
              </div>

              <div className="space-y-4 px-3 py-3 sm:px-4">
                {course.lessons.map((lesson) => {
                  const customLesson =
                    lesson.lessonType === "bank" || lesson.items.every((item) => item.custom);
                  return (
                    <div key={lesson.key}>
                      <div className="mb-1.5 flex items-center gap-2 px-2.5">
                        <span
                          className="h-1 w-1 shrink-0 rounded-full"
                          style={{
                            background: customLesson
                              ? "var(--module-academy-fg)"
                              : "var(--border-strong)",
                          }}
                          aria-hidden
                        />
                        <p
                          className="min-w-0 truncate text-[11.5px] font-medium tracking-[0.01em]"
                          style={{
                            color: customLesson
                              ? "var(--module-academy-fg)"
                              : "var(--text-tertiary)",
                          }}
                        >
                          {customLesson
                            ? "Saved for later · not in a quiz yet"
                            : `${lesson.moduleTitle} · ${lesson.lessonTitle}`}
                        </p>
                      </div>
                      <ul className="space-y-0.5">
                        {lesson.items.map((item) => {
                          const href = buildActionHref(item, actionMode);
                          const custom = item.custom || item.lessonType === "bank";
                          const isSelected = selected.has(item.id);
                          return (
                            <li key={item.id}>
                              <div
                                className={
                                  isSelected
                                    ? "group relative flex w-full items-start gap-3 rounded-[11px] px-3 py-2.5 transition-colors"
                                    : "group relative flex w-full items-start gap-3 rounded-[11px] px-3 py-2.5 transition-colors hover:bg-[var(--surface-soft)]"
                                }
                                style={
                                  isSelected
                                    ? {
                                        background:
                                          "color-mix(in srgb, var(--accent-tint) 78%, white)",
                                        boxShadow: "inset 3px 0 0 0 var(--accent)",
                                      }
                                    : undefined
                                }
                              >
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={isSelected}
                                  aria-label={`Select: ${item.questionText.slice(0, 80)}`}
                                  onClick={() => toggle(item.id)}
                                  className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-0"
                                  style={{
                                    background: isSelected ? "var(--accent)" : "var(--surface)",
                                    color: "#fff",
                                    boxShadow: isSelected
                                      ? "none"
                                      : "inset 0 0 0 1px var(--border-strong)",
                                  }}
                                >
                                  {isSelected ? <CheckIcon /> : null}
                                </button>

                                <QuestionTypeMark type={item.type} />

                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (custom) {
                                        addQuestion?.openReuse({
                                          programId: item.programId,
                                          questions: [
                                            {
                                              id: item.id,
                                              questionText: item.questionText,
                                              type: item.type,
                                            },
                                          ],
                                        });
                                        return;
                                      }
                                      router.push(href);
                                    }}
                                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                                  >
                                    <span className="block text-[14px] font-medium leading-snug text-pretty text-ink transition-colors group-hover:text-accent">
                                      {item.questionText}
                                    </span>
                                    <span
                                      className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]"
                                      style={{ color: "var(--text-tertiary)" }}
                                    >
                                      {custom ? (
                                        <span
                                          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold"
                                          style={{
                                            background: "#e9e4f3",
                                            color: "var(--module-academy-fg)",
                                          }}
                                        >
                                          Saved for later
                                        </span>
                                      ) : null}
                                      <span>{questionBankTypeLabel(item.type)}</span>
                                      {item.optionCount > 0 ? (
                                        <span className="tabular-nums">
                                          {item.optionCount} option
                                          {item.optionCount === 1 ? "" : "s"}
                                        </span>
                                      ) : null}
                                    </span>
                                  </button>

                                  {custom && canManageCustom ? (
                                    <div className="mt-0.5 flex shrink-0 items-center gap-1">
                                      {confirmingId === item.id ? (
                                        <>
                                          <button
                                            type="button"
                                            disabled={deletingId === item.id}
                                            onClick={() => void removeCustom(item.id)}
                                            className="rounded-[6px] border-0 px-2 py-1 text-[12px] font-medium"
                                            style={{
                                              color: "var(--danger-fg)",
                                              background: "transparent",
                                            }}
                                          >
                                            {deletingId === item.id ? "Deleting…" : "Confirm"}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={deletingId === item.id}
                                            onClick={() => setConfirmingId(null)}
                                            className="rounded-[6px] border-0 px-2 py-1 text-[12px] font-medium"
                                            style={{
                                              color: "var(--text-tertiary)",
                                              background: "transparent",
                                            }}
                                          >
                                            Cancel
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeleteError(null);
                                            setConfirmingId(item.id);
                                          }}
                                          className="rounded-[6px] border-0 px-2 py-1 text-[12px] font-medium opacity-0 transition-opacity hover:bg-[var(--surface)] group-hover:opacity-100 focus-visible:opacity-100"
                                          style={{
                                            color: "var(--text-tertiary)",
                                            background: "transparent",
                                          }}
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  ) : custom ? null : (
                                    <Link
                                      href={href}
                                      onClick={(event) => event.stopPropagation()}
                                      aria-label={`${actionLabel}: ${item.questionText.slice(0, 48)}`}
                                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] no-underline opacity-0 transition-opacity hover:bg-[color:var(--accent-tint)] hover:text-accent group-hover:opacity-100 focus-visible:opacity-100"
                                      style={{ color: "var(--text-tertiary)" }}
                                    >
                                      <ChevronIcon />
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selectedItems.length > 0 && addQuestion ? (
        <div className="sticky bottom-4 z-20 flex justify-center px-4 pb-2 pt-1">
          <div
            className="flex w-full max-w-[36rem] items-center justify-between gap-3 rounded-[14px] border bg-surface px-2 py-1.5 pl-4 backdrop-blur"
            style={{
              borderColor: "var(--border-strong)",
              boxShadow:
                "0 16px 48px rgba(15,15,15,.14), 0 2px 6px rgba(15,15,15,.06)",
            }}
          >
            <p className="text-[13px] font-medium tabular-nums">
              <span style={{ color: "var(--accent)" }}>{selectedItems.length}</span>
              <span className="ml-1.5" style={{ color: "var(--text-secondary)" }}>
                selected
              </span>
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="h-8 rounded-[8px] border-0 px-3 text-[12.5px] font-medium"
                style={{ color: "var(--text-secondary)", background: "transparent" }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() =>
                  addQuestion.openReuse({
                    programId: selectedItems[0]?.programId,
                    questions: selectedItems.map((item) => ({
                      id: item.id,
                      questionText: item.questionText,
                      type: item.type,
                    })),
                  })
                }
                className="h-8 rounded-[8px] border-0 px-3.5 text-[12.5px] font-semibold text-white"
                style={{ background: "var(--accent)" }}
              >
                Add to quiz or assignment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M5 3.5L8.5 7L5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

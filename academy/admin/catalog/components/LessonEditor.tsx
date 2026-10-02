"use client";

import { useEffect, useState } from "react";
import {
  parsePassingScorePercent,
  sanitizeScorePercentInput,
} from "@/academy/lib/scorePercent";
import { formatInlineMarkdownFragment } from "../lib/formatInlineMarkdown";
import { FromBankPicker } from "@/academy/components/questionBank/FromBankPicker";
import {
  assignmentPromptFromBank,
  catalogQuestionFromBank,
  mergeAssignmentBrief,
} from "@/academy/lib/questionBank/mapAuthoring";
import {
  BANK_BRIEF_OPEN,
  briefHasBankPrompt,
  wrapBankBriefPrompt,
} from "@/academy/lib/questionBank/bankOrigin";
import { loadAuthoringQuestionsAction } from "@/academy/lib/questionBank/actions";
import { MAX_QUESTIONS } from "@/academy/instructor/quiz-editor/types";
import type { CatalogLesson } from "../types";
import { AssignmentFileBlock } from "./lesson/AssignmentFileBlock";
import { LessonBody } from "./lesson/LessonBody";
import { LessonDocEditor } from "./lesson/LessonDocEditor";
import { QuizView } from "./lesson/QuizView";
import { VideoBlock } from "./lesson/VideoBlock";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

const CONTENT_TYPES = [
  { label: "Reading", value: "reading" },
  { label: "Video", value: "video" },
  { label: "Scenario", value: "scenario" },
  { label: "Resource", value: "resource" },
] as const;

const ASSESSMENT_TYPES = [
  { label: "Assignment", value: "assignment" },
  { label: "Quiz", value: "quiz" },
] as const;

type LessonType = (typeof CONTENT_TYPES)[number]["value"] | (typeof ASSESSMENT_TYPES)[number]["value"];

/** Keep spaces and blank lines while typing. Save/persist still trims. */
function linesFromMultilineInput(value: string) {
  return value.split("\n");
}

function emptyAssignment(): NonNullable<CatalogLesson["assignment"]> {
  return {
    id: "",
    brief: "",
    submissionInstructions: "",
    rubric: "",
    estimatedMinutes: "45",
  };
}

function emptyQuiz(): NonNullable<CatalogLesson["quiz"]> {
  return {
    id: "",
    passingScore: "80",
    questions: [
      {
        id: "",
        questionText: "New question",
        type: "multiple_choice",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: "Option A",
        sortOrder: 0,
      },
    ],
  };
}

function patchForType(type: LessonType, lesson: CatalogLesson): Partial<CatalogLesson> {
  if (type === "assignment") {
    return { type, assignment: lesson.assignment ?? emptyAssignment() };
  }
  if (type === "quiz") {
    return { type, quiz: lesson.quiz ?? emptyQuiz() };
  }
  return { type };
}

function typeChipStyle(active: boolean) {
  return {
    background: active ? "var(--accent-tint-mid, #f4f9fe)" : "transparent",
    color: active ? "var(--accent, #2383e2)" : "var(--text-tertiary)",
    border: active ? "1px solid rgba(35,131,226,.25)" : "1px solid transparent",
  };
}

export function LessonEditor({
  lesson,
  programId,
  moduleTitle,
  moduleIndex,
  lessonIndex,
  disabled,
  onChange,
  onDelete,
}: {
  lesson: CatalogLesson;
  programId: string;
  moduleTitle?: string;
  moduleIndex?: number;
  lessonIndex?: number;
  disabled?: boolean;
  onChange: (patch: Partial<CatalogLesson>) => void;
  onDelete?: () => void;
}) {
  // Open in Preview first — authors switch to Edit when they want to change content.
  const [mode, setMode] = useState<"read" | "edit">("read");
  const questions = lesson.quiz?.questions ?? [];

  const typeLabel =
    [...CONTENT_TYPES, ...ASSESSMENT_TYPES].find((t) => t.value === lesson.type)?.label ?? "Lesson";

  return (
    <div className="min-w-0 max-w-full px-3 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {moduleTitle ? (
            <p className="text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              Module {(moduleIndex ?? 0) + 1} · {moduleTitle}
              <span aria-hidden> › </span>
              Lesson {(lessonIndex ?? 0) + 1}
            </p>
          ) : null}
          <p
            className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Curriculum lesson · {typeLabel}
          </p>
        </div>
        <div
          className="inline-flex rounded-[8px] border p-0.5"
          style={{ borderColor: "var(--border-strong)", background: "var(--surface-soft)" }}
        >
          {(["read", "edit"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className="rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium"
              style={{
                background: mode === value ? "var(--surface)" : "transparent",
                color: mode === value ? "var(--ink)" : "var(--text-tertiary)",
                border: mode === value ? "1px solid var(--border)" : "1px solid transparent",
                boxShadow: mode === value ? "0 1px 2px rgba(15,15,15,.04)" : "none",
              }}
            >
              {value === "read" ? "Preview" : "Edit"}
            </button>
          ))}
        </div>
      </div>

      <div
        className="overflow-hidden rounded-[14px] border"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          boxShadow: "0 1px 3px rgba(15,15,15,.06)",
        }}
      >
        <div className="border-b px-4 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          {mode === "read" ? (
            <>
              <h1
                className="text-[22px] font-semibold leading-[1.2] tracking-[-0.035em] text-pretty sm:text-[28px]"
                style={{ color: "var(--ink)" }}
              >
                {lesson.title || "Untitled lesson"}
              </h1>
              {lesson.contentSummary ? (
                <p
                  className="mt-2 text-[15px] leading-[1.65]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatInlineMarkdownFragment(lesson.contentSummary)}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <input
                type="text"
                value={lesson.title}
                disabled={disabled}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="Untitled lesson"
                className="w-full min-w-0 bg-transparent text-[22px] font-semibold leading-[1.15] tracking-[-0.03em] outline-none sm:text-[28px]"
                style={{ color: "var(--ink)" }}
              />
              <input
                type="text"
                value={lesson.contentSummary}
                disabled={disabled}
                onChange={(e) => onChange({ contentSummary: e.target.value })}
                placeholder="Add a one-line summary learners see under the title"
                className="mt-2 w-full bg-transparent text-[15px] leading-[1.65] outline-none"
                style={{ color: "var(--text-secondary)" }}
              />
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {[...CONTENT_TYPES, ...ASSESSMENT_TYPES].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(patchForType(t.value, lesson))}
                    className="rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-medium"
                    style={typeChipStyle(lesson.type === t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-5 sm:px-6">
          {lesson.type === "quiz" ? (
            <QuizPane
              lesson={lesson}
              programId={programId}
              questions={questions}
              mode={mode}
              disabled={disabled}
              onChange={onChange}
            />
          ) : lesson.type === "assignment" ? (
            <AssignmentPane
              lesson={lesson}
              programId={programId}
              mode={mode}
              disabled={disabled}
              onChange={onChange}
            />
          ) : (
            <ContentPane
              lesson={lesson}
              programId={programId}
              mode={mode}
              disabled={disabled}
              onChange={onChange}
            />
          )}

          {onDelete && mode === "edit" ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onDelete}
              className="mt-8 text-[13px] font-medium"
              style={{ color: "#c4554d", background: "transparent", border: "none" }}
            >
              Delete this lesson
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QuizPane({
  lesson,
  programId,
  questions,
  mode,
  disabled,
  onChange,
}: {
  lesson: CatalogLesson;
  programId: string;
  questions: NonNullable<CatalogLesson["quiz"]>["questions"];
  mode: "read" | "edit";
  disabled?: boolean;
  onChange: (patch: Partial<CatalogLesson>) => void;
}) {
  if (mode === "read") {
    if (lesson.quiz && lesson.quiz.questions.length > 0) {
      return <QuizView quiz={lesson.quiz} />;
    }
    return (
      <EmptyPane message="This quiz has no questions yet. Switch to Edit to add a knowledge check." />
    );
  }

  return (
    <div className="space-y-5">
      <QuizEditor
        lesson={lesson}
        programId={programId}
        questions={questions}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function AssignmentPane({
  lesson,
  programId,
  mode,
  disabled,
  onChange,
}: {
  lesson: CatalogLesson;
  programId: string;
  mode: "read" | "edit";
  disabled?: boolean;
  onChange: (patch: Partial<CatalogLesson>) => void;
}) {
  const assignment = lesson.assignment;
  const hasReadContent =
    Boolean(lesson.contentUrl.trim()) ||
    Boolean(assignment && (assignment.brief.trim() || assignment.submissionInstructions.trim() || assignment.rubric.trim())) ||
    lesson.learningObjectives.some((line) => line.trim()) ||
    lesson.resources.length > 0;

  // Retroactively wrap bank prompts that were added before markers existed.
  useEffect(() => {
    const brief = assignment?.brief ?? "";
    if (!brief.trim() || briefHasBankPrompt(brief) || disabled) return;
    let cancelled = false;
    void (async () => {
      const result = await loadAuthoringQuestionsAction({ programId, bankOnly: true });
      if (cancelled || !result.ok || result.items.length === 0) return;
      const needles = result.items
        .map((item) => item.questionText.trim())
        .filter((text) => text.length >= 3);
      if (needles.length === 0) return;
      let next = brief;
      let changed = false;
      for (const needle of needles) {
        if (next.includes(`${BANK_BRIEF_OPEN}`) && next.includes(needle)) continue;
        if (!next.includes(needle)) continue;
        // Only wrap when the prompt appears as its own block.
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`(^|\\n\\n)${escaped}(?=\\n\\n|$)`, "m");
        if (!pattern.test(next)) continue;
        next = next.replace(pattern, (_, prefix: string) => `${prefix}${wrapBankBriefPrompt(needle)}`);
        changed = true;
      }
      if (!changed || cancelled) return;
      onChange({
        assignment: {
          ...(assignment ?? emptyAssignment()),
          brief: next,
        },
      });
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally once per lesson brief that lacks markers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, programId]);

  if (mode === "read") {
    if (!hasReadContent) {
      return (
        <EmptyPane message="This assignment has no brief yet. Switch to Edit to write it and upload a file." />
      );
    }
    return (
      <div className="space-y-7">
        {lesson.contentUrl.trim() ? (
          <AssignmentFileBlock
            programId={programId}
            lessonId={lesson.id}
            fileUrl={lesson.contentUrl}
            canUpload={false}
            disabled
            onChange={() => undefined}
          />
        ) : null}
        <LessonBody lesson={lesson} showBankStars />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <p
        className="rounded-[8px] border px-3.5 py-2.5 text-[13px] leading-relaxed"
        style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-secondary)" }}
      >
        Learners see the brief and how to submit only. Keep model answers out of those fields — put grading
        keys in Success criteria (instructors only; never shown to learners).
      </p>
      <Section title="Assignment file">
        <AssignmentFileBlock
          programId={programId}
          lessonId={lesson.id}
          fileUrl={lesson.contentUrl}
          canUpload
          disabled={disabled}
          onChange={(contentUrl) => onChange({ contentUrl })}
        />
      </Section>

      <Section title="Brief">
        <div className="mb-2 flex justify-end">
          <FromBankPicker
            kind="assignment"
            programId={programId}
            excludeTexts={assignment?.brief ? [assignment.brief] : []}
            disabled={disabled}
            onPick={(picked) => {
              const prompts = picked.map(assignmentPromptFromBank).filter(Boolean);
              if (prompts.length === 0) return;
              const current = assignment ?? emptyAssignment();
              onChange({
                assignment: {
                  ...current,
                  brief: mergeAssignmentBrief(current.brief, prompts),
                },
              });
            }}
          />
        </div>
        <textarea
          value={assignment?.brief ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              assignment: { ...(assignment ?? emptyAssignment()), brief: e.target.value },
            })
          }
          placeholder="What the learner must do"
          rows={4}
          className="w-full rounded-[8px] border p-3 text-[14px] leading-[1.65] outline-none"
          style={{ borderColor: "var(--border)", color: "var(--ink)" }}
        />
      </Section>

      <Section title="How to submit">
        <textarea
          value={assignment?.submissionInstructions ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              assignment: {
                ...(assignment ?? emptyAssignment()),
                submissionInstructions: e.target.value,
              },
            })
          }
          placeholder="File type, length, or anything the instructor needs to review the work"
          rows={3}
          className="w-full rounded-[8px] border p-3 text-[14px] leading-[1.65] outline-none"
          style={{ borderColor: "var(--border)", color: "var(--ink)" }}
        />
      </Section>

      <Section title="Success criteria (instructors only)">
        <textarea
          value={assignment?.rubric ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              assignment: { ...(assignment ?? emptyAssignment()), rubric: e.target.value },
            })
          }
          placeholder="Grading rubric for instructors — not shown to learners"
          rows={3}
          className="w-full rounded-[8px] border p-3 text-[14px] leading-[1.65] outline-none"
          style={{ borderColor: "var(--border)", color: "var(--ink)" }}
        />
      </Section>

      <Section title="Estimated time">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={assignment?.estimatedMinutes ?? ""}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                assignment: {
                  ...(assignment ?? emptyAssignment()),
                  estimatedMinutes: e.target.value,
                },
              })
            }
            className="w-20 rounded-[6px] border px-2 py-1.5 text-[13px] outline-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
          />
          <span className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            minutes
          </span>
        </div>
      </Section>
    </div>
  );
}

function ContentPane({
  lesson,
  programId,
  mode,
  disabled,
  onChange,
}: {
  lesson: CatalogLesson;
  programId: string;
  mode: "read" | "edit";
  disabled?: boolean;
  onChange: (patch: Partial<CatalogLesson>) => void;
}) {
  if (lesson.type === "video") {
    return (
      <VideoOnlyPane
        lesson={lesson}
        programId={programId}
        mode={mode}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (lesson.type === "resource") {
    return (
      <ResourceOnlyPane lesson={lesson} mode={mode} disabled={disabled} onChange={onChange} />
    );
  }

  return (
    <TeachingCopyPane
      lesson={lesson}
      mode={mode}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

function VideoOnlyPane({
  lesson,
  programId,
  mode,
  disabled,
  onChange,
}: {
  lesson: CatalogLesson;
  programId: string;
  mode: "read" | "edit";
  disabled?: boolean;
  onChange: (patch: Partial<CatalogLesson>) => void;
}) {
  if (mode === "read") {
    if (!lesson.videoUrl.trim()) {
      return <EmptyPane message="No video yet. Switch to Edit to add a link or upload." />;
    }
    return (
      <VideoBlock
        programId={programId}
        lessonId={lesson.id}
        videoUrl={lesson.videoUrl}
        canUpload={false}
        disabled
        onChange={() => undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        This section is only for the video — add a link or upload a file.
      </p>
      <VideoBlock
        programId={programId}
        lessonId={lesson.id}
        videoUrl={lesson.videoUrl}
        canUpload
        disabled={disabled}
        onChange={(videoUrl) => onChange({ videoUrl })}
      />
    </div>
  );
}

function ResourceOnlyPane({
  lesson,
  mode,
  disabled,
  onChange,
}: {
  lesson: CatalogLesson;
  mode: "read" | "edit";
  disabled?: boolean;
  onChange: (patch: Partial<CatalogLesson>) => void;
}) {
  if (mode === "read") {
    if (lesson.resources.length === 0) {
      return <EmptyPane message="No resources yet. Switch to Edit to add links." />;
    }
    return (
      <LessonBody
        lesson={{ ...lesson, contentBody: "", learningObjectives: [], assignment: null }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        This section is only for resources. Add a title and link for each item.
      </p>
      <ResourceEditor lesson={lesson} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function TeachingCopyPane({
  lesson,
  mode,
  disabled,
  onChange,
}: {
  lesson: CatalogLesson;
  mode: "read" | "edit";
  disabled?: boolean;
  onChange: (patch: Partial<CatalogLesson>) => void;
}) {
  const hasBody = Boolean(lesson.contentBody.trim());
  const hasObjectives = lesson.learningObjectives.some((line) => line.trim());

  if (mode === "read") {
    if (!hasBody && !hasObjectives) {
      return (
        <EmptyPane message="Nothing written yet. Switch to Edit to add objectives and lesson text." />
      );
    }
    return (
      <div className="space-y-7">
        <LessonBody
          lesson={{ ...lesson, resources: [], assignment: null }}
          showBankStars
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Learning objectives">
        <ObjectivesEditor
          value={lesson.learningObjectives}
          disabled={disabled}
          onChange={(learningObjectives) => onChange({ learningObjectives })}
        />
      </Section>

      <Section title="Lesson content">
        <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Select text to bold, italic, resize, or make a list. The format bar appears only while text is selected.
        </p>
        <LessonDocEditor
          value={lesson.contentBody}
          disabled={disabled}
          autofocus
          onChange={(contentBody) => onChange({ contentBody })}
        />
      </Section>
    </div>
  );
}

function ObjectivesEditor({
  value,
  disabled,
  onChange,
}: {
  value: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const items = value.length > 0 ? value : [""];

  return (
    <div className="space-y-2">
      <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        What should the learner be able to do after this lesson?
      </p>
      {items.map((item, index) => (
        <div key={`obj-${index}`} className="flex items-center gap-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          >
            {index + 1}
          </span>
          <input
            type="text"
            value={item}
            disabled={disabled}
            placeholder="e.g. Explain how the call stack works"
            onChange={(e) => {
              const next = [...items];
              next[index] = e.target.value;
              onChange(next);
            }}
            className="w-full rounded-[8px] border px-3 py-2 text-[14px] outline-none"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
          />
          <button
            type="button"
            disabled={disabled || items.length <= 1}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className="shrink-0 text-[12px] disabled:opacity-40"
            style={{ color: "var(--text-tertiary)", background: "transparent", border: "none" }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...items, ""])}
        className="text-[13px] font-medium"
        style={{ color: "var(--accent)", background: "transparent", border: "none" }}
      >
        + Add objective
      </button>
    </div>
  );
}

function EmptyPane({ message }: { message: string }) {
  return (
    <div
      className="rounded-[10px] border px-4 py-8 text-center text-[14px]"
      style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
    >
      {message}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2
        className="text-[11px] font-semibold uppercase tracking-[0.09em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ResourceEditor({
  lesson,
  disabled,
  onChange,
}: {
  lesson: CatalogLesson;
  disabled?: boolean;
  onChange: (patch: Partial<CatalogLesson>) => void;
}) {
  return (
    <div className="space-y-3">
      {lesson.resources.map((resource, index) => (
        <div
          key={`${resource.id || "new"}-${index}`}
          className="rounded-[8px] border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={resource.title}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  resources: lesson.resources.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, title: e.target.value } : item,
                  ),
                })
              }
              placeholder="Resource title"
              className="w-full rounded-[6px] border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  resources: lesson.resources.filter((_, itemIndex) => itemIndex !== index),
                })
              }
              className="shrink-0 text-[12px]"
              style={{ color: "var(--text-tertiary)", background: "transparent", border: "none" }}
            >
              Remove
            </button>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <input
              type="text"
              value={resource.url}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  resources: lesson.resources.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, url: e.target.value } : item,
                  ),
                })
              }
              placeholder="https://…"
              className="rounded-[6px] border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            />
            <input
              type="text"
              value={resource.resourceType}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  resources: lesson.resources.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, resourceType: e.target.value } : item,
                  ),
                })
              }
              placeholder="Type — brief, template, reading"
              className="rounded-[6px] border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            />
          </div>
          <textarea
            value={resource.notes}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                resources: lesson.resources.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, notes: e.target.value } : item,
                ),
              })
            }
            placeholder="Why this resource matters"
            rows={2}
            className="mt-2 w-full rounded-[6px] border px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
          />
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange({
            resources: [
              ...lesson.resources,
              {
                id: "",
                title: "New resource",
                resourceType: "reading",
                url: "",
                notes: "",
                sortOrder: lesson.resources.length,
              },
            ],
          })
        }
        className="text-[13px] font-medium"
        style={{ color: "var(--accent)", background: "transparent", border: "none" }}
      >
        Add resource
      </button>
    </div>
  );
}

function QuizEditor({
  lesson,
  programId,
  questions,
  disabled,
  onChange,
}: {
  lesson: CatalogLesson;
  programId: string;
  questions: NonNullable<CatalogLesson["quiz"]>["questions"];
  disabled?: boolean;
  onChange: (patch: Partial<CatalogLesson>) => void;
}) {
  function addFromBank(
    picked: Parameters<typeof catalogQuestionFromBank>[0][],
  ) {
    const existingTexts = new Set(
      questions.map((question) => question.questionText.trim().toLowerCase()).filter(Boolean),
    );
    const room = Math.max(0, MAX_QUESTIONS - questions.length);
    const nextQuestions = [...questions];
    for (const item of picked) {
      if (nextQuestions.length >= questions.length + room) break;
      const mapped = catalogQuestionFromBank(item, nextQuestions.length);
      if (!mapped) continue;
      const key = mapped.questionText.trim().toLowerCase();
      if (!key || existingTexts.has(key)) continue;
      existingTexts.add(key);
      nextQuestions.push(mapped);
    }
    if (nextQuestions.length === questions.length) return;
    onChange({
      quiz: {
        ...(lesson.quiz ?? { id: "", passingScore: "80", questions: [] }),
        questions: nextQuestions,
      },
    });
  }

  if (!lesson.quiz) {
    return (
      <div className="space-y-3">
        <EmptyPane message="No quiz on this lesson yet." />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ quiz: emptyQuiz() })}
            className="text-[13px] font-medium"
            style={{ color: "var(--accent)", background: "transparent", border: "none" }}
          >
            Add quiz
          </button>
          <FromBankPicker
            kind="quiz"
            programId={programId}
            disabled={disabled}
            remaining={MAX_QUESTIONS}
            onPick={addFromBank}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p
        className="rounded-[8px] border px-3.5 py-2.5 text-[13px] leading-relaxed"
        style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-secondary)" }}
      >
        Learners only see the question prompt and options — never the correct answer or explanations. Write
        the question so it does not reveal the answer; keep the key in Correct answer only.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Pass at
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={lesson.quiz.passingScore}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                quiz: {
                  ...lesson.quiz!,
                  passingScore: sanitizeScorePercentInput(e.target.value),
                },
              })
            }
            onBlur={() => {
              const next = parsePassingScorePercent(lesson.quiz?.passingScore, 80);
              if (String(next) !== lesson.quiz?.passingScore) {
                onChange({
                  quiz: { ...lesson.quiz!, passingScore: String(next) },
                });
              }
            }}
            className="w-[72px] rounded-[6px] border px-2 py-1.5 text-[13px] outline-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
            title="Pass mark as a percent out of 100 (maximum 100)"
          />
          %
          <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            of 100
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <FromBankPicker
            kind="quiz"
            programId={programId}
            excludeIds={questions.map((question) => question.id).filter(Boolean)}
            excludeTexts={questions.map((question) => question.questionText)}
            disabled={disabled || questions.length >= MAX_QUESTIONS}
            remaining={Math.max(0, MAX_QUESTIONS - questions.length)}
            onPick={addFromBank}
          />
          <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange({
              quiz: {
                ...lesson.quiz!,
                questions: [
                  ...questions,
                  {
                    id: "",
                    questionText: "New question",
                    type: "multiple_choice",
                    options: ["Option A", "Option B", "Option C", "Option D"],
                    correctAnswer: "Option A",
                    sortOrder: questions.length,
                  },
                ],
              },
            })
          }
          className="rounded-[6px] border px-2.5 py-1.5 text-[13px] font-medium"
          style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
        >
          Add question
        </button>
        </div>
      </div>
      {questions.map((question, index) => (
        <div
          key={`${question.id || "new"}-${index}`}
          className="rounded-[8px] border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="flex items-start gap-2">
            <span
              className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums"
              style={{ background: "var(--accent-tint-soft, #e7f1fb)", color: "var(--accent, #2383e2)" }}
            >
              {index + 1}
            </span>
            {question.fromBank ? (
              <span
                className="mt-2 inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold"
                title="From question bank"
                style={{
                  background: "color-mix(in srgb, #c9a227 16%, white)",
                  color: "#8a6d12",
                }}
              >
                <BankStarIcon />
                Bank
              </span>
            ) : null}
            <input
              type="text"
              value={question.questionText}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  quiz: {
                    ...lesson.quiz!,
                    questions: questions.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, questionText: e.target.value } : item,
                    ),
                  },
                })
              }
              placeholder="Question prompt only — do not include the answer"
              className="w-full rounded-[6px] border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  quiz: {
                    ...lesson.quiz!,
                    questions: questions.filter((_, itemIndex) => itemIndex !== index),
                  },
                })
              }
              className="shrink-0 text-[12px]"
              style={{ color: "var(--text-tertiary)", background: "transparent", border: "none" }}
            >
              Remove
            </button>
          </div>
          <div className="mt-2 flex gap-2 pl-8">
            <FilterSelect
              hideLabel
              tone="field"
              size="sm"
              className="w-[11.5rem] shrink-0"
              label="Question type"
              value={question.type}
              disabled={disabled}
              onChange={(next) => {
                const type = next === "true_false" ? "true_false" : "multiple_choice";
                const options = type === "true_false" ? ["True", "False"] : question.options;
                onChange({
                  quiz: {
                    ...lesson.quiz!,
                    questions: questions.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            type,
                            options,
                            correctAnswer: type === "true_false" ? "True" : options[0] ?? "",
                          }
                        : item,
                    ),
                  },
                });
              }}
              options={[
                { value: "multiple_choice", label: "Multiple choice" },
                { value: "true_false", label: "True / False" },
              ]}
            />
            <input
              type="text"
              value={question.correctAnswer}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  quiz: {
                    ...lesson.quiz!,
                    questions: questions.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, correctAnswer: e.target.value } : item,
                    ),
                  },
                })
              }
              placeholder="Correct answer"
              className="flex-1 rounded-[6px] border px-3 py-1.5 text-[12px] outline-none"
              style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            />
          </div>
          {question.type === "multiple_choice" ? (
            <textarea
              value={question.options.join("\n")}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  quiz: {
                    ...lesson.quiz!,
                    questions: questions.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            options: linesFromMultilineInput(e.target.value),
                          }
                        : item,
                    ),
                  },
                })
              }
              placeholder="One option per line"
              rows={4}
              className="mt-2 w-full rounded-[6px] border px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BankStarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.6l1.76 3.56 3.93.57-2.84 2.77.67 3.91L8 10.56l-3.52 1.85.67-3.91L2.3 5.73l3.93-.57L8 1.6z"
        fill="currentColor"
      />
    </svg>
  );
}

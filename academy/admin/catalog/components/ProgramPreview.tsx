"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/base/components/Button";
import type { CatalogLesson, CatalogModule, CatalogProgramDetail } from "../types";
import { useProgramCover } from "./ProgramCoverImage";
import { formatInlineMarkdown } from "../lib/formatInlineMarkdown";
import {
  countLessons,
  countQuestions,
  estimatedDuration,
  formatMinutes,
  lessonMinutes,
  totalMinutes,
} from "../lib/programStats";
import { programTypeLabel } from "@/academy/lib/domain";

/* ── icon primitives ─────────────────────────────────────────── */

type IconProps = { size?: number; color?: string; strokeWidth?: number };

function Icon({
  d,
  size = 16,
  color = "currentColor",
  strokeWidth = 1.7,
  children,
}: IconProps & { d?: string; children?: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d ? <path d={d} /> : null}
      {children}
    </svg>
  );
}

const PATH = {
  modules: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  lessons: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  question:
    "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
  clock: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  award: "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12",
  infinity:
    "M6.5 15.5a3.5 3.5 0 1 1 0-7c2.5 0 3.2 2 5.5 3.5s3 3.5 5.5 3.5a3.5 3.5 0 1 0 0-7c-2.5 0-3 2-5.5 3.5S9 15.5 6.5 15.5z",
  users:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  target:
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  lock: "M7 11V7a5 5 0 0 1 10 0v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  layers: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
};

function LessonIcon({ type, color }: { type: string; color: string }) {
  const props = { size: 14, color, strokeWidth: 1.7 };
  switch (type) {
    case "video":
      return (
        <Icon {...props}>
          <polygon points="5 3 19 12 5 21 5 3" fill={color} stroke="none" />
        </Icon>
      );
    case "quiz":
      return <Icon {...props} d={PATH.question} />;
    case "assignment":
      return (
        <Icon {...props}>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" />
        </Icon>
      );
    case "scenario":
      return <Icon {...props} d={PATH.target} />;
    case "resource":
    case "attachment":
      return (
        <Icon
          {...props}
          d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        />
      );
    default:
      return <Icon {...props} d={PATH.modules} />;
  }
}

/* ── helpers ─────────────────────────────────────────────────── */

const LESSON_TYPE_LABELS: Record<string, string> = {
  reading: "Reading",
  video: "Video",
  quiz: "Quiz",
  assignment: "Assignment",
  scenario: "Scenario",
  resource: "Resource",
  attachment: "Attachment",
};

function lessonTypeLabel(type: string) {
  return LESSON_TYPE_LABELS[type] ?? type;
}

function allObjectives(program: CatalogProgramDetail) {
  const set = new Set<string>();
  for (const mod of program.modules) {
    for (const lesson of mod.lessons) {
      for (const obj of lesson.learningObjectives) {
        const trimmed = obj.trim();
        if (trimmed) set.add(trimmed);
      }
    }
  }
  return [...set].slice(0, 8);
}

function moduleMinutes(mod: CatalogModule) {
  return mod.lessons.reduce((sum, l) => sum + lessonMinutes(l), 0);
}

function moduleQuestions(mod: CatalogModule) {
  return mod.lessons.reduce((s, l) => s + (l.quiz?.questions.length ?? 0), 0);
}

/**
 * Content-mix palette. Fixed order, never cycled — a colour belongs to a lesson
 * kind, not to its rank in the bar. Validated for CVD separation, chroma and
 * contrast against the light surface in this exact adjacency order.
 */
const MIX_SERIES = [
  { key: "reading", label: "Reading", color: "#2383e2" },
  { key: "quiz", label: "Quiz", color: "#1c7a52" },
  { key: "video", label: "Video", color: "#8b4fc0" },
  { key: "assignment", label: "Assignment", color: "#b06b12" },
  { key: "practice", label: "Practice", color: "#c2426b" },
] as const;

type MixKey = (typeof MIX_SERIES)[number]["key"];

function mixKey(type: string): MixKey {
  if (type === "reading") return "reading";
  if (type === "quiz") return "quiz";
  if (type === "video") return "video";
  if (type === "assignment") return "assignment";
  return "practice";
}

/* ── hero ────────────────────────────────────────────────────── */

const HERO_FALLBACK =
  "radial-gradient(1100px 420px at 12% -25%, rgba(35,131,226,.42), transparent 62%)," +
  "radial-gradient(900px 420px at 92% 118%, rgba(107,79,168,.40), transparent 60%)," +
  "linear-gradient(158deg, #33312d 0%, #232220 52%, #191817 100%)";

const HERO_SCRIM =
  "linear-gradient(180deg, rgba(20,19,18,.30) 0%, rgba(20,19,18,.58) 42%, rgba(20,19,18,.88) 100%)";

function ProgramHero({
  program,
  typeLabel,
  isDraft,
  metaItems,
}: {
  program: CatalogProgramDetail;
  typeLabel: string;
  isDraft: boolean;
  metaItems: string[];
}) {
  const cover = useProgramCover({
    programId: program.id,
    coverImageUrl: program.coverImageUrl,
    disabled: true,
    onChange: () => {},
  });

  return (
    <header className="relative isolate overflow-hidden" style={{ background: "#1b1a18" }}>
      {cover.src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: HERO_SCRIM }} />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: HERO_FALLBACK }} />
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px)," +
                "linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(70% 80% at 30% 20%, #000 0%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(70% 80% at 30% 20%, #000 0%, transparent 75%)",
            }}
          />
        </>
      )}

      <div className="relative mx-auto flex min-h-[300px] max-w-[1120px] flex-col justify-end px-5 pb-11 pt-16 sm:min-h-[340px] sm:px-8 sm:pb-12 sm:pt-20">
        <span className="block h-[3px] w-9 rounded-full" style={{ background: "var(--accent, #2383e2)" }} />

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "rgba(255,255,255,.82)" }}
          >
            {typeLabel}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{
              background: isDraft ? "rgba(255,255,255,.14)" : "rgba(94,204,140,.20)",
              color: isDraft ? "rgba(255,255,255,.88)" : "#a9e9c4",
              border: `1px solid ${isDraft ? "rgba(255,255,255,.22)" : "rgba(140,225,180,.35)"}`,
            }}
          >
            <span
              className="h-[5px] w-[5px] rounded-full"
              style={{ background: isDraft ? "rgba(255,255,255,.7)" : "#7fd9a6" }}
            />
            {isDraft ? (program.status === "pending_approval" ? "In review" : "Draft") : "Published"}
          </span>
        </div>

        <h1
          className="mt-3 max-w-[780px] text-[30px] font-bold leading-[1.12] tracking-[-0.7px] sm:text-[38px]"
          style={{ color: "#fff" }}
        >
          {program.name}
        </h1>

        {program.description ? (
          <p className="mt-4 max-w-[640px] text-[15px] leading-[1.65]" style={{ color: "rgba(255,255,255,.76)" }}>
            {program.description}
          </p>
        ) : null}

        <div
          className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]"
          style={{ color: "rgba(255,255,255,.72)" }}
        >
          {metaItems.map((item, i) => (
            <span key={item} className="flex items-center gap-3">
              {i > 0 ? <span style={{ color: "rgba(255,255,255,.32)" }}>·</span> : null}
              <span>{item}</span>
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

/* ── stat strip ──────────────────────────────────────────────── */

function StatCell({ path, value, label }: { path: string; value: string; label: string }) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-4 lg:border-l lg:first:border-l-0"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
        style={{ background: "var(--accent-tint, #e7f1fb)" }}
      >
        <Icon d={path} size={16} color="var(--accent, #2383e2)" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p
          className="text-[15px] font-semibold leading-none tracking-[-0.2px] tabular-nums"
          style={{ color: "var(--ink)" }}
        >
          {value}
        </p>
        <p className="mt-1 truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

/* ── content mix meter ───────────────────────────────────────── */

function ContentMix({ counts, total }: { counts: Record<MixKey, number>; total: number }) {
  const present = MIX_SERIES.filter((s) => counts[s.key] > 0);
  if (total === 0 || present.length === 0) return null;

  return (
    <figure className="m-0">
      <div className="flex h-[10px] w-full gap-[2px]" role="img" aria-label="Lesson mix by type">
        {present.map((s) => (
          <span
            key={s.key}
            title={`${s.label}: ${counts[s.key]} of ${total} lessons`}
            style={{
              background: s.color,
              flexGrow: counts[s.key],
              flexBasis: 0,
              borderRadius: 999,
              minWidth: 6,
            }}
          />
        ))}
      </div>

      <figcaption className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {present.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[12.5px]">
            <span
              aria-hidden
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
              {s.label}
            </span>
            <span className="tabular-nums font-medium" style={{ color: "var(--ink)" }}>
              {counts[s.key]}
            </span>
            <span className="tabular-nums" style={{ color: "var(--text-tertiary)" }}>
              {Math.round((counts[s.key] / total) * 100)}%
            </span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

/* ── curriculum ──────────────────────────────────────────────── */

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition-transform duration-200"
      style={{
        background: open ? "var(--accent-tint, #e7f1fb)" : "var(--surface-soft, #f7f7f5)",
        transform: open ? "rotate(180deg)" : "none",
      }}
    >
      <Icon size={13} color={open ? "var(--accent, #2383e2)" : "var(--text-tertiary)"} strokeWidth={2}>
        <polyline points="6 9 12 15 18 9" />
      </Icon>
    </span>
  );
}

function ModuleAccordion({
  mod,
  index,
  open,
  onToggle,
}: {
  mod: CatalogModule;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const mins = moduleMinutes(mod);
  const questionCount = moduleQuestions(mod);

  const summary = [
    `${mod.lessons.length} lesson${mod.lessons.length === 1 ? "" : "s"}`,
    mins > 0 ? formatMinutes(mins) : null,
    questionCount > 0 ? `${questionCount} question${questionCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="overflow-hidden rounded-[12px] border transition-all duration-200"
      style={{
        borderColor: open ? "rgba(35,131,226,.38)" : "var(--border)",
        background: "var(--surface)",
        boxShadow: open ? "0 6px 20px -12px rgba(35,131,226,.45)" : "none",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-black/[0.015] sm:px-5"
        style={{ background: "transparent", border: "none" }}
      >
        <span
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[12px] font-bold tabular-nums transition-colors"
          style={{
            background: open ? "var(--accent, #2383e2)" : "var(--surface-soft, #f7f7f5)",
            color: open ? "#fff" : "var(--text-secondary)",
            border: open ? "none" : "1px solid var(--border)",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold leading-snug tracking-[-0.1px]" style={{ color: "var(--ink)" }}>
            {mod.title}
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {summary}
          </p>
        </div>

        <Chevron open={open} />
      </button>

      {open ? (
        <div className="border-t px-4 pb-2 pt-1 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <ol className="relative ml-[14px] border-l pl-5" style={{ borderColor: "var(--border)" }}>
            {mod.lessons.map((lesson, li) => (
              <LessonRow key={lesson.id} lesson={lesson} index={li} moduleIndex={index} />
            ))}
            {mod.lessons.length === 0 ? (
              <li className="py-4 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                No lessons in this module yet.
              </li>
            ) : null}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function LessonRow({
  lesson,
  index,
  moduleIndex,
}: {
  lesson: CatalogLesson;
  index: number;
  moduleIndex: number;
}) {
  const mins = lessonMinutes(lesson);
  const isQuiz = lesson.type === "quiz";

  return (
    <li className="relative border-b py-3.5 last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <span
        className="absolute left-[-25px] top-[17px] flex h-[19px] w-[19px] items-center justify-center rounded-full"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <LessonIcon type={lesson.type} color="var(--text-tertiary)" />
      </span>

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-[11px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
              {moduleIndex + 1}.{index + 1}
            </span>
            <p className="min-w-0 text-[13.5px] font-medium leading-snug" style={{ color: "var(--ink)" }}>
              {lesson.title}
            </p>
          </div>

          {lesson.contentSummary ? (
            <p
              className="mt-1.5 text-[12.5px] leading-[1.6]"
              style={{
                color: "var(--text-secondary)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {formatInlineMarkdown(lesson.contentSummary)}
            </p>
          ) : null}

          {lesson.learningObjectives.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lesson.learningObjectives.slice(0, 3).map((obj) => (
                <span
                  key={obj}
                  className="rounded-[5px] px-2 py-[3px] text-[10.5px] leading-tight"
                  style={{
                    background: "var(--accent-tint-mid, #f4f9fe)",
                    color: "var(--accent, #2383e2)",
                    border: "1px solid rgba(35,131,226,.16)",
                  }}
                >
                  {obj.length > 52 ? `${obj.slice(0, 52)}…` : obj}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-[1px]">
          <span
            className="rounded-full px-2 py-[2px] text-[10.5px] font-medium"
            style={{ background: "var(--surface-soft, #f7f7f5)", color: "var(--text-tertiary)" }}
          >
            {lessonTypeLabel(lesson.type)}
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {isQuiz ? `${lesson.quiz?.questions.length ?? 0} questions` : `${mins} min`}
          </span>
        </div>
      </div>
    </li>
  );
}

/* ── page sequence ───────────────────────────────────────────── */

const MODULES_PER_PAGE = 1;

const SECTIONS = [
  { id: "preview-glance", step: "01", eyebrow: "At a glance", title: "How this program is built" },
  { id: "preview-outcomes", step: "02", eyebrow: "Outcomes", title: "What you'll learn" },
  { id: "preview-curriculum", step: "03", eyebrow: "Curriculum", title: "Course content" },
  { id: "preview-assessment", step: "04", eyebrow: "Assessment", title: "How you'll be assessed" },
  { id: "preview-audience", step: "05", eyebrow: "Before you start", title: "Who this is for" },
] as const;

function SectionHeader({
  step,
  eyebrow,
  title,
  note,
  action,
}: {
  step: string;
  eyebrow: string;
  title: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-[12px] px-5 py-4 sm:px-6"
      style={{
        background: "linear-gradient(135deg, #f0f4ff 0%, #e9f0fb 40%, #f3eefa 100%)",
        border: "1px solid rgba(35,131,226,.12)",
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="mt-[2px] flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold tabular-nums"
            style={{
              background: "var(--accent, #2383e2)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(35,131,226,.25)",
            }}
          >
            {step}
          </span>
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--accent, #2383e2)" }}
            >
              {eyebrow}
            </p>
            <h2 className="mt-0.5 text-[20px] font-bold tracking-[-0.4px]" style={{ color: "var(--ink)" }}>
              {title}
            </h2>
            {note ? (
              <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
                {note}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

/* ── pagination ──────────────────────────────────────────────── */

/** Page numbers to render, collapsing long runs to a single gap marker. */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);

  const wanted = [0, page - 1, page, page + 1, pageCount - 1].filter(
    (p) => p >= 0 && p < pageCount,
  );
  const unique = [...new Set(wanted)].sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  let previous = -1;
  for (const current of unique) {
    if (previous >= 0 && current - previous > 1) out.push("gap");
    out.push(current);
    previous = current;
  }
  return out;
}

function PageStep({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border px-2.5 text-[12.5px] font-medium transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
      style={{
        borderColor: "var(--border-strong)",
        color: "var(--text-secondary)",
        background: "var(--surface)",
      }}
    >
      {children}
    </button>
  );
}

function CurriculumPagination({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Curriculum pagination"
    >
      <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        Showing modules{" "}
        <span className="font-medium tabular-nums" style={{ color: "var(--ink)" }}>
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of{" "}
        <span className="font-medium tabular-nums" style={{ color: "var(--ink)" }}>
          {total}
        </span>
      </p>

      <div className="flex items-center gap-1.5">
        <PageStep label="Previous page" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <Icon size={12} strokeWidth={2}>
            <polyline points="15 18 9 12 15 6" />
          </Icon>
          Prev
        </PageStep>

        <div className="flex items-center gap-0.5 px-0.5">
          {pageWindow(page, pageCount).map((entry, i) =>
            entry === "gap" ? (
              <span
                key={`gap-${i}`}
                aria-hidden
                className="px-1 text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                aria-label={`Page ${entry + 1}`}
                aria-current={entry === page ? "page" : undefined}
                onClick={() => onPageChange(entry)}
                className="inline-flex h-8 min-w-[2rem] cursor-pointer items-center justify-center rounded-[8px] px-2 text-[12.5px] font-medium tabular-nums transition-colors"
                style={
                  entry === page
                    ? { background: "var(--accent, #2383e2)", color: "#fff", border: "none" }
                    : { background: "transparent", color: "var(--text-secondary)", border: "none" }
                }
              >
                {entry + 1}
              </button>
            ),
          )}
        </div>

        <PageStep
          label="Next page"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <Icon size={12} strokeWidth={2}>
            <polyline points="9 18 15 12 9 6" />
          </Icon>
        </PageStep>
      </div>
    </nav>
  );
}

/* ── main preview ────────────────────────────────────────────── */

export function ProgramPreview({
  program,
  requiresApproval,
}: {
  program: CatalogProgramDetail;
  requiresApproval?: boolean;
}) {
  const isDraft = program.status === "draft" || program.status === "pending_approval";

  const [openModules, setOpenModules] = useState<string[]>(() =>
    program.modules[0]?.id ? [program.modules[0].id] : [],
  );
  const [curriculumPage, setCurriculumPage] = useState(0);

  const moduleCount = program.modules.length;
  const pageCount = Math.max(1, Math.ceil(moduleCount / MODULES_PER_PAGE));
  const safePage = Math.min(curriculumPage, pageCount - 1);
  const pageStart = safePage * MODULES_PER_PAGE;
  const visibleModules = program.modules.slice(pageStart, pageStart + MODULES_PER_PAGE);

  // Modules can be deleted in the Builder tab while the preview is mounted.
  useEffect(() => {
    if (curriculumPage > pageCount - 1) setCurriculumPage(Math.max(0, pageCount - 1));
  }, [curriculumPage, pageCount]);

  const flatLessons = useMemo(() => program.modules.flatMap((m) => m.lessons), [program]);
  const objectives = useMemo(() => allObjectives(program), [program]);

  const mixCounts = useMemo(() => {
    const base = { reading: 0, quiz: 0, video: 0, assignment: 0, practice: 0 } as Record<MixKey, number>;
    for (const lesson of flatLessons) base[mixKey(lesson.type)] += 1;
    return base;
  }, [flatLessons]);

  const lessons = countLessons(program);
  const questions = countQuestions(program);
  const minutes = totalMinutes(program);
  const duration = estimatedDuration(program);
  const typeLabel = programTypeLabel(program.type);
  const category = program.category?.trim() || "General";

  const quizCount = mixCounts.quiz;
  const assignmentCount = mixCounts.assignment;
  const passingScore =
    flatLessons.map((l) => l.quiz?.passingScore?.trim()).find((v) => v && v.length > 0) ?? "80";

  const allOpen =
    visibleModules.length > 0 && visibleModules.every((m) => openModules.includes(m.id));

  function toggleModule(id: string) {
    setOpenModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  function toggleAll() {
    const ids = visibleModules.map((m) => m.id);
    setOpenModules((prev) =>
      allOpen ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])],
    );
  }

  function goToPage(next: number) {
    const clamped = Math.max(0, Math.min(next, pageCount - 1));
    setCurriculumPage(clamped);
    const firstOnPage = program.modules[clamped * MODULES_PER_PAGE];
    if (firstOnPage) {
      setOpenModules((prev) => (prev.includes(firstOnPage.id) ? prev : [...prev, firstOnPage.id]));
    }
    jumpTo(SECTIONS[2].id);
  }

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const heroMeta = [
    category,
    "Self-paced",
    `${program.modules.length} module${program.modules.length === 1 ? "" : "s"}`,
    formatMinutes(minutes),
  ];

  return (
    <div className="min-h-full" style={{ background: "var(--canvas, #f1f1ef)" }}>
      {/* Preview-mode ribbon */}
      <div
        className="flex items-center justify-center gap-2 px-4 py-2 text-[12px]"
        style={{
          background: isDraft ? "var(--warning-bg, #fdf7ee)" : "var(--surface-soft, #f7f7f5)",
          borderBottom: `1px solid ${isDraft ? "var(--warning-border, #f2e2ca)" : "var(--border)"}`,
          color: isDraft ? "var(--warning-fg, #7a5a2e)" : "var(--text-secondary)",
        }}
      >
        <Icon d={PATH.eye} size={14} strokeWidth={1.6} />
        <span>
          <strong className="font-semibold">Learner preview</strong>
          {isDraft
            ? " — this is how the course page will look once published. Only you and assigned instructors can see it."
            : " — this is the live course page learners see."}
        </span>
      </div>

      <ProgramHero program={program} typeLabel={typeLabel} isDraft={isDraft} metaItems={heroMeta} />

      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        {/* Floating stat strip */}
        <div
          className="relative z-10 -mt-7 grid grid-cols-2 overflow-hidden rounded-[14px] border sm:grid-cols-3 lg:grid-cols-5"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            boxShadow: "0 12px 32px -20px rgba(15,15,15,.35)",
          }}
        >
          <StatCell path={PATH.modules} value={String(program.modules.length)} label="Modules" />
          <StatCell path={PATH.lessons} value={String(lessons)} label="Lessons" />
          <StatCell path={PATH.question} value={String(questions)} label="Assessment questions" />
          <StatCell path={PATH.clock} value={formatMinutes(minutes)} label="Learning time" />
          <StatCell path={PATH.calendar} value={duration} label="Suggested pace" />
        </div>

        <div className="grid gap-10 pb-16 pt-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
          {/* ── main column ── */}
          <div className="min-w-0 space-y-12">
            {/* 01 · At a glance */}
            <section id={SECTIONS[0].id} className="scroll-mt-6">
              <SectionHeader
                step={SECTIONS[0].step}
                eyebrow={SECTIONS[0].eyebrow}
                title={SECTIONS[0].title}
                note={`${lessons} lesson${lessons === 1 ? "" : "s"} across ${program.modules.length} module${program.modules.length === 1 ? "" : "s"}, mixed by format.`}
              />
              <div
                className="mt-5 rounded-[12px] border px-5 py-5"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <ContentMix counts={mixCounts} total={lessons} />
              </div>
            </section>

            {/* 02 · Outcomes */}
            {objectives.length > 0 ? (
              <section id={SECTIONS[1].id} className="scroll-mt-6">
                <SectionHeader
                  step={SECTIONS[1].step}
                  eyebrow={SECTIONS[1].eyebrow}
                  title={SECTIONS[1].title}
                  note={`${objectives.length} objective${objectives.length === 1 ? "" : "s"} drawn from the lesson plan.`}
                />
                <div
                  className="mt-5 grid gap-px overflow-hidden rounded-[12px] border sm:grid-cols-2"
                  style={{ borderColor: "var(--border)", background: "var(--border)" }}
                >
                  {objectives.map((obj) => (
                    <div
                      key={obj}
                      className="flex items-start gap-3 px-5 py-4"
                      style={{ background: "var(--surface)" }}
                    >
                      <span
                        className="mt-[1px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full"
                        style={{ background: "var(--success-fg, #1c7a52)" }}
                      >
                        <Icon size={11} color="#fff" strokeWidth={3}>
                          <polyline points="20 6 9 17 4 12" />
                        </Icon>
                      </span>
                      <p className="text-[13.5px] leading-[1.55]" style={{ color: "var(--ink)" }}>
                        {formatInlineMarkdown(obj)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* 03 · Curriculum */}
            <section id={SECTIONS[2].id} className="scroll-mt-6">
              <SectionHeader
                step={SECTIONS[2].step}
                eyebrow={SECTIONS[2].eyebrow}
                title={SECTIONS[2].title}
                note={`${program.modules.length} module${program.modules.length === 1 ? "" : "s"} · ${lessons} lesson${lessons === 1 ? "" : "s"} · ${formatMinutes(minutes)}`}
                action={
                  visibleModules.length > 1 ? (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="cursor-pointer rounded-[6px] px-2 py-1 text-[12.5px] font-medium transition-colors hover:bg-black/[0.04]"
                      style={{ background: "transparent", border: "none", color: "var(--accent, #2383e2)" }}
                    >
                      {allOpen ? "Collapse all" : "Expand all"}
                    </button>
                  ) : null
                }
              />

              {moduleCount > MODULES_PER_PAGE ? (
                <CurriculumPagination
                  page={safePage}
                  pageCount={pageCount}
                  rangeStart={pageStart + 1}
                  rangeEnd={pageStart + visibleModules.length}
                  total={moduleCount}
                  onPageChange={goToPage}
                />
              ) : null}

              <div className="mt-5 space-y-2.5">
                {visibleModules.map((mod, i) => (
                  <ModuleAccordion
                    key={mod.id}
                    mod={mod}
                    index={pageStart + i}
                    open={openModules.includes(mod.id)}
                    onToggle={() => toggleModule(mod.id)}
                  />
                ))}
                {program.modules.length === 0 ? (
                  <div
                    className="rounded-[12px] border border-dashed px-5 py-8 text-center text-[13px]"
                    style={{ borderColor: "var(--border-dashed, #e3e3e0)", color: "var(--text-tertiary)" }}
                  >
                    No modules yet. Add modules in the Builder tab to see the curriculum here.
                  </div>
                ) : null}
              </div>
            </section>

            {/* 04 · Assessment */}
            {questions > 0 || assignmentCount > 0 ? (
              <section id={SECTIONS[3].id} className="scroll-mt-6">
                <SectionHeader
                  step={SECTIONS[3].step}
                  eyebrow={SECTIONS[3].eyebrow}
                  title={SECTIONS[3].title}
                  note="Checks are spread through the course rather than saved for the end."
                />
                <div
                  className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
                >
                  <MiniStat icon={PATH.question} value={String(quizCount)} label="Knowledge checks" accent="#2383e2" />
                  <MiniStat icon={PATH.lessons} value={String(questions)} label="Total questions" accent="#8b4fc0" />
                  <MiniStat icon={PATH.award} value={`${passingScore}%`} label="Pass mark" accent="#1c7a52" />
                  <MiniStat icon={PATH.target} value={String(assignmentCount)} label="Assignments" accent="#b06b12" />
                </div>
                <div
                  className="mt-4 flex items-start gap-3 rounded-[10px] px-4 py-3.5"
                  style={{ background: "var(--surface-soft, #f7f7f5)", border: "1px solid var(--border)" }}
                >
                  <Icon d={PATH.award} size={15} color="var(--text-tertiary)" strokeWidth={1.6} />
                  <p className="text-[12.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
                    Every knowledge check can be retaken. A <strong style={{ color: "var(--ink)" }}>certificate of completion</strong> is
                    issued once the final module is finished.
                  </p>
                </div>
              </section>
            ) : null}

            {/* 05 · Who this is for */}
            <section id={SECTIONS[4].id} className="scroll-mt-6">
              <SectionHeader
                step={SECTIONS[4].step}
                eyebrow={SECTIONS[4].eyebrow}
                title={SECTIONS[4].title}
              />
              <p className="mt-4 text-[14px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
                This program sits in the <strong style={{ color: "var(--ink)" }}>{category}</strong> track and is
                designed for practising professionals.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <AudienceCard icon={PATH.users} title="For professionals" text="Looking to deepen their expertise with structured learning" />
                <AudienceCard icon={PATH.target} title="Evidence-based" text="Curriculum built around practical, real-world application" />
                <AudienceCard icon={PATH.layers} title="Recommended background" text="Foundational familiarity with the subject area" />
                <AudienceCard icon={PATH.clock} title="Self-paced" text={`Complete in ${duration} or go at your own speed`} />
              </div>
            </section>

            {/* Closing CTA band */}
            <div
              className="relative isolate overflow-hidden rounded-[16px] px-7 py-8 sm:px-10 sm:py-10"
              style={{ background: HERO_FALLBACK }}
            >
              <div
                className="absolute inset-0 opacity-[0.10]"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(255,255,255,.5) 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
              <div className="relative text-center sm:text-left">
                <p className="text-[20px] font-bold tracking-[-0.4px] sm:text-[22px]" style={{ color: "#fff" }}>
                  {isDraft
                    ? requiresApproval
                      ? "Ready to submit this program?"
                      : "Ready to publish this program?"
                    : "Start whenever you're ready"}
                </p>
                <p className="mx-auto mt-2 max-w-[480px] text-[13.5px] leading-[1.6] sm:mx-0" style={{ color: "rgba(255,255,255,.72)" }}>
                  {isDraft
                    ? requiresApproval
                      ? "An Academy Admin must approve it before you or they can publish it to Explore."
                      : "Publishing makes this page visible in Explore and opens enrollment for all learners."
                    : `${lessons} lessons · ${formatMinutes(minutes)} of learning · certificate on completion`}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
                  <Button variant="primary" className="!px-6 !py-2.5 !text-[14px] !font-semibold" disabled={isDraft}>
                    {isDraft ? "Enroll — preview only" : "Enroll now"}
                  </Button>
                  <button
                    type="button"
                    className="rounded-[8px] px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-white/[0.12]"
                    style={{ color: "rgba(255,255,255,.85)", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)" }}
                    onClick={() => jumpTo(SECTIONS[0].id)}
                  >
                    Back to top
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── sticky aside ── */}
          <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
            <div
              className="overflow-hidden rounded-[14px] border"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
                boxShadow: "0 10px 30px -22px rgba(15,15,15,.4)",
              }}
            >
              <div className="px-5 pb-4 pt-5">
                <p
                  className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Enrollment
                </p>
                <p className="mt-1.5 text-[19px] font-semibold tracking-[-0.3px]" style={{ color: "var(--ink)" }}>
                  {isDraft ? "Not yet available" : "Open to learners"}
                </p>

                <Button variant="primary" className="mt-4 w-full !py-2.5 !text-[14px] !font-semibold" disabled={isDraft}>
                  {isDraft ? "Enroll — preview only" : "Enroll now"}
                </Button>

                <p
                  className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[11.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <Icon d={isDraft ? PATH.lock : PATH.eye} size={12} strokeWidth={1.6} />
                  {isDraft ? "Enrollment unlocks on publish" : "Learners enroll from Explore"}
                </p>
              </div>

              <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
                <p
                  className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  This program includes
                </p>
                <ul className="mt-3 space-y-2.5">
                  <Include path={PATH.modules}>
                    {program.modules.length} module{program.modules.length === 1 ? "" : "s"}
                  </Include>
                  <Include path={PATH.lessons}>
                    {lessons} lesson{lessons === 1 ? "" : "s"}
                  </Include>
                  {questions > 0 ? <Include path={PATH.question}>{questions} assessment questions</Include> : null}
                  <Include path={PATH.clock}>{formatMinutes(minutes)} of learning</Include>
                  <Include path={PATH.infinity}>Lifetime access</Include>
                  <Include path={PATH.award}>Certificate of completion</Include>
                </ul>
              </div>

              <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
                <MetaRow label="Format" value="Self-paced" />
                <MetaRow label="Category" value={category} />
                <MetaRow label="Suggested pace" value={duration} />
                {program.enrollmentCount > 0 ? (
                  <MetaRow label="Enrolled" value={String(program.enrollmentCount)} />
                ) : null}
              </div>
            </div>

            {/* On this page */}
            <nav
              className="rounded-[14px] border px-5 py-4"
              style={{ borderColor: "var(--border)", background: "var(--surface-subtle, #fbfbfa)" }}
              aria-label="On this page"
            >
              <p
                className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                On this page
              </p>
              <ol className="mt-2.5 space-y-0.5">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => jumpTo(section.id)}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[6px] px-1.5 py-[5px] text-left text-[13px] transition-colors hover:bg-black/[0.035]"
                      style={{ background: "transparent", border: "none", color: "var(--text-secondary)" }}
                    >
                      <span
                        className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold tabular-nums"
                        style={{ background: "var(--accent-tint-soft, #e7f1fb)", color: "var(--accent, #2383e2)" }}
                      >
                        {section.step}
                      </span>
                      <span className="min-w-0 truncate">{section.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            {program.enrollmentCount > 0 ? (
              <div
                className="flex items-center gap-2.5 rounded-[14px] border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface-subtle, #fbfbfa)" }}
              >
                <Icon d={PATH.users} size={15} color="var(--text-tertiary)" strokeWidth={1.7} />
                <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--ink)" }}>{program.enrollmentCount}</strong> learner
                  {program.enrollmentCount === 1 ? " is" : "s are"} enrolled
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ── small shared pieces ─────────────────────────────────────── */

function MiniStat({ icon, value, label, accent }: { icon: string; value: string; label: string; accent: string }) {
  return (
    <div
      className="rounded-[12px] border px-4 py-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <span
        className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]"
        style={{ background: `${accent}14` }}
      >
        <Icon d={icon} size={15} color={accent} strokeWidth={1.8} />
      </span>
      <p className="mt-3 text-[24px] font-bold leading-none tracking-[-0.5px] tabular-nums" style={{ color: "var(--ink)" }}>
        {value}
      </p>
      <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
    </div>
  );
}

function AudienceCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div
      className="flex items-start gap-3 rounded-[12px] px-4 py-4"
      style={{ background: "rgba(255,255,255,.72)", border: "1px solid rgba(35,131,226,.10)" }}
    >
      <span
        className="mt-[1px] flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px]"
        style={{ background: "var(--accent, #2383e2)" }}
      >
        <Icon d={icon} size={14} color="#fff" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>{text}</p>
      </div>
    </div>
  );
}

function Include({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
      <Icon d={path} size={14} color="var(--text-tertiary)" strokeWidth={1.7} />
      <span>{children}</span>
    </li>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
      style={{
        background: "var(--surface-soft, #f7f7f5)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span className="text-right font-medium" style={{ color: "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

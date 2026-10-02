"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import {
  countLessons,
  countQuestions,
  estimatedDuration,
  formatMinutes,
  lessonMinutes,
  programQuality,
  totalMinutes,
} from "../lib/programStats";
import { programTypeLabel } from "@/academy/lib/domain";
import {
  ProgramCoverBanner,
  ProgramCoverCameraButton,
  useProgramCover,
} from "./ProgramCoverImage";
import { formatInlineMarkdownFragment } from "../lib/formatInlineMarkdown";
import { catalogAdminStatusLabel } from "@/academy/admin/lib/programDeletion";
import { cn } from "@/base/lib/cn";
import type { CatalogModule, CatalogProgramDetail } from "../types";

const MODULES_PER_PAGE = 1;

const LESSON_TYPE_LABELS: Record<string, string> = {
  reading: "Reading",
  video: "Video",
  quiz: "Quiz",
  assignment: "Assignment",
  scenario: "Scenario",
  resource: "Resource",
  attachment: "Attachment",
};

export function OverviewPane({
  program,
  busy,
  onPatch,
  onCoverPersist,
  onImprove,
  onSettings,
  compact = false,
}: {
  program: CatalogProgramDetail;
  busy?: boolean;
  onPatch: (patch: Partial<CatalogProgramDetail>) => void;
  onCoverPersist?: (coverImageUrl: string) => Promise<{ ok: boolean; message?: string }>;
  onImprove?: () => void;
  onSettings: () => void;
  compact?: boolean;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [curriculumPage, setCurriculumPage] = useState(0);

  const quality = useMemo(() => programQuality(program), [program]);
  const unresolved = quality.issues.length;
  const statusLabel = catalogAdminStatusLabel(program.status, program.enrollmentCount);
  const statusTone =
    program.status === "published" ? "success" : program.status === "pending_approval" ? "warning" : "neutral";

  const stats = [
    { label: "Modules", value: String(program.modules.length) },
    { label: "Lessons", value: String(countLessons(program)) },
    { label: "Questions", value: String(countQuestions(program)) },
    { label: "Learning time", value: formatMinutes(totalMinutes(program)) },
  ];

  const dimensions = [
    { label: "Structure", ...quality.dimensions.structure },
    { label: "Content depth", ...quality.dimensions.content },
    { label: "Objectives", ...quality.dimensions.objectiveAlignment },
    { label: "Assessment", ...quality.dimensions.assessment },
  ];

  const kindBadges = programKindBadges(program);
  const durationLabel = estimatedDuration(program);
  const learningTime = formatMinutes(totalMinutes(program));
  const moduleCount = program.modules.length;
  const lessonTotal = countLessons(program);

  const pageCount = Math.max(1, Math.ceil(moduleCount / MODULES_PER_PAGE));
  const safePage = Math.min(curriculumPage, pageCount - 1);
  const pageStart = safePage * MODULES_PER_PAGE;
  const visibleModules = program.modules.slice(pageStart, pageStart + MODULES_PER_PAGE);

  useEffect(() => {
    if (curriculumPage > pageCount - 1) setCurriculumPage(Math.max(0, pageCount - 1));
  }, [curriculumPage, pageCount]);

  useEffect(() => {
    const next = collapseSoftBreaks(program.description);
    if (next !== program.description) onPatch({ description: next });
  }, [program.id, program.description, onPatch]);

  const cover = useProgramCover({
    programId: program.id,
    coverImageUrl: program.coverImageUrl,
    disabled: busy,
    onChange: (coverImageUrl) => onPatch({ coverImageUrl }),
    onPersist: onCoverPersist,
  });

  return (
    <div className="w-full min-w-0 overflow-x-hidden" style={{ background: "var(--canvas)" }}>
      <section
        className="min-w-0 overflow-hidden border-b"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        <ProgramCoverBanner {...cover} onRemove={cover.remove} />

        <div className={cn("mx-auto min-w-0 max-w-[960px] px-4 py-5", !compact && "sm:px-6 sm:py-7")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={statusTone as "success" | "warning" | "neutral"}>{statusLabel}</Pill>
            {kindBadges.map((badge) => (
              <MetaChip key={badge.label} accent={badge.variant === "accent"}>
                {badge.label}
              </MetaChip>
            ))}
            <MetaChip>{durationLabel}</MetaChip>
            <MetaChip>{learningTime} learning</MetaChip>
            {program.enrollmentCount > 0 ? (
              <MetaChip>{program.enrollmentCount.toLocaleString()} enrolled</MetaChip>
            ) : null}
          </div>

          <div className="mt-5 flex items-start gap-3">
            <AutoGrowTextarea
              value={program.name}
              disabled={busy}
              onChange={(value) => onPatch({ name: value })}
              placeholder="Course title"
              minRows={1}
              className={cn(
                "min-w-0 flex-1 font-semibold leading-[1.15] tracking-[-0.04em] text-pretty",
                compact ? "text-[22px]" : "text-[22px] sm:text-[28px]",
              )}
              style={{ color: "var(--ink)" }}
            />
            {!cover.src ? <ProgramCoverCameraButton {...cover} className="mt-1.5 shrink-0" /> : null}
          </div>

          <AutoGrowTextarea
            value={collapseSoftBreaks(program.description)}
            disabled={busy}
            onChange={(value) => onPatch({ description: value })}
            placeholder="Write a clear summary — what learners will be able to do after finishing."
            className="mt-3.5 max-w-[70ch] text-justify text-[15px] leading-[1.5]"
            style={{ color: "var(--text-secondary)" }}
          />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {onImprove ? (
              <Button
                variant="primary"
                className="!px-3.5 !py-2 !text-[13px]"
                disabled={busy}
                onClick={onImprove}
              >
                Improve with Whitby
              </Button>
            ) : null}
            <Button
              variant="secondary"
              className="!px-3.5 !py-2 !text-[13px]"
              disabled={busy}
              onClick={onSettings}
            >
              Program settings
            </Button>
          </div>

          {cover.error ? (
            <p className="mt-3 text-[12px]" style={{ color: "#c4554d" }}>
              {cover.error}
            </p>
          ) : null}

          <div
            className={cn(
              "mt-6 grid gap-px overflow-hidden rounded-[12px]",
              compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
            )}
            style={{
              border: "1px solid var(--border)",
              background: "var(--border)",
              boxShadow: "0 1px 2px rgba(15,15,15,.03)",
            }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className={cn("min-w-0 bg-surface px-3 py-3", !compact && "sm:px-4 sm:py-4")}>
                <p
                  className="truncate text-[10.5px] font-semibold uppercase tracking-[0.07em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {stat.label}
                </p>
                <p
                  className={cn(
                    "mt-1.5 truncate font-semibold leading-none tracking-[-0.04em] tabular-nums",
                    compact ? "text-[18px]" : "text-[18px] sm:text-[22px]",
                  )}
                  style={{ color: "var(--ink)" }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {cover.cropDialog}

      <div
        id="curriculum-section"
        className={cn(
          "mx-auto min-w-0 max-w-[960px] scroll-mt-6 px-4 py-6",
          !compact && "sm:px-6 sm:py-8",
        )}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold tracking-[-0.025em]" style={{ color: "var(--ink)" }}>
                  Curriculum
                </h2>
                <p
                  className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-snug"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {moduleCount === 0 ? (
                    <span>Add modules from the sidebar to start building.</span>
                  ) : (
                    <>
                      <span className="whitespace-nowrap">
                        {moduleCount} module{moduleCount === 1 ? "" : "s"}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="whitespace-nowrap">
                        {lessonTotal} lesson{lessonTotal === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </p>
              </div>

              {moduleCount > MODULES_PER_PAGE ? (
                <div className="min-w-0 max-w-full overflow-x-auto">
                  <CurriculumPagination
                    page={safePage}
                    pageCount={pageCount}
                    onPageChange={setCurriculumPage}
                  />
                </div>
              ) : null}
            </div>

            <div className="min-w-0">
              {moduleCount === 0 ? (
                <div
                  className="rounded-[12px] border border-dashed px-6 py-14 text-center"
                  style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
                >
                  <p className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>
                    No modules yet
                  </p>
                  <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                    Add a module from the course overview sidebar.
                  </p>
                </div>
              ) : (
                <ol className="space-y-3">
                  {visibleModules.map((module, index) => (
                    <CurriculumModuleCard
                      key={module.id}
                      module={module}
                      moduleNumber={pageStart + index + 1}
                    />
                  ))}
                </ol>
              )}
            </div>
          </div>

          <aside className="min-w-0 w-full space-y-3">
            <div
              className="overflow-hidden rounded-[12px] border"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
                boxShadow: "0 1px 2px rgba(15,15,15,.03)",
              }}
            >
              <div className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <ScoreRing value={quality.overall} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold tracking-[-0.015em]" style={{ color: "var(--ink)" }}>
                      Course quality
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
                      {unresolved
                        ? `${unresolved} issue${unresolved === 1 ? "" : "s"} to review`
                        : "Ready for a final polish"}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "grid gap-x-8 gap-y-3.5 border-t px-4 py-4",
                  !compact && "sm:grid-cols-2",
                )}
                style={{ borderColor: "var(--border)" }}
              >
                {dimensions.map((dimension) => (
                  <div key={dimension.label}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                        {dimension.label}
                      </span>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                        {Math.round(dimension.score)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${dimension.score}%`,
                          background:
                            dimension.score >= 88
                              ? "#1c7a52"
                              : dimension.score >= 72
                                ? "var(--accent)"
                                : "#8a6229",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setNotesOpen((value) => !value)}
                className="flex w-full cursor-pointer items-center justify-between border-t px-4 py-2.5 text-left text-[12px] font-medium"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--surface-subtle)",
                }}
              >
                <span>Reviewer notes</span>
                <span aria-hidden>{notesOpen ? "▴" : "▾"}</span>
              </button>

              {notesOpen ? (
                <div className="space-y-3 border-t px-4 py-3.5" style={{ borderColor: "var(--border)" }}>
                  {quality.strengths.length > 0 ? (
                    <div>
                      <p
                        className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: "var(--success-fg, #1c7a52)" }}
                      >
                        Strengths
                      </p>
                      <ul className="space-y-2">
                        {quality.strengths.map((strength) => (
                          <li
                            key={strength}
                            className="rounded-[8px] px-3 py-2.5 text-[13px] leading-relaxed"
                            style={{ background: "var(--success-bg, #d6ecd8)", color: "var(--ink)" }}
                          >
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {quality.issues.length > 0 ? (
                    <div>
                      <p
                        className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: "#8a6229" }}
                      >
                        To improve
                      </p>
                      <ul className="space-y-2">
                        {quality.issues.map((issue) => (
                          <li
                            key={`${issue.area}-${issue.detail}`}
                            className="rounded-[8px] px-3 py-2.5"
                            style={{
                              background:
                                issue.severity === "minor" ? "var(--surface-soft)" : "var(--warning-bg, #fdf7ee)",
                            }}
                          >
                            <p
                              className="text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                              style={{ color: issue.severity === "minor" ? "var(--text-tertiary)" : "#8a6229" }}
                            >
                              {issue.severity} · {issue.area}
                            </p>
                            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ink)" }}>
                              {issue.detail}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {quality.strengths.length === 0 && quality.issues.length === 0 ? (
                    <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                      No reviewer notes yet.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {onImprove ? (
              <div
                className="rounded-[12px] border px-4 py-3.5"
                style={{
                  borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border))",
                  background: "var(--accent-tint-soft)",
                }}
              >
                <p className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                  Tip
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
                  Use Whitby to rewrite thin lessons, add quiz questions, or reshape the outline — then review here.
                </p>
              </div>
            ) : (
              <div
                className="rounded-[12px] border px-4 py-3.5"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                }}
              >
                <p className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
                  Publishing
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
                  Instructors submit for Admin approval. After approval, publish to Explore.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

    </div>
  );
}

function MetaChip({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
      style={
        accent
          ? { background: "var(--accent-tint)", color: "var(--accent)" }
          : {
              background: "var(--surface-soft)",
              color: "var(--text-secondary)",
              boxShadow: "inset 0 0 0 1px var(--border)",
            }
      }
    >
      {children}
    </span>
  );
}

function programKindBadges(program: CatalogProgramDetail) {
  const typeLabel = programTypeLabel(program.type);
  const category = program.category?.trim() ?? "";

  if (!typeLabel && !category) return [];

  // Prefer program type as the source of truth; show category only when it differs.
  if (!category || normalizeLabel(category) === normalizeLabel(typeLabel)) {
    return typeLabel ? [{ label: typeLabel, variant: "accent" as const }] : [];
  }

  return [
    { label: typeLabel || category, variant: "accent" as const },
    ...(typeLabel && category ? [{ label: category, variant: "outline" as const }] : []),
  ].filter((badge) => Boolean(badge.label));
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);

  const wanted = [0, page - 1, page, page + 1, pageCount - 1].filter((p) => p >= 0 && p < pageCount);
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

function CurriculumPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-[10px] border p-1"
      aria-label="Curriculum pagination"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04)",
      }}
    >
      <button
        type="button"
        aria-label="Previous module"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[7px] text-[14px] transition-colors hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-30"
        style={{ color: "var(--text-secondary)", border: "none", background: "transparent" }}
      >
        ‹
      </button>

      <div className="flex items-center gap-0.5 px-0.5">
        {pageWindow(page, pageCount).map((entry, i) =>
          entry === "gap" ? (
            <span
              key={`gap-${i}`}
              aria-hidden
              className="px-1 text-[12px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              aria-label={`Module ${entry + 1}`}
              aria-current={entry === page ? "page" : undefined}
              onClick={() => onPageChange(entry)}
              className="inline-flex h-8 min-w-[2rem] cursor-pointer items-center justify-center rounded-[7px] px-2 text-[12.5px] font-semibold tabular-nums transition-colors"
              style={
                entry === page
                  ? {
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      boxShadow: "0 4px 10px color-mix(in srgb, var(--accent) 28%, transparent)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--text-secondary)",
                      border: "none",
                    }
              }
            >
              {entry + 1}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        aria-label="Next module"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[7px] text-[14px] transition-colors hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-30"
        style={{ color: "var(--text-secondary)", border: "none", background: "transparent" }}
      >
        ›
      </button>
    </nav>
  );
}

function CurriculumModuleCard({ module, moduleNumber }: { module: CatalogModule; moduleNumber: number }) {
  const quizCount = module.lessons.reduce((sum, lesson) => sum + (lesson.quiz?.questions.length ?? 0), 0);
  const moduleMinutes = module.lessons.reduce((sum, lesson) => sum + lessonMinutes(lesson), 0);

  return (
    <li
      className="overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(15,15,15,.03)",
      }}
    >
      <div
        className="flex items-start gap-3.5 border-b px-4 py-4 sm:px-5"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(180deg, var(--surface-subtle) 0%, var(--surface) 100%)",
        }}
      >
        <span
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-semibold tabular-nums leading-none"
          style={{
            background: "var(--accent)",
            color: "#fff",
          }}
        >
          {moduleNumber}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[15px] font-semibold leading-snug tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
            {module.title}
          </p>
          <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
            {quizCount > 0 ? ` · ${quizCount} questions` : ""}
            {" · "}
            {formatMinutes(moduleMinutes)}
          </p>
        </div>
      </div>

      {module.lessons.length > 0 ? (
        <ul>
          {module.lessons.map((lesson, lessonIndex) => (
            <li
              key={lesson.id}
              className="flex items-center gap-3 border-t px-4 py-3.5 sm:px-5"
              style={{ borderColor: "var(--border)" }}
            >
              <span
                className="w-6 shrink-0 text-center text-[12px] font-semibold tabular-nums"
                style={{ color: "var(--text-tertiary)" }}
              >
                {lessonIndex + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-[13.5px] font-medium leading-snug" style={{ color: "var(--ink)" }}>
                    {lesson.title}
                  </p>
                  <LessonTypeBadge type={lesson.type} />
                </div>
                {lesson.contentSummary ? (
                  <p
                    className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.55] text-pretty text-justify"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatInlineMarkdownFragment(lesson.contentSummary)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--text-tertiary)" }}>
          No lessons yet — add one from the module tree.
        </p>
      )}
    </li>
  );
}

/** AI / paste often embeds soft wraps as `\n` — those look like huge line gaps in a textarea. */
function collapseSoftBreaks(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n\n/)
    .map((para) => para.replace(/\n/g, " ").replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  minRows = 1,
  className,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) resize();
    };
    run();
    const raf = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    void (typeof document !== "undefined" && document.fonts?.ready
      ? document.fonts.ready.then(run).catch(() => undefined)
      : undefined);
    const parent = ref.current?.parentElement;
    const ro =
      typeof ResizeObserver !== "undefined" && parent
        ? new ResizeObserver(() => run())
        : null;
    if (parent && ro) ro.observe(parent);
    window.addEventListener("resize", run);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", run);
    };
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      rows={minRows}
      onChange={(event) => {
        onChange(event.target.value);
        requestAnimationFrame(resize);
      }}
      className={`m-0 block w-full min-w-0 max-w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none ${className ?? ""}`}
      style={{
        ...style,
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        fieldSizing: "fixed",
      }}
    />
  );
}

function LessonTypeBadge({ type }: { type: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
      style={{
        background: "var(--surface-soft)",
        color: "var(--text-tertiary)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      {LESSON_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function ScoreRing({ value }: { value: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  const color = value >= 88 ? "#1c7a52" : value >= 72 ? "var(--accent)" : "#8a6229";

  return (
    <div className="relative flex size-[48px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 48 48" className="size-[48px] -rotate-90">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="var(--border)" strokeWidth="3.5" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute text-[14px] font-semibold tabular-nums tracking-[-0.02em]"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

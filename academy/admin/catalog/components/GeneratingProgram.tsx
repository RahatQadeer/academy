"use client";

import { useEffect, useState } from "react";
import { Button } from "@/base/components/Button";
import {
  CATALOG_STAGES,
  overallStageProgress,
  type CatalogSkeletonModule,
  type CatalogStageId,
} from "@/academy/admin/catalog/lib/stages";

type StageState = {
  status: "pending" | "active" | "done" | "failed";
  detail?: string;
  progress?: number;
};

export function GeneratingProgram({
  programName,
  stages,
  skeleton,
  error,
  completed,
  onCancel,
  onRetry,
  onOpenBuilder,
  onOpenPreview,
}: {
  programName: string;
  stages: Record<CatalogStageId, StageState>;
  skeleton: { programName: string; modules: CatalogSkeletonModule[] } | null;
  error: string | null;
  completed?: { programId: string; programName: string } | null;
  onCancel?: () => void;
  onRetry?: () => void;
  onOpenBuilder?: () => void;
  onOpenPreview?: () => void;
}) {
  const percent = completed ? 100 : overallStageProgress(stages);
  const doneCount = completed
    ? CATALOG_STAGES.length
    : CATALOG_STAGES.filter((stage) => stages[stage.id].status === "done").length;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (error || completed) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [completed, error]);

  return (
    <div className="flex flex-col bg-canvas px-6 py-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div
          className="rounded-[10px] border p-6"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1
                className="truncate text-[19px] font-semibold tracking-[-0.02em]"
                style={{ color: "var(--ink)" }}
              >
                {error
                  ? "Generation stopped"
                  : completed
                    ? "Your course is ready"
                    : "Creating your course…"}
              </h1>
              <p className="mt-1 truncate text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
                {programName}
              </p>
            </div>
            {!error && !completed ? (
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[12px] tabular-nums"
                style={{ background: "var(--surface-soft)", color: "var(--text-tertiary)" }}
              >
                {formatElapsed(elapsed)}
              </span>
            ) : null}
          </div>

          <div className="mb-6 space-y-2">
            <div className="h-[6px] overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, percent)}%`,
                  background: error ? "#c4554d" : "var(--accent, #2383e2)",
                }}
              />
            </div>
            <div className="flex justify-between text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              <span>{Math.round(percent)}% complete</span>
              <span>
                {doneCount} of {CATALOG_STAGES.length} stages
              </span>
            </div>
          </div>

          <ol className="space-y-0.5">
            {CATALOG_STAGES.map((stage) => {
              const state = stages[stage.id];
              const status =
                completed && state.status !== "failed"
                  ? "done"
                  : state.status;
              const detail =
                completed && stage.id === "quality" && status === "done"
                  ? state.detail || "Saved"
                  : state.detail;
              return (
                <li
                  key={stage.id}
                  className="flex items-start gap-3 rounded-[6px] px-2.5 py-2 transition-colors"
                  style={{
                    background: status === "active" ? "var(--accent-tint-soft, #e7f1fb)" : "transparent",
                  }}
                >
                  <StageIcon status={status} />
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[13.5px]"
                      style={{
                        color:
                          status === "pending"
                            ? "var(--text-tertiary)"
                            : status === "active"
                              ? "var(--accent, #2383e2)"
                              : status === "failed"
                                ? "#c4554d"
                                : "var(--ink)",
                        fontWeight: status === "active" ? 500 : 400,
                      }}
                    >
                      {stage.label}
                    </p>
                    {detail ? (
                      <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        {detail}
                      </p>
                    ) : null}
                    {status === "active" && state.progress !== undefined && state.progress > 0 ? (
                      <div
                        className="mt-1.5 h-1 overflow-hidden rounded-full"
                        style={{ background: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${state.progress * 100}%`,
                            background: "var(--accent, #2383e2)",
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>

          {error ? (
            <div className="mt-5 space-y-3">
              <div
                className="flex gap-2.5 rounded-[8px] border p-3"
                style={{ borderColor: "#f2c4bf", background: "#ffe2dd" }}
              >
                <span className="mt-0.5 shrink-0 text-[#c4554d]">!</span>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink)" }}>
                  {error}
                </p>
              </div>
              <div className="flex gap-2">
                {onRetry ? (
                  <Button variant="primary" className="!px-3 !py-1.5 !text-[13px]" onClick={onRetry}>
                    Try again
                  </Button>
                ) : null}
                {onCancel ? (
                  <Button variant="ghost" className="!px-3 !py-1.5 !text-[13px]" onClick={onCancel}>
                    Back to Catalog
                  </Button>
                ) : null}
              </div>
            </div>
          ) : completed ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="primary" className="!px-3 !py-1.5 !text-[13px]" onClick={onOpenBuilder}>
                Open Course Builder
              </Button>
              <Button variant="secondary" className="!px-3 !py-1.5 !text-[13px]" onClick={onOpenPreview}>
                Preview
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="mt-5 !px-3 !py-1.5 !text-[13px]" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        <CurriculumPreview skeleton={skeleton} stages={stages} />
      </div>
    </div>
  );
}

function CurriculumPreview({
  skeleton,
  stages,
}: {
  skeleton: { programName: string; modules: CatalogSkeletonModule[] } | null;
  stages: Record<CatalogStageId, StageState>;
}) {
  if (!skeleton) {
    return (
      <div
        className="rounded-[10px] border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <p
          className="mb-4 text-[11px] font-semibold uppercase tracking-[0.09em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Curriculum
        </p>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div
                className="h-3.5 animate-pulse rounded"
                style={{
                  width: `${55 + ((index * 13) % 35)}%`,
                  background: "var(--border)",
                }}
              />
              <div className="ml-4 space-y-1.5">
                <div className="h-2.5 w-[70%] animate-pulse rounded" style={{ background: "var(--border)" }} />
                <div className="h-2.5 w-[58%] animate-pulse rounded" style={{ background: "var(--border)" }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          The curriculum appears here as soon as the structure is designed.
        </p>
      </div>
    );
  }

  const lessonsDone = stages.lessons.status === "done";
  const writing = stages.lessons.status === "active";

  return (
    <div
      className="overflow-hidden rounded-[10px] border lg:sticky lg:top-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <p
          className="text-[15px] font-semibold leading-snug tracking-[-0.015em]"
          style={{ color: "var(--ink)" }}
        >
          {skeleton.programName}
        </p>
      </div>
      <div className="max-h-[min(720px,calc(100dvh-11rem))] overflow-y-auto px-5 pt-4 pb-8">
        <ol className="space-y-3.5">
          {skeleton.modules.map((module, index) => (
            <li key={`${module.title}-${index}`}>
              <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                <span className="mr-1.5 tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                  {index + 1}.
                </span>
                {module.title}
              </p>
              <ul className="ml-5 mt-1 space-y-1">
                {module.lessons.map((lesson, lessonIndex) => (
                  <li
                    key={`${lesson.title}-${lessonIndex}`}
                    className="flex items-center gap-2 text-[12.5px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        background:
                          lessonsDone || !writing ? "#1c7a52" : "var(--border-strong, #d9d9d6)",
                      }}
                    />
                    <span className="min-w-0">{lesson.title}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StageIcon({ status }: { status: StageState["status"] }) {
  if (status === "done") {
    return (
      <span
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: "#1c7a52" }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5.5L4 7.5L8 3"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--accent, #2383e2)", borderTopColor: "transparent" }}
        />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: "#c4554d" }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M2 2L6 6M6 2L2 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
      <span
        className="h-2.5 w-2.5 rounded-full border"
        style={{ borderColor: "var(--border-strong, #d9d9d6)" }}
      />
    </span>
  );
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export type { CatalogStageId };

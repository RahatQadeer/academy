"use client";

import { useState } from "react";
import Link from "next/link";
import { ProgressBar } from "@/base/components/ProgressBar";
import type { CurriculumModule } from "../types";
import { ModuleSection } from "./ModuleSection";

export function LessonSidebar({
  programId,
  programName,
  modules,
  currentLessonId,
  completedCount,
  totalCount,
}: {
  programId: string;
  programName: string;
  modules: CurriculumModule[];
  currentLessonId: string;
  completedCount: number;
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <aside
      className="border-b lg:flex lg:h-full lg:w-[300px] lg:shrink-0 lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r"
      style={{
        background:
          "radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--module-academy-bg) 55%, transparent), var(--surface-soft))",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-[13px] font-medium"
          style={{ background: "transparent", border: 0, color: "var(--ink)" }}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <OutlineChevron open={open} />
          Course outline
        </button>
        <span className="text-[12px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
          {percent}%
        </span>
      </div>

      <div
        className={`${open ? "block" : "hidden"} max-h-[min(70vh,28rem)] overflow-y-auto lg:block lg:max-h-none lg:min-h-0 lg:flex-1 lg:overflow-y-auto`}
      >
        <div
          className="sticky top-0 z-[1] border-b px-4 pt-5 pb-4 lg:px-5 lg:pt-6 lg:pb-4"
          style={{
            borderColor: "var(--border)",
            background: "color-mix(in srgb, var(--surface-soft) 92%, transparent)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <Link
            href="/academy/learning"
            className="group inline-flex items-center gap-1 text-[12px] font-medium no-underline transition-colors hover:text-accent"
            style={{ color: "var(--text-secondary)" }}
          >
            <BackChevron />
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
              My Learning
            </span>
          </Link>

          <p className="mt-3 text-[14.5px] font-semibold leading-snug tracking-[-0.18px] text-pretty">
            {programName}
          </p>

          <div className="mt-3">
            <div
              className="mb-1.5 flex items-center justify-between gap-3 text-[11.5px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span>
                {completedCount} of {totalCount} complete
              </span>
              <span className="tabular-nums font-medium">{percent}%</span>
            </div>
            <ProgressBar value={percent} tone={percent === 100 ? "success" : "default"} />
          </div>
        </div>

        <nav className="px-4 py-4 lg:px-5 lg:pb-6" aria-label="Program curriculum">
          {modules.map((module) => (
            <ModuleSection
              key={module.id}
              title={module.title}
              programId={programId}
              lessons={module.lessons}
              currentLessonId={currentLessonId}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function BackChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M7.5 2.5 3.75 6 7.5 9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OutlineChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s ease" }}
    >
      <path
        d="M4.5 2.5 8.25 6 4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

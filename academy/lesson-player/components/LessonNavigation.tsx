import Link from "next/link";
import type { CurriculumLesson } from "../types";
import { lessonPlayerHref } from "../utils/curriculum";

export function LessonNavigation({
  programId,
  previous,
  next,
}: {
  programId: string;
  previous: CurriculumLesson | null;
  next: CurriculumLesson | null;
}) {
  return (
    <nav
      className="mt-12 grid grid-cols-1 gap-3 border-t pt-6 sm:grid-cols-2"
      style={{ borderColor: "var(--border)" }}
      aria-label="Lesson navigation"
    >
      {previous ? (
        <NavLink
          href={lessonPlayerHref(programId, previous.id)}
          label="Previous"
          title={previous.title}
          direction="prev"
        />
      ) : (
        <div />
      )}
      {next ? (
        <NavLink
          href={lessonPlayerHref(programId, next.id)}
          label="Next"
          title={next.title}
          direction="next"
        />
      ) : (
        <div />
      )}
    </nav>
  );
}

function NavLink({
  href,
  label,
  title,
  direction,
}: {
  href: string;
  label: string;
  title: string;
  direction: "prev" | "next";
}) {
  const next = direction === "next";
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-[10px] px-4 py-3.5 no-underline transition-colors ${
        next ? "sm:flex-row-reverse sm:text-right" : ""
      }`}
      style={{
        border: next ? "1px solid var(--accent)" : "1px solid var(--border)",
        background: next ? "var(--accent-tint-soft)" : "var(--surface)",
        color: "var(--ink)",
      }}
    >
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{
          background: next ? "var(--accent)" : "var(--surface-soft)",
          color: next ? "#fff" : "var(--text-secondary)",
        }}
        aria-hidden
      >
        {next ? <ChevronRight /> : <ChevronLeft />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[11.5px] font-medium"
          style={{ color: next ? "var(--accent)" : "var(--text-tertiary)" }}
        >
          {label}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[14px] font-medium leading-snug">{title}</span>
      </span>
    </Link>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M8.5 3.5 4.75 7 8.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M5.5 3.5 9.25 7 5.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

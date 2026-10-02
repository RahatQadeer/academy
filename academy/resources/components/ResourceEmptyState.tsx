import Link from "next/link";
import { Button } from "@/base/components/Button";

export type ResourceEmptyKind =
  | "no_enrollments"
  | "no_course_resources"
  | "no_general_resources"
  | "no_matches";

const COPY: Record<
  ResourceEmptyKind,
  { title: string; body: string; explore?: boolean; learning?: boolean }
> = {
  no_enrollments: {
    title: "No enrolled programs yet",
    body: "This library shows downloadable files for programs you join. Enroll from Explore, then return here for templates and reference material.",
    explore: true,
  },
  no_course_resources: {
    title: "No downloadable files yet",
    body: "This program has no library files published yet. Lessons, videos, quizzes, and assignments remain in My Learning — not on this page.",
    learning: true,
  },
  no_matches: {
    title: "No matching files",
    body: "Nothing matches your search or type filter for this program. Clear filters to see the full library list.",
  },
  no_general_resources: {
    title: "No academy-wide files yet",
    body: "Shared templates and guides that are not tied to one course will appear here when Academy publishes them for all learners.",
  },
};

export function ResourceEmptyState({ kind }: { kind: ResourceEmptyKind }) {
  const copy = COPY[kind];

  return (
    <div
      className="relative overflow-hidden rounded-[14px] border border-dashed px-6 py-9 text-center sm:px-8"
      style={{
        borderColor: "var(--border-dashed)",
        background:
          "radial-gradient(90% 80% at 50% 0%, color-mix(in srgb, var(--module-academy-bg) 70%, white), var(--surface))",
      }}
    >
      <div
        className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-[12px]"
        style={{ background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" }}
        aria-hidden
      >
        <LibraryIcon />
      </div>
      <p className="text-[15px] font-semibold tracking-[-0.15px]">{copy.title}</p>
      <p
        className="mx-auto mt-2 max-w-[48ch] text-[13.5px] leading-relaxed text-justify text-pretty"
        style={{ color: "var(--text-secondary)" }}
      >
        {copy.body}
      </p>
      {copy.explore || copy.learning ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {copy.explore ? (
            <Button href="/academy/explore" variant="dark">
              Explore catalog →
            </Button>
          ) : null}
          {copy.learning ? (
            <Link
              href="/academy/learning"
              className="inline-flex items-center rounded-[7px] border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-medium text-ink no-underline transition-colors hover:bg-surface-soft"
            >
              Open My Learning
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LibraryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 4.5h4.5A2 2 0 0110.5 6.5v10A2 2 0 008.5 14.5H4v-10zM16 4.5h-4.5A2 2 0 009.5 6.5v10a2 2 0 012 2H16v-14z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import type { ActivityKind } from "@/client-portal/types";

/**
 * The mark on an activity row, drawn rather than set as a glyph.
 *
 * The feed used to put `◐ ✉ ▥ ✓` in a span. Those are typographic characters:
 * they come from whichever installed font happens to carry them, so they land
 * at different weights and different optical sizes on every machine, and one
 * of them is the dingbat a checkbox is drawn with. `Widget`'s own marks were
 * already SVG for this reason — these are the same 16px grid and the same
 * 1.4 stroke, so a mark on Home and a mark in the feed are one family.
 */
export function ActivityMark({ kind }: { kind: ActivityKind }) {
  const path = PATHS[kind];
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {path}
    </svg>
  );
}

const PATHS: Record<ActivityKind, React.ReactNode> = {
  // A line that climbs — the same mark `UpdateMark` draws on Home.
  update: (
    <>
      <path d="M2.5 11.5 6 8l2.5 2.5 5-5" />
      <path d="M10 5.5h3.5V9" />
    </>
  ),
  // Work in motion: an arrow round a corner.
  request: (
    <>
      <path d="M3 5.5h7a3 3 0 0 1 0 6H5" />
      <path d="m7 9.5-2 2 2 2" />
    </>
  ),
  // A page with its corner turned.
  document: (
    <>
      <path d="M9 2H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5z" />
      <path d="M9 2v3.5h3.5" />
    </>
  ),
  // A form: a page with answers on it.
  form: (
    <>
      <path d="M10.5 3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1" />
      <path d="M6 2h4v2H6z" />
      <path d="M6.5 8.5h3M6.5 11h3" />
    </>
  ),
  // An envelope.
  message: (
    <>
      <rect x="2.5" y="4" width="11" height="8" rx="1" />
      <path d="m2.5 5 5.5 4 5.5-4" />
    </>
  ),
  // A note with a currency stroke through it.
  invoice: (
    <>
      <rect x="2" y="4" width="12" height="8" rx="1" />
      <path d="M8 6v4M6.75 7.25h2.5M6.75 8.75h2.5" />
    </>
  ),
  // A calendar leaf.
  event: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </>
  ),
  // A tick, as `TickMark` draws it.
  task: <path d="M3.5 8.5 6.5 11.5 12.5 5" strokeWidth="1.8" />,
};

/**
 * Three tones, not eight.
 *
 * A colour per kind turns a list of twelve rows into a list of twelve colours,
 * and the sentence beside the mark already says which kind it is. These say
 * something the sentence does not: whether the row is your team speaking to
 * you, something finishing, or a record filed.
 */
export const ACTIVITY_TONE: Record<ActivityKind, { bg: string; fg: string }> = {
  update: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  message: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  task: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
  request: { bg: "var(--canvas)", fg: "var(--text-secondary)" },
  document: { bg: "var(--canvas)", fg: "var(--text-secondary)" },
  form: { bg: "var(--canvas)", fg: "var(--text-secondary)" },
  invoice: { bg: "var(--canvas)", fg: "var(--text-secondary)" },
  event: { bg: "var(--canvas)", fg: "var(--text-secondary)" },
};

/**
 * The three button sizes, as Whitby uses them.
 *
 * Base's `Button` has one size — 14.5px with 18px by 10px of padding — and the
 * portal drew every button at it: the Upload beside a page title, Save under
 * four fields, and "Correct & Resubmit" inside a table row, where it wrapped
 * onto two lines and made the row twice the height of its neighbours. Whitby
 * does not. Its sizes follow what a button sits in:
 *
 *   page   beside a page title, or under an empty state — base's own size
 *   form   the foot of a dialog or a settings pane — 13.5px, 18px by 9px
 *   row    inside a table row or a list line — 12.5px, 12px by 6px, which is
 *          Integrations' Connect and Manage exactly
 *
 * Passed to base's `Button` with `unsized`, so the size here is the only one on
 * the element rather than a second one competing with the default.
 */
export const BUTTON_SIZE = {
  page: "px-[18px] py-[10px] text-[14.5px]",
  form: "px-[18px] py-[9px] text-[13.5px]",
  // `cp-row-btn` turns the corner into the panel's capsule — see globals.
  row: "cp-row-btn whitespace-nowrap px-3 py-1.5 text-[12.5px]",
} as const;

export type ButtonSize = keyof typeof BUTTON_SIZE;

/**
 * A destructive button that is not the last step — "Disconnect…", "Remove…" —
 * outlined in red on white. The confirming press inside the dialog is the
 * solid one, `DANGER_SOLID`.
 */
export const DANGER_OUTLINE =
  "inline-flex items-center justify-center rounded-control border font-medium no-underline transition-colors hover:bg-[var(--danger-action-bg)] disabled:cursor-not-allowed disabled:opacity-40";

export const DANGER_OUTLINE_STYLE = {
  borderColor: "var(--danger-border)",
  color: "var(--danger-outline-fg)",
  background: "var(--surface)",
} as const;

export const DANGER_SOLID =
  "inline-flex items-center justify-center rounded-control font-medium text-white no-underline transition-opacity hover:opacity-90 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export const DANGER_SOLID_STYLE = { background: "var(--danger-solid)" } as const;

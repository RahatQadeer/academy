import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { FilterSelect } from "./FilterSelect";

/**
 * One select beside the search.
 *
 * It was `FilterBar`'s, and `FilterBar` is gone: every list screen it served
 * is drawn in this panel now, and a filter row that sat above a bordered table
 * had nowhere left to sit.
 */
export type SelectFilter = {
  name: string;
  /** Shown when nothing is selected, e.g. "All categories". */
  anyLabel: string;
  value?: string;
  options: { value: string; label: string }[];
};

/**
 * The list panel every portal screen is now drawn in.
 *
 * It is the Messages rail's material, lifted out of Messages and the Calendar
 * so the six list screens are one object rather than six: a panel set into the
 * page on its own cool ground with its corners turned, a rounded search field,
 * a row of counted chips, and rows that lead with a tile.
 *
 * WHY NOT THE TABLE
 *
 * These screens were bordered tables under underlined tabs — Whitby's shape,
 * which is right for Whitby. A professional reads forty rows of other people's
 * work by scanning one column down; a client reads eight rows of their own by
 * reading each one. The columns bought alignment nobody was using and spent a
 * phone's whole width doing it, so `Updated` truncated to an ellipsis on the
 * device this is most often opened on. A row that reads as a sentence — what
 * it is, where it stands, when it moved — fits the narrow screen and says the
 * same thing on the wide one.
 *
 * `.pa-chat-pane` retints --surface, --ink, --border and the rest inside the
 * panel, so a `Pill`, a `Button` or a `StatusPill` dropped in here comes out in
 * the panel's own palette without being told about it.
 */
const PANEL_SHADOW = {
  boxShadow: "0 1px 2px rgb(var(--shade-rgb) / .1), 0 10px 28px -14px rgb(var(--shade-rgb) / .22)",
};

export function ListPanel({
  controls,
  children,
}: {
  /** The search field and chips. Omitted on a panel that filters nothing. */
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pa-chat-pane cp-chat overflow-hidden rounded-[16px]" style={PANEL_SHADOW}>
      {controls ? (
        <div className="px-4 pb-3.5 pt-4 sm:px-5" style={{ background: "var(--surface)" }}>
          {controls}
        </div>
      ) : null}
      <div
        className={controls ? "border-t" : undefined}
        style={{ borderColor: "var(--chat-line)", background: "var(--chat-ground)" }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Search, and the selects that narrow with it.
 *
 * Still the plain GET form `FilterBar` was — the URL stays the state, Back
 * works, and a filtered list is a link a client can send — in the rounded field
 * the rail searches conversations with. Enter submits, and a select applies
 * itself.
 *
 * The Calendar's own search is live rather than a form, because every event it
 * lists is already on the page. These lists are filtered where they are read,
 * so they keep the round trip and only change their clothes.
 */
export function PanelSearch({
  action,
  name = "q",
  placeholder,
  value,
  hidden,
  selects = [],
  sort,
  trailing,
}: {
  action: string;
  name?: string;
  placeholder: string;
  value?: string;
  /** The tab and any other view params, so filtering stays where you are. */
  hidden?: Record<string, string | undefined>;
  selects?: SelectFilter[];
  sort?: SelectFilter;
  /**
   * The screen's own control, at the end of the row the selects are on —
   * New Request, Upload, Share an update.
   *
   * It used to sit above the panel beside the page title, which is where the
   * title no longer is: the button was left floating on a line of its own,
   * paying a whole row for one control. Down here it costs nothing, and it
   * ends the row a reader's eye is already crossing to reach the sort.
   *
   * A link, never a submit — this is a GET form and the button leads
   * somewhere rather than filtering anything.
   */
  trailing?: React.ReactNode;
}) {
  const hasSelects = selects.length > 0 || Boolean(sort);
  const hasRow = hasSelects || Boolean(trailing);

  return (
    <form action={action} method="get" className="mb-3">
      {hidden
        ? Object.entries(hidden).map(([key, held]) =>
            held ? <input key={key} type="hidden" name={key} value={held} /> : null,
          )
        : null}

      <label
        className="pa-chat-search flex items-center gap-2 rounded-full border px-3 py-[7px] transition-[border-color,box-shadow,background-color] duration-200"
        style={{ background: "var(--surface-soft)", borderColor: "var(--chat-line)" }}
      >
        <span className="shrink-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }} aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          name={name}
          defaultValue={value}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none [&::-webkit-search-cancel-button]:hidden"
          style={{ color: "var(--ink)" }}
        />
      </label>

      {hasRow ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {selects.map((select) => (
            <PanelSelect key={select.name} filter={select} />
          ))}
          {/* Whichever of the two comes first takes the gap, so the row reads
              filters-left, actions-right at every width and on a panel that
              has only one of them. */}
          {sort ? (
            <span className="sm:ml-auto">
              <PanelSelect filter={sort} />
            </span>
          ) : null}
          {trailing ? (
            <span className={sort ? "shrink-0" : "shrink-0 sm:ml-auto"}>{trailing}</span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/**
 * A select, dressed as one of the panel's own capsules.
 *
 * It was a square-cornered box with the browser's arrow in it, sitting in a
 * row of pills — the one control on the panel that looked like it belonged to
 * the operating system. `.cp-filter` carries the whole of it, including the
 * state that matters most and that it never showed: a filter that is *set*
 * wears the chosen chip's accent, so a list narrowed two rows up says so.
 */
function PanelSelect({ filter }: { filter: SelectFilter }) {
  return (
    <span className={cn("cp-filter", filter.value && "is-on")}>
      <FilterSelect
        name={filter.name}
        value={filter.value ?? ""}
        all={filter.anyLabel}
        options={filter.options}
        // Everything but the width is in the class; this keeps a long label
        // from stretching the row it shares with the chips.
        className="max-w-[188px] truncate"
      />
      <span className="cp-filter-caret" aria-hidden>
        ▾
      </span>
    </span>
  );
}

/**
 * The panel's own control — New Request, Upload, Share an update.
 *
 * Not base's `Button`: that is the page's button, sized and cornered for a
 * dialog foot or an empty state, and it read as a slab dropped into a row of
 * capsules. This is the row's shape at the row's size, and the accent is what
 * separates the one control that makes something from the four that narrow
 * what is already there.
 */
export function PanelAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="cp-panel-action cp-press">
      {children}
    </Link>
  );
}

/**
 * A switch between two or three views of one list, drawn as one track with a
 * lit segment.
 *
 * Deliberately not a chip. The chips say how much of a list is in each state
 * and are read as a set; this says which list is on the screen at all, and a
 * reader needs to see at a glance that it is one choice rather than four
 * filters. The counts are optional and quiet — they are context for the
 * choice, not the point of it.
 */
export function SegmentedNav({
  items,
  active,
  label,
  className,
}: {
  items: { key: string; label: string; href: string; count?: number }[];
  active: string;
  /** What this switches between, for a reader who cannot see it. */
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("cp-seg", className)}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className="cp-seg-item"
        >
          {item.label}
          {item.count === undefined ? null : (
            <span className="cp-seg-count">{item.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The heading a run of rows sits under — a day on the Calendar, a label on
 * Documents, a Request anywhere it groups by one.
 *
 * Never sticky: the portal's own bar is sticky at the top of this same
 * scroller and is opaque, so a heading pinned under it is a heading nobody
 * sees.
 */
export function PanelGroup({
  label,
  note,
  children,
}: {
  label: string;
  /** A word at the far end — "Past", a count, whatever the group needs said. */
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="flex items-center justify-between gap-3 border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-[.05em] sm:px-5"
        style={{
          color: "var(--text-faint)",
          borderColor: "var(--chat-line)",
          background: "var(--surface)",
        }}
      >
        <span className="min-w-0 truncate">{label}</span>
        {note ? (
          <span className="shrink-0 font-medium normal-case tracking-normal">{note}</span>
        ) : null}
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

/** Rows with no headings over them. */
export function PanelRows({ children }: { children: React.ReactNode }) {
  return <ul>{children}</ul>;
}

/**
 * One row.
 *
 * `href` makes the whole row navigate. Where a row also carries its own
 * controls — Documents' Download, Forms' Complete Form — the target becomes an
 * overlay beneath them, because a link inside a link is markup the browser
 * unpicks in whichever way it likes.
 *
 * THE RIGHT-HAND COLUMN
 *
 * When it moved, and what can be done about it, in one column at the end of
 * the row: the time on top, the controls under it.
 *
 * They were in three different places. The controls were a line of their own
 * at the row's foot — a 28px band and a set of buttons at the far end of a row
 * whose text was often one line, which is why seven documents were seven rows
 * of nearly a hundred pixels. The time was pinned to the end of the *title*,
 * so "Sent 2d ago" sat at the top right and "Complete Form" at the bottom
 * right with the row's whole height between two things that belong to each
 * other. One column, top-aligned with the title, and the row is a line shorter
 * than it was and reads as two halves instead of four corners.
 *
 * It wraps rather than squeezes: below about 260px of text the column drops
 * under the row, which is the old shape, kept for the width that needs it.
 */
export function PanelRow({
  href,
  when,
  trailing,
  dim = false,
  children,
}: {
  href?: string;
  /** When this last moved — "2d ago", "Sent 2d ago", a date. */
  when?: React.ReactNode;
  trailing?: React.ReactNode;
  /** A finished or expired row, drawn a shade back. */
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className="group relative block border-b last:border-b-0"
      style={{ borderColor: "var(--chat-line)", color: "var(--ink)" }}
    >
      {/*
       * The whole row, as one target. An `<a>` cannot contain the buttons on
       * the row, so it is an overlay rather than a wrapper, and the buttons
       * take their own clicks back by sitting above it.
       *
       * It carries no colour of its own. A positioned element with a z-index
       * paints above its unpositioned siblings, so a hover tint on this
       * overlay would be a hover tint drawn *over* the row's own text — and
       * `--surface-active` is opaque. The tint belongs to the row underneath;
       * this is a target and a focus ring and nothing else.
       */}
      {href ? (
        <Link
          href={href}
          className="absolute inset-0 z-10 rounded-[2px] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none"
          aria-label="Open"
        />
      ) : null}

      <span
        className={cn(
          "relative flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 sm:px-5",
          href && "transition-colors duration-150 group-hover:bg-[var(--surface-active)]",
        )}
        style={{ opacity: dim ? 0.72 : 1 }}
      >
        {/* The text. Transparent to the pointer so the target underneath takes
            the click anywhere that is not a control. */}
        <span
          className={cn(
            "flex min-w-[min(100%,260px)] flex-1 items-start gap-3",
            href && "pointer-events-none",
          )}
        >
          {children}
        </span>

        {when || trailing ? (
          <span className="pointer-events-auto relative z-20 flex shrink-0 flex-col items-end gap-2">
            {when ? (
              // Level with the title it belongs to, and directly over the
              // control that acts on it.
              <span
                className="text-[11px] leading-[18px] tabular-nums"
                style={{ color: "var(--text-tertiary)" }}
                suppressHydrationWarning
              >
                {when}
              </span>
            ) : null}
            {trailing ? (
              <span className="flex flex-wrap items-center justify-end gap-1.5">{trailing}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </li>
  );
}

/**
 * The mark a row leads with.
 *
 * The Calendar puts the date here, because that is what a calendar is read by;
 * everywhere else it is the one glyph that says what kind of thing the row is,
 * tinted by where the row stands. Either way the left edge of the list can be
 * read without reading a word of it.
 */
export function PanelTile({
  glyph,
  tone = "neutral",
  size = "md",
  style,
  children,
}: {
  glyph?: React.ReactNode;
  tone?: "neutral" | "accent" | "warning" | "danger" | "success";
  /** `sm` for a dense list inside a dropdown; `md` for a screen's own rows. */
  size?: "sm" | "md";
  /**
   * Colours of its own instead of a tone — the Calendar's date tile, which is
   * tinted by the event's kind rather than by one of the five states here.
   */
  style?: React.CSSProperties;
  /** For a tile that draws its own contents, like the Calendar's date. */
  children?: React.ReactNode;
}) {
  const tones = {
    neutral: { background: "var(--surface-soft)", borderColor: "var(--chat-line)", color: "var(--text-tertiary)" },
    accent: { background: "var(--accent-tint)", borderColor: "var(--info-bg)", color: "var(--accent)" },
    warning: { background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-fg)" },
    danger: { background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger-fg)" },
    // No --success-border in the palette; the tile reads as filled instead.
    success: { background: "var(--success-bg)", borderColor: "var(--success-bg)", color: "var(--success-fg)" },
  } as const;

  return (
    <span
      className={cn(
        "flex shrink-0 flex-col items-center justify-center border",
        size === "sm" ? "h-[34px] w-[34px] rounded-[10px] text-[14px]" : "h-[46px] w-[46px] rounded-[12px] text-[17px]",
      )}
      style={style ?? tones[tone]}
      aria-hidden
    >
      {children ?? glyph}
    </span>
  );
}

/**
 * The title line: what the row is.
 *
 * It used to carry when the row last moved as well, pinned to its far end —
 * see `PanelRow`, which is where that went and why. What is left is the line
 * of text, free to use the width it has rather than stopping short of a
 * timestamp.
 */
export function PanelTitle({
  children,
  strike = false,
}: {
  children: React.ReactNode;
  strike?: boolean;
}) {
  return (
    <span className="mb-[3px] block">
      <span
        className={cn(
          "block min-w-0 truncate text-[13.5px] font-semibold leading-[18px]",
          strike && "line-through",
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** The quiet line under the title. */
export function PanelMeta({
  children,
  clamp = true,
}: {
  children: React.ReactNode;
  /** Off for prose, which is allowed to wrap — an update's body. */
  clamp?: boolean;
}) {
  return (
    <span
      className={cn("block text-[12.5px]", clamp ? "truncate" : "max-w-[72ch] leading-relaxed")}
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </span>
  );
}

/** The pills a row ends with. */
export function PanelTags({ children }: { children: React.ReactNode }) {
  return <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{children}</span>;
}

/** Everything to the right of the tile. */
export function PanelBody({ children }: { children: React.ReactNode }) {
  return <span className="block min-w-0 flex-1">{children}</span>;
}

/**
 * Nothing here.
 *
 * The Messages empty pane, in each screen's own words: a tile, a line saying
 * what is missing, a line saying where it would have come from, and — when the
 * list is empty because of a filter rather than because there is nothing — the
 * way back out of the filter.
 */
export function PanelEmpty({
  glyph,
  title,
  detail,
  action,
}: {
  glyph: string;
  title: string;
  detail?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="cp-fade-up flex flex-col items-center gap-2.5 px-6 py-16 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-[14px] text-[18px]"
        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        aria-hidden
      >
        {glyph}
      </div>
      <div className="text-[13.5px] font-semibold">{title}</div>
      {detail ? (
        <div
          className="max-w-[340px] text-[12.5px] leading-[1.5]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {detail}
        </div>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className="cp-press mt-1 rounded-full px-3 py-1 text-[12.5px] font-medium no-underline hover:bg-[var(--surface-active)]"
          style={{ color: "var(--accent)" }}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

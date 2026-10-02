import Link from "next/link";
import { cn } from "@/base/lib/cn";

export type Column = {
  label: string;
  /** CSS grid track, e.g. "2fr" or "120px". */
  width: string;
};

/**
 * The list-table pattern, as Whitby draws it: bordered card, tinted header row,
 * 1px dividers, no shadow.
 *
 * Deliberately a portal-owned copy of `whitbyos/components/DataTable`, not an
 * import. The two modules ship on separate branches and Whitby's is edited
 * often; a shared file would make every tweak to the professional's tables a
 * change to the client's, which is exactly the coupling the module split
 * exists to prevent. The visual contract is what is being shared here, and it
 * is small enough to hold by hand.
 *
 * The grid template is set once as a CSS variable so rows inherit it and
 * columns can never drift out of alignment with the header.
 *
 * `rowPadding` travels the same way, because one row height does not fit every
 * screen: dense lists sit at 12px, and a row carrying two lines of meta needs
 * 14px to breathe.
 */
export function DataTable({
  columns,
  rowPadding = 12,
  minWidth = 720,
  children,
}: {
  columns: Column[];
  rowPadding?: number;
  /**
   * The narrowest the columns may be pressed before the table scrolls sideways
   * instead. On a phone a six-column grid in 350px gave every `fr` column a
   * few characters, so a name, a status and a date each truncated to an
   * ellipsis and the row said nothing. Scrolling keeps the row readable; the
   * page itself never scrolls sideways, only the table in it.
   */
  minWidth?: number;
  children: React.ReactNode;
}) {
  const template = columns.map((column) => column.width).join(" ");

  return (
    <div className="overflow-x-auto rounded-[8px] border border-line">
    <div
      className="overflow-hidden"
      style={{
        minWidth,
        ["--cols" as string]: template,
        ["--row-py" as string]: `${rowPadding}px`,
      }}
    >
      <div
        className="grid border-b border-line px-4 py-[10px] text-[11.5px] font-semibold"
        style={{
          gridTemplateColumns: "var(--cols)",
          background: "var(--surface-soft)",
          color: "var(--text-tertiary)",
        }}
      >
        {columns.map((column, index) => (
          <span key={`${column.label}-${index}`}>{column.label}</span>
        ))}
      </div>
      {children}
    </div>
    </div>
  );
}

/**
 * A row. Pass `href` to make the whole row navigate.
 *
 * `trailing` is for a row that both navigates and carries its own control — a
 * form row that opens the form and also offers Download. It cannot simply be a
 * link inside the row's link, which is invalid markup the browser unpicks, so
 * the row's target becomes an overlay and the control sits above it.
 */
export function DataTableRow({
  href,
  trailing,
  children,
}: {
  href?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (href && trailing) {
    return (
      <div
        className="relative grid items-center border-b border-line px-4 text-[13.5px] last:border-b-0 hover:bg-[var(--surface-soft)]"
        style={{
          gridTemplateColumns: "var(--cols)",
          paddingBlock: "var(--row-py, 12px)",
          color: "var(--ink)",
        }}
      >
        <Link href={href} className="absolute inset-0 z-10" aria-label="Open" />
        {children}
        <span className="relative z-20 justify-self-end">{trailing}</span>
      </div>
    );
  }

  const className = cn(
    "grid items-center border-b border-line px-4 text-[13.5px] last:border-b-0",
    href && "no-underline hover:bg-[var(--surface-soft)]",
  );

  const content = (
    <div
      className={className}
      style={{
        gridTemplateColumns: "var(--cols)",
        paddingBlock: "var(--row-py, 12px)",
        color: "var(--ink)",
      }}
    >
      {children}
    </div>
  );

  return href ? (
    <Link href={href} className="block no-underline">
      {content}
    </Link>
  ) : (
    content
  );
}

/**
 * Cell at one of the emphasis levels the design uses.
 *
 * `strong` is the row's own subject at weight 500 — the form's name, the
 * document's title. `ink` is plain text colour at normal weight. The rest step
 * down through the grey scale for the facts that support it.
 */
export function DataTableCell({
  emphasis = "default",
  children,
}: {
  emphasis?: "strong" | "ink" | "default" | "soft" | "muted";
  children: React.ReactNode;
}) {
  const style =
    emphasis === "strong"
      ? { fontWeight: 500 }
      : emphasis === "ink"
        ? undefined
        : emphasis === "soft"
          ? { color: "var(--text-muted)" }
          : emphasis === "muted"
            ? { color: "var(--text-tertiary)" }
            : { color: "var(--text-secondary)" };

  // Right padding rather than a grid gap, so a long title truncates clear of
  // the column beside it rather than touching it, which reads as broken.
  return (
    <span className="min-w-0 truncate pr-3" style={style}>
      {children}
    </span>
  );
}

/**
 * A cell that must not truncate — a status pill, a button, an avatar stack.
 *
 * `DataTableCell` truncates by design, and truncation on a pill clips the
 * label to an ellipsis at narrow widths. Anything whose width is its content
 * goes here instead.
 */
export function DataTableFixed({
  align = "start",
  children,
}: {
  align?: "start" | "end";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn("flex min-w-0 items-center pr-3", align === "end" && "justify-end")}
    >
      {children}
    </span>
  );
}

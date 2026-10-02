import Link from "next/link";
import { cn } from "@/base/lib/cn";

export type Column = {
  label: string;
  /** CSS grid track, e.g. "2fr" or "120px". */
  width: string;
};

/**
 * The list-table pattern shared by Clients, Requests, Contacts and Providers:
 * bordered card, tinted header row, 1px dividers, no shadow.
 *
 * The grid template is set once here as a CSS variable so rows inherit it and
 * columns can never drift out of alignment with the header.
 *
 * `rowPadding` travels the same way. The reference does not use one row height
 * everywhere — the Client list sits at 12px, Tasks at 13px, Work Plans at 14px
 * — so the table carries it rather than every row repeating it.
 */
export function DataTable({
  columns,
  rowPadding = 12,
  children,
}: {
  columns: Column[];
  rowPadding?: number;
  children: React.ReactNode;
}) {
  const template = columns.map((column) => column.width).join(" ");

  return (
    /*
     * Scrolls sideways rather than squashing.
     *
     * The columns are `fr`, so they shrink to fit whatever they are given —
     * which is right down to a point and nonsense past it: on a phone, or
     * with the Whitby panel open beside it, "UK Business Expansion & Founder
     * Relocation" became four characters and an ellipsis in every row.
     *
     * A floor of 720px and the table slides under the finger instead. The
     * outer box keeps the border and the corners, so nothing scrolls out
     * past them.
     */
    <div className="overflow-x-auto overflow-y-hidden rounded-[8px] border border-line">
      <div
        className="min-w-[720px]"
        style={{
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
          {columns.map((column) => (
            <span key={column.label}>{column.label}</span>
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
 * `trailing` is for a row that both navigates and carries its own control —
 * WP.2's delete, which sits inside a row that opens the plan. It cannot simply
 * be a link inside the row's link, which is invalid markup the browser
 * unpicks, so the row's target becomes an overlay and the control sits above
 * it.
 */
export function DataTableRow({
  href,
  trailing,
  nested,
  children,
}: {
  href?: string;
  trailing?: React.ReactNode;
  /** A row hanging off the one above it — a person at a firm. */
  nested?: boolean;
  children: React.ReactNode;
}) {
  const nestedWash = nested
    ? {
        background: "color-mix(in srgb, var(--surface-soft) 78%, var(--surface))",
      }
    : undefined;

  if (href && trailing) {
    return (
      <div
        className="relative grid items-center border-b border-line px-4 text-[13.5px] last:border-b-0 hover:bg-[var(--surface-soft)]"
        style={{
          gridTemplateColumns: "var(--cols)",
          paddingBlock: "var(--row-py, 12px)",
          color: "var(--ink)",
          ...nestedWash,
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
        ...nestedWash,
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
 * `soft` is WP.2's — .6, a step darker than `default`, which the Work Plans
 * list uses for Client, Urgency and Due.
 *
 * `ink` is the plain one — full text colour, normal weight — which the
 * Dashboard's Client and Request columns use. It is not the same as `strong`,
 * which the Work Plans list reserves for the plan's own name at weight 500.
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

  // Right padding rather than a grid gap. The reference's list grids have no
  // gap, and its sample names are short enough never to meet the next column —
  // real ones are not, and a truncated name touching the cell beside it reads
  // as broken. Invisible at the reference's own content lengths.
  return (
    <span className="min-w-0 truncate pr-3" style={style}>
      {children}
    </span>
  );
}

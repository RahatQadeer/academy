import Link from "next/link";

/**
 * A panel on Home.
 *
 * Every one is the same card: a 14px semibold name with a link out on the
 * right, then rows separated by hairlines. Home used to set its sections as
 * free-standing 15px headings over their own bordered lists and card grids,
 * which made the page a column of different shapes; this is one shape with
 * different rows in it, and it can sit in the main column or the side one.
 *
 * It is drawn in the material the list screens use — `.pa-chat-pane`'s cool
 * ground, 16px corners and a soft shadow instead of a hairline box. Home is the
 * first screen a client sees and the one that links to all the others; a
 * dashboard of white boxes in front of six panels of tinted paper announced
 * itself as a different product.
 */
export function Widget({
  title,
  href,
  linkLabel = "View all",
  count,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  /** Beside the title, for a panel whose size is itself the news. */
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="pa-chat-pane cp-chat overflow-hidden rounded-[16px]"
      style={{
        boxShadow: "0 1px 2px rgb(var(--shade-rgb) / .1), 0 10px 28px -14px rgb(var(--shade-rgb) / .22)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: "var(--surface)" }}
      >
        <h2 className="flex min-w-0 items-center gap-2 text-[14px] font-semibold">
          <span className="truncate">{title}</span>
          {count ? (
            <span
              className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-px text-[11px] font-medium"
              style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}
            >
              {count}
            </span>
          ) : null}
        </h2>
        {href ? (
          <Link
            href={href}
            className="shrink-0 whitespace-nowrap text-[12.5px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      <div
        className="flex flex-col border-t px-4 pb-1 pt-1"
        style={{ borderColor: "var(--chat-line)", background: "var(--chat-ground)" }}
      >
        {children}
      </div>
    </section>
  );
}

/** A row inside a widget: a hairline above it, the first one included. */
export function WidgetRow({
  href,
  tall = false,
  children,
}: {
  href?: string;
  tall?: boolean;
  children: React.ReactNode;
}) {
  const className = `-mx-2 flex items-center gap-3 rounded-control border-t px-2 first:border-t-0 ${
    tall ? "py-2.5" : "py-[7px]"
  }`;

  // A row that goes somewhere answers the pointer; one that does not, does not
  // pretend to. The hairline stays at the row's edge, so the hover tint sits
  // inside the rule rather than over it.
  return href ? (
    <Link
      href={href}
      className={`${className} no-underline transition-colors hover:bg-[var(--surface-active)]`}
      style={{ color: "var(--ink)", borderColor: "var(--chat-line)" }}
    >
      {children}
    </Link>
  ) : (
    <div className={className} style={{ borderColor: "var(--chat-line)" }}>
      {children}
    </div>
  );
}

/**
 * What a widget says when it has nothing to show.
 *
 * Most of these are good news — nothing waiting on you is the state a client
 * wants to be in — so the mark says which kind of empty it is.
 */
export function WidgetEmpty({
  mark,
  tone = "quiet",
  children,
  action,
}: {
  mark: React.ReactNode;
  tone?: "quiet" | "good";
  children: React.ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 px-4 py-7 text-center"
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-[12px]"
        style={{
          background: tone === "good" ? "var(--success-bg)" : "var(--accent-tint)",
          color: tone === "good" ? "var(--success-fg)" : "var(--accent)",
        }}
        aria-hidden
      >
        {mark}
      </span>
      <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {children}
      </span>
      {action ? (
        <Link
          href={action.href}
          className="cp-press rounded-full px-3 py-1 text-[12.5px] font-medium no-underline hover:bg-[var(--surface-active)]"
          style={{ color: "var(--accent)" }}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** The marks, drawn rather than set as glyphs, which render unevenly. */
export function TickMark() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8.5 6.5 11.5 12.5 5" />
    </svg>
  );
}

export function UpdateMark() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 11.5 6 8l2.5 2.5 5-5" />
      <path d="M10 5.5h3.5V9" />
    </svg>
  );
}

export function ListMark() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <path d="M5.5 4.5h8M5.5 8h8M5.5 11.5h8M2.5 4.5h.01M2.5 8h.01M2.5 11.5h.01" />
    </svg>
  );
}

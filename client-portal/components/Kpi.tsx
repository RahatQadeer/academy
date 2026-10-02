import Link from "next/link";

/**
 * The counts at the top of a screen, as one strip.
 *
 * WHAT IT WAS
 *
 * Five separate cards, each 16px-cornered on its own shadow, each 30px of
 * figure over a caption with 18px of padding around it — about 120px of the
 * fold spent on five numbers, on the one screen whose whole job is to answer
 * "what is waiting on me" before anything has to be opened. Five shadows in a
 * row also read as five things to deal with rather than as one summary.
 *
 * WHAT IT IS
 *
 * One strip, cells divided by the grid's own 1px gaps over a border-coloured
 * ground — the same object the Request screen's facts are drawn in, because
 * they are the same kind of thing and a client moving between the two screens
 * should not have to learn a second one. It costs about 70px instead of 120.
 *
 * The label leads and the figure follows, which is the opposite of the way
 * this was drawn before. Leading with a 30px number is right for a card a
 * reader lands on; in a row of four or five it means four unlabelled numbers
 * and a hunt for which is which. A label in the same place in every cell is
 * what makes a strip readable at a glance.
 */
export function KpiRow({
  children,
  wide = false,
  tour,
}: {
  children: React.ReactNode;
  /**
   * For figures longer than a count — "$18,425.00" needs a wider track than a
   * two-digit number, and a strip that wraps mid-figure is worse than one that
   * wraps early.
   */
  wide?: boolean;
  /** A name for the welcome tour's ring — see `SubNav`'s own. */
  tour?: string;
}) {
  return (
    <div
      data-tour={tour}
      className={
        wide
          ? "mb-4 grid gap-px overflow-hidden rounded-[14px] border border-line [grid-template-columns:repeat(auto-fit,minmax(168px,1fr))]"
          : "mb-4 grid gap-px overflow-hidden rounded-[14px] border border-line [grid-template-columns:repeat(auto-fit,minmax(146px,1fr))]"
      }
      style={{ background: "var(--border)" }}
    >
      {children}
    </div>
  );
}

/**
 * One cell: what it is, the figure, and a line of context under it.
 *
 * `href` makes the cell a link, which most of them are. A number a client
 * cannot act on is a number they have to go and find the screen for — the
 * outstanding balance is the way into the invoice that makes it up.
 */
export function KpiCard({
  label,
  value,
  detail,
  tone = "ink",
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "ink" | "danger" | "success";
  href?: string;
}) {
  const color =
    tone === "danger"
      ? "var(--danger-fg)"
      : tone === "success"
        ? "var(--success-fg)"
        : "var(--ink)";

  const inner = (
    <>
      <div
        className="text-[11px] font-semibold uppercase tracking-[.05em]"
        // A cell that is not nought and is asking something labels itself in
        // the same colour as its figure, so the pair reads as one statement.
        style={{ color: tone === "danger" ? "var(--danger-fg)" : "var(--text-faint)" }}
      >
        {label}
      </div>
      <div
        className="mt-1.5 text-[21px] font-bold leading-none tracking-[-0.5px]"
        style={{ color }}
      >
        {value}
      </div>
      {detail ? (
        <div className="mt-1 truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {detail}
        </div>
      ) : null}
    </>
  );

  const className = "block min-w-0 px-4 py-3 no-underline transition-colors";

  return href ? (
    <Link
      href={href}
      className={`${className} hover:bg-[var(--surface-active)]`}
      style={{ background: "var(--surface)" }}
    >
      {inner}
    </Link>
  ) : (
    <div className={className} style={{ background: "var(--surface)" }}>
      {inner}
    </div>
  );
}

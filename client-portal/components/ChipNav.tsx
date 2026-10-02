"use client";

import Link, { useLinkStatus } from "next/link";
import { cn } from "@/base/lib/cn";

export type Chip = {
  key: string;
  label: string;
  href: string;
  /**
   * Always drawn, zero included — see the note below. Left out only where the
   * chip is not a subset of anything and a number would be a fiction: Home's
   * Overview is a dashboard, not a filter over rows.
   */
  count?: number;
  /** Counted in the danger colour when it is not the open one. */
  urgent?: boolean;
};

/**
 * The row of filter chips every list in the portal is read through.
 *
 * It replaced the underlined `SubNav` on these screens for one reason: a tab
 * that does not say how much is behind it has to be opened to find that out,
 * and a client checking four tabs to learn that three are empty has spent four
 * navigations on a fact the server knew before the page was sent. So every chip
 * carries its number, **zero included** — an empty chip drawn dim is the whole
 * point, and a count hidden when it is nought is the one number worth printing.
 *
 * The look is the Messages rail's, unchanged, because a filter in this product
 * should be the same object wherever it is met.
 */
export function ChipNav({
  chips,
  active,
  label,
  tour,
  className,
}: {
  chips: Chip[];
  active: string;
  /** What this row filters, for a reader who cannot see it. */
  label: string;
  /** A name for the welcome tour to ring, as `SubNav` takes one. */
  tour?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-tour={tour}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-current={chip.key === active ? "page" : undefined}
          className="rounded-full no-underline outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
        >
          <ChipFace
            label={chip.label}
            active={chip.key === active}
            count={chip.count}
            urgent={chip.urgent ?? false}
          />
        </Link>
      ))}
    </nav>
  );
}

/**
 * Inside the link, so it can see the link's own navigation: a pressed chip
 * takes the selected look at once, and the press is answered before the list
 * it filters has arrived.
 */
function ChipFace({
  label,
  active,
  count,
  urgent,
}: {
  label: string;
  active: boolean;
  count?: number;
  urgent: boolean;
}) {
  const { pending } = useLinkStatus();
  const on = active || pending;
  const empty = count === 0;

  return (
    <span
      className={cn(
        "block rounded-full border px-2.5 py-[5px] text-[12px] transition-colors",
        on ? "font-semibold" : "font-medium hover:bg-[var(--surface-active)]",
      )}
      style={{
        borderColor: on ? "var(--accent)" : "var(--chat-line)",
        background: on ? "var(--accent-tint)" : "var(--chat-field)",
        color: on ? "var(--accent)" : empty ? "var(--text-quiet)" : "var(--text-secondary)",
      }}
    >
      {label}
      {count === undefined ? null : (
        <span
          className="ml-1 font-bold tabular-nums"
          style={{
            color: on
              ? "inherit"
              : empty
                ? "var(--text-disabled)"
                : urgent
                  ? "var(--danger-solid)"
                  : "inherit",
          }}
        >
          {count}
        </span>
      )}
    </span>
  );
}

"use client";

import { useState, type ReactNode } from "react";

/**
 * The panel's lid.
 *
 * Twenty rows of what the client still owes used to sit open on the plan and
 * push the work itself off the page. The title and one line stay; everything
 * else tucks away. Hidden, not unmounted — the ticks are still in the form,
 * so "ask for all of them" is still true with the lid shut.
 */
export function ClientNeedsFold({
  startOpen,
  title,
  line,
  count,
  aside,
  children,
  lid = true,
}: {
  startOpen: boolean;
  title: string;
  line: string;
  count: number;
  aside?: ReactNode;
  children: ReactNode;
  /**
   * Whether the panel can be shut.
   *
   * It lives on a screen of its own now, and on that screen the lid is a
   * button that empties the page: there is nothing else on it to make room
   * for. The title goes with it, because the page is already called Client
   * Checklist and two titles stacked is the screen saying its own name
   * twice. What stays is the line and the count, which say something the
   * heading above does not.
   */
  lid?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);

  if (!lid) {
    return (
      <section
        className="overflow-hidden rounded-[10px] border"
        style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
      >
        <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px]" style={{ margin: 0, color: "var(--text-secondary)" }}>
            {line}
          </p>
          {aside}
        </div>
        {children}
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-[10px] border"
      style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
    >
      {/* White whether it is open or shut.

          The grey band was meant to read as "there is more under here" and
          instead read as a disabled panel sitting inside a white card — a
          second background nobody asked for, on the one thing on this page
          that most wants reading. The chevron already says which state it is
          in, and the hover tint still says it can be pressed. */}
      <div
        className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-1"
        style={{ background: "var(--surface)" }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-soft)]"
        >
          <span
            aria-hidden
            className="mt-[3px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border text-[11px]"
            style={{
              borderColor: "var(--border-strong)",
              background: open ? "var(--accent-tint)" : "var(--surface)",
              color: open ? "var(--accent)" : "var(--text-secondary)",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 140ms ease",
            }}
          >
            ▾
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <h2
                className="text-[14.5px] font-semibold"
                style={{ color: "var(--ink)", margin: 0 }}
              >
                {title}
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                style={{
                  background: "var(--accent-tint)",
                  color: "var(--accent)",
                }}
              >
                {count}
              </span>
            </span>
            <p
              className="mt-1.5 text-[12.5px] leading-[1.5]"
              style={{ color: "var(--text-secondary)", margin: "6px 0 0" }}
            >
              {line}
            </p>
          </span>
        </button>

        {aside ? (
          <div className="shrink-0 px-4 pb-3 sm:px-3 sm:pb-3 sm:pt-3.5 sm:pr-4">{aside}</div>
        ) : null}
      </div>

      <div
        hidden={!open}
        className="border-t"
        style={{ borderColor: "var(--border)" }}
      >
        {children}
      </div>
    </section>
  );
}

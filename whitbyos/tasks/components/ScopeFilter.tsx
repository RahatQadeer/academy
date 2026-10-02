"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TASK_SCOPES, type TaskScope } from "@/whitbyos/lib/task-scopes";

/**
 * The eight views of this list, as one filter beside New Task.
 *
 * They were a rail down the side, then a row of tabs across the top; both
 * spent a band of the screen on eight questions in order to answer one, and
 * the answer is the list underneath.
 *
 * A panel of links rather than a `<select>`, because the options are not eight
 * words: each carries a count, two of them carry a colour, and they fall into
 * two groups that ask different questions. A native select can hold none of
 * that, and this is the one control on the screen somebody uses before they
 * read anything.
 */

/** Whose it is, and when it is due: the two questions the eight split into. */
const GROUP_LABEL: Record<1 | 2, string> = {
  1: "Whose it is",
  2: "When it is due",
};

export function ScopeFilter({
  scope,
  counts,
  hrefs,
}: {
  scope: TaskScope;
  counts: Record<TaskScope, number>;
  /** Pre-built URLs per scope — a function cannot cross the server → client boundary. */
  hrefs?: Partial<Record<TaskScope, string>>;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Anywhere else, or Escape. A panel that can only be closed by choosing
    // something is a panel that has taken the screen hostage.
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const active = TASK_SCOPES.find((item) => item.value === scope)!;

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-control border bg-surface px-3 py-[9px] text-[13.5px] font-medium transition-colors hover:bg-surface-soft"
        style={{ borderColor: "var(--border-strong)", color: inkFor(scope) }}
      >
        {active.label}
        <Count value={counts[scope]} tone={inkFor(scope)} on />
        <span
          aria-hidden
          className="text-[9px] transition-transform"
          style={{
            color: "var(--text-tertiary)",
            transform: open ? "rotate(180deg)" : undefined,
          }}
        >
          ▼
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-40 mt-1.5 w-[240px] overflow-hidden rounded-card border border-line shadow-float"
          style={{ background: "var(--surface)" }}
        >
          {TASK_SCOPES.map((item, index) => {
            const on = item.value === scope;
            const ink = inkFor(item.value);
            const opensGroup = index === 0 || TASK_SCOPES[index - 1].group !== item.group;

            return (
              <div key={item.value}>
                {opensGroup ? (
                  <p
                    className="px-3 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                    style={{ color: "var(--text-faint)", margin: 0 }}
                  >
                    {GROUP_LABEL[item.group]}
                  </p>
                ) : null}

                <Link
                  role="menuitem"
                  // `show` is deliberately dropped: how far down one list
                  // somebody has read says nothing about the next, and
                  // carrying it over would open a view already scrolled.
                  href={
                    hrefs?.[item.value] ??
                    (item.value === "mine"
                      ? "/whitbyos/tasks"
                      : `/whitbyos/tasks?scope=${item.value}`)
                  }
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-3 px-3 py-[7px] text-[13.5px] no-underline transition-colors hover:bg-surface-soft"
                  style={{
                    background: on ? "var(--accent-tint)" : undefined,
                    color: ink,
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="w-[9px] shrink-0 text-[10px]"
                      style={{ color: "var(--accent)" }}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>

                  <Count value={counts[item.value]} tone={ink} />
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A view's own colour.
 *
 * Only two of the eight have one. Overdue is a standing warning whether or not
 * anything is on it, and Completed is the one number here that is good news;
 * colouring the other six would leave none of it meaning anything.
 */
function inkFor(scope: TaskScope): string {
  if (scope === "overdue") return "var(--danger-fg)";
  if (scope === "completed") return "var(--success-fg)";
  return "var(--ink)";
}

/** The count beside a view. Quiet at zero: nothing there is not news. */
function Count({ value, tone, on }: { value: number; tone: string; on?: boolean }) {
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-px text-[11.5px] font-semibold tabular-nums"
      style={{
        background: on ? "var(--surface-soft)" : "transparent",
        color: value === 0 ? "var(--text-faint)" : tone,
      }}
    >
      {value}
    </span>
  );
}

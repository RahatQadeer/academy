"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { shortDate, statusLabel } from "@/whitbyos/lib/format";
import type { RequestPlan } from "@/whitbyos/lib/request-detail";

const DONE = new Set(["complete", "completed", "done"]);

/** How many plans stand before the rest are a press away. */
const FIRST = 5;

function planTone(status: string) {
  const key = status.toLowerCase();
  if (DONE.has(key)) return "success" as const;
  if (key === "active" || key === "running" || key === "in_progress") return "info" as const;
  if (key === "draft" || key === "not_started") return "neutral" as const;
  return "info" as const;
}

/**
 * Request → Work Plans tab: five cards, live search, the rest on a press.
 */
export function RequestWorkPlansList({ plans }: { plans: RequestPlan[] }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(FIRST);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return plans;
    return plans.filter((plan) => {
      const hay = [plan.name, statusLabel(plan.status), plan.status].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [plans, query]);

  /* A narrowed list starts at five again: "Show the other 11" left over
     from the last search counts plans that are no longer in it. Adjusted
     while rendering rather than in an effect, so the long list is never
     painted first. */
  const [searched, setSearched] = useState(query);
  if (query !== searched) {
    setSearched(query);
    setShown(FIRST);
  }

  return (
    <div className="w-full">
      <div
        className="mb-3.5 flex w-full max-w-[420px] items-center gap-2 rounded-[10px] border py-[7px] pl-3.5 pr-2.5 transition-[border-color,box-shadow] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
        style={{
          borderColor: "color-mix(in srgb, var(--chrome-line) 70%, #c5ced8)",
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none shrink-0"
          style={{ color: "var(--text-quiet)" }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10.5 10.5L14 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search work plans…"
          aria-label="Search work plans"
          className="min-w-0 flex-1 border-none bg-transparent py-1 text-[13.5px] outline-none placeholder:text-[rgba(55,53,47,0.38)] [&::-webkit-search-cancel-button]:hidden"
          style={{ color: "var(--ink)", caretColor: "var(--ink)" }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-soft)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M3 3l6 6M9 3L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-[12px] border px-5 py-8 text-center text-[13.5px]"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
            color: "var(--text-tertiary)",
          }}
        >
          {query.trim()
            ? `No work plans match “${query.trim()}”.`
            : "No Work Plan yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.slice(0, shown).map((plan) => {
            const complete = DONE.has(plan.status.toLowerCase());
            const pct =
              plan.tasksTotal > 0 ? Math.round((plan.tasksDone / plan.tasksTotal) * 100) : 0;

            return (
              <Link
                key={plan.id}
                href={`/whitbyos/work-plans/${plan.id}`}
                className="group block rounded-[12px] border px-4 py-3 no-underline transition-shadow hover:shadow-[0_2px_10px_-4px_rgba(23,48,78,.22)]"
                style={{
                  borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                  background: "var(--surface)",
                  boxShadow: "0 1px 2px rgba(31,72,125,.04)",
                  color: "var(--ink)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{plan.name}</span>
                    <span
                      className="mt-[3px] block text-[12.5px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {plan.tasksDone} of {plan.tasksTotal} tasks complete
                      {plan.targetDate ? ` · Due ${shortDate(plan.targetDate)}` : ""}
                    </span>
                  </span>

                  {/* The figure beside the bar. A bar on its own is a shape;
                      what somebody reads off a list of plans is how far each
                      one has got, and 6% and 0% are the same shape. */}
                  {plan.tasksTotal > 0 ? (
                    <span
                      className="shrink-0 text-[13px] font-semibold tabular-nums"
                      style={{ color: complete ? "var(--success-fg)" : "var(--text-secondary)" }}
                    >
                      {pct}%
                    </span>
                  ) : null}

                  <Pill tone={planTone(plan.status)}>{statusLabel(plan.status)}</Pill>

                  <span
                    className="shrink-0 text-[13px] transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--text-disabled)" }}
                    aria-hidden
                  >
                    →
                  </span>
                </div>

                {plan.tasksTotal > 0 ? (
                  <div
                    className="mt-2.5 h-[5px] overflow-hidden rounded-full"
                    style={{ background: "var(--surface-soft)" }}
                  >
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{
                        width: `${pct}%`,
                        background: complete ? "var(--success-solid, #0f7b6c)" : "var(--accent)",
                      }}
                    />
                  </div>
                ) : null}
              </Link>
            );
          })}

          {/*
           * Five, then the rest on a press.
           *
           * Sixteen cards is a scroll before the search box at the top is
           * out of sight, and the first five answer what somebody comes to
           * this tab for. The rest open here rather than on the Work Plans
           * screen, because that screen lists every plan in the workspace
           * and this tab is the only place scoped to this Request.
           */}
          {filtered.length > shown ? (
            <button
              type="button"
              onClick={() => setShown(filtered.length)}
              className="mt-1 rounded-[10px] border px-4 py-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-soft)]"
              style={{
                borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                background: "var(--surface)",
                color: "var(--accent)",
              }}
            >
              Show the other {filtered.length - shown}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

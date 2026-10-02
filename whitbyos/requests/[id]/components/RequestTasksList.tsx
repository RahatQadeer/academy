"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/base/components/Avatar";
import { shortDate } from "@/whitbyos/lib/format";
import type { RequestTask } from "@/whitbyos/lib/request-detail";

const DONE = new Set(["complete", "completed", "done"]);

const COLUMNS = "[grid-template-columns:2.2fr_1.2fr_1fr]";

/**
 * Request → Tasks tab list: search, owner photos, and Show more at 10+.
 */
export function RequestTasksList({ tasks }: { tasks: RequestTask[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? tasks.filter((task) => {
          const hay = [task.title, task.ownerName ?? "", task.planName ?? ""]
            .join(" ")
            .toLowerCase();
          return hay.includes(needle);
        })
      : tasks;

    const open = matched.filter((task) => !DONE.has(task.status.toLowerCase()));
    const done = matched.filter((task) => DONE.has(task.status.toLowerCase()));
    return [...open, ...done];
  }, [tasks, query]);

  /*
   * One section per Work Plan.
   *
   * Four hundred rows in one table is four hundred rows nobody can place:
   * six of them are called "Compile a shortlist of rental properties" and
   * nothing on the row said which plan each belonged to. A Request here
   * carries sixteen plans, and the question somebody brings to this tab is
   * almost always about one of them.
   *
   * Tasks on no stream belong to the Request itself rather than to a plan,
   * and they go last under a heading that says so instead of being quietly
   * filed under whichever plan came first.
   */
  const sections = useMemo(() => {
    const byPlan = new Map<string, { id: string; name: string; rows: RequestTask[] }>();
    const loose: RequestTask[] = [];

    for (const task of filtered) {
      if (!task.planId || !task.planName) {
        loose.push(task);
        continue;
      }
      const found = byPlan.get(task.planId);
      if (found) found.rows.push(task);
      else byPlan.set(task.planId, { id: task.planId, name: task.planName, rows: [task] });
    }

    const plans = [...byPlan.values()].sort((a, b) => b.rows.length - a.rows.length);
    return loose.length > 0
      ? [...plans, { id: "", name: "On the Request itself", rows: loose }]
      : plans;
  }, [filtered]);

  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [shownIn, setShownIn] = useState<Record<string, number>>({});
  /* Three. A section is opened to look inside it, not to be handed the
     whole of it — forty-two rows is the wall this grouping replaced,
     rebuilt one heading lower. */
  const FIRST = 3;

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
          placeholder="Search tasks…"
          aria-label="Search tasks"
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
            ? `No tasks match “${query.trim()}”.`
            : "No tasks on this Request yet."}
        </div>
      ) : (
        <>
          {sections.map((section, index) => {
            /* Nothing chosen yet means the first, which is the plan with the
               most on it. A search opens everything it matched, because a
               closed section hiding the hit is a search that looks broken. */
            const open = query.trim()
              ? true
              : openPlan === null
                ? index === 0
                : openPlan === section.id;
            const upTo = shownIn[section.id] ?? FIRST;

            return (
              <section
                key={section.id || "loose"}
                className="mb-2 overflow-hidden rounded-[12px] border"
                style={{
                  borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                  background: "var(--surface)",
                  boxShadow: "0 1px 2px rgba(31,72,125,.04)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenPlan(open ? "" : section.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-soft)]"
                  style={open ? { background: "var(--surface-soft)" } : undefined}
                >
                  <span
                    aria-hidden
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border text-[11px]"
                    style={{
                      borderColor: open ? "var(--accent)" : "var(--border-strong)",
                      background: open ? "var(--accent-tint)" : "var(--surface)",
                      color: open ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    {open ? "▾" : "▸"}
                  </span>

                  <span className="min-w-0 truncate text-[13.5px] font-semibold">
                    {section.name}
                  </span>

                  <span
                    className="shrink-0 rounded-full px-2 py-[2px] text-[11.5px] tabular-nums"
                    style={{ background: "var(--surface-active)", color: "var(--text-secondary)" }}
                  >
                    {section.rows.length}
                  </span>
                </button>

                <div hidden={!open}>
                  <div
                    className={`grid ${COLUMNS} border-y px-4 py-2.5 text-[11.5px] font-semibold`}
                    style={{
                      borderColor: "var(--chrome-line)",
                      background: "var(--surface-soft)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <span>Task</span>
                    <span>Owner</span>
                    <span>Due</span>
                  </div>

                  {section.rows.slice(0, upTo).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}

                  {section.rows.length > upTo ? (
                    <button
                      type="button"
                      onClick={() =>
                        setShownIn((at) => ({ ...at, [section.id]: upTo + 20 }))
                      }
                      className="flex w-full items-center justify-center border-t px-4 py-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-soft)]"
                      style={{ borderColor: "var(--chrome-line)", color: "var(--accent)" }}
                    >
                      Show {section.rows.length - upTo} more
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/** One task's row, the same in every section. */
function TaskRow({ task }: { task: RequestTask }) {
  const complete = DONE.has(task.status.toLowerCase());
  const overdue = !complete && task.dueDate ? new Date(task.dueDate) < new Date() : false;

  return (
    <div
      className={`grid ${COLUMNS} items-center border-b px-4 py-3 text-[13.5px] last:border-b-0`}
      style={{ borderColor: "var(--chrome-line)" }}
    >
      <span
        className="min-w-0 truncate pr-4"
        style={
          complete
            ? { color: "var(--text-secondary)", textDecoration: "line-through" }
            : undefined
        }
      >
        {task.title}
      </span>

      {task.ownerName ? (
        <span title={task.ownerName} className="inline-flex min-w-0 items-center gap-2">
          <Avatar
            name={task.ownerName}
            src={task.ownerPhoto ?? undefined}
            size={26}
            className="text-[10px]"
          />
          <span className="min-w-0 truncate text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            {task.ownerName}
          </span>
        </span>
      ) : (
        <span className="text-[12px]" style={{ color: "var(--text-quiet)" }}>
          Unassigned
        </span>
      )}

      <span
        className="text-[12.5px]"
        style={{
          color: complete
            ? "var(--success-fg)"
            : overdue
              ? "var(--danger-fg)"
              : "var(--text-secondary)",
        }}
      >
        {complete
          ? "Done"
          : overdue
            ? "Overdue"
            : task.dueDate
              ? shortDate(task.dueDate)
              : "No date"}
      </span>
    </div>
  );
}

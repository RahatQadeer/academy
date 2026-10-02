"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SubmitPlain } from "@/base/components/Submit";
import { FilterSelect } from "@/whitbyos/components/FilterSelect";
import { SearchField } from "@/whitbyos/components/SearchField";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import { dismissConsideration } from "@/whitbyos/insights/actions";
import type { Consideration } from "@/whitbyos/lib/insights";

/* Inside a plan's own section every row shares its Request, so naming it
   on each one says nothing. The Work Stream is the part that differs, and
   it is what tells you where on the plan to go. */
const COLUMNS: Column[] = [
  { label: "Consideration", width: "3.4fr" },
  { label: "Type", width: "1.1fr" },
  { label: "Work Stream", width: "1.4fr" },
  { label: "Action", width: "1fr" },
];

/**
 * The list, filtered where the reader is rather than on the server.
 *
 * Search and the kind select were a GET form: every keystroke and every
 * choice was a navigation, and the whole page — counts, tiles, the lot —
 * was rebuilt before a single row moved. Picking "Risk / Backup" and
 * watching eighty-nine unfiltered rows sit there for a second reads as a
 * filter that does not work, and a filter somebody has stopped trusting is
 * worse than no filter.
 *
 * Every consideration is already on this page: the server fetched them all
 * to count them, and only thirteen were being drawn. So the filtering
 * happens here, against what is already in hand, and it happens on the
 * keystroke.
 *
 * The URL still says what is being looked at — written with `replaceState`,
 * which changes the address without asking the router to do anything, so a
 * refresh or a shared link still lands on the same view and nothing
 * re-renders to achieve it.
 */
/** How many plans are listed before the button, and how many each press adds. */
const PLANS = 6;

export function InsightsList({
  rows,
  typeLabel,
  typeTone,
  initialQuery,
  initialKind,
}: {
  rows: Consideration[];
  /** Passed in rather than imported: the label map lives in a server module. */
  typeLabel: Record<string, string>;
  typeTone: Record<string, { bg: string; fg: string }>;
  initialQuery: string;
  initialKind: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState(initialKind);
  /*
   * One plan open at a time.
   *
   * Five headings and a dozen rows under the one you chose is a page you
   * can work; five plans' worth of rows all at once is the wall this was
   * meant to replace. Null means "the first one", worked out below — the
   * plan with the most outstanding, which is the one that needs somebody.
   */
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  /*
   * Three to begin with, per plan.
   *
   * A plan with twenty-four still opens on a screenful rather than on
   * twenty-four: the point of folding these was that a section should be
   * something you can take in, and a section that fills three screens is
   * the wall again with a lid on it. Kept per plan, so opening a second one
   * does not reset the first.
   */
  const [openedUpTo, setOpenedUpTo] = useState<Record<string, number>>({});
  const FIRST = 3;

  /*
   * Six plans, then a button.
   *
   * Folding the rows fixed the wall inside a plan and left the wall of
   * plans: fifteen headings is a scroll before the filters at the top are
   * out of sight, and the ones worth opening are the first few — these
   * already run by how much is outstanding.
   */
  const [plansShown, setPlansShown] = useState(PLANS);

  const label = (type: string) => typeLabel[type] ?? "Consideration";
  const tone = (type: string) =>
    typeTone[type] ?? { bg: "var(--surface-active)", fg: "var(--text-secondary)" };

  /* Only the kinds that are actually here, so the select never offers one
     with nothing behind it. */
  const kinds = useMemo(() => {
    const seen = new Set(rows.map((row) => row.type));
    return [...seen].map((type) => ({ value: type, label: label(type) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, typeLabel]);

  /* A narrowed list is a different list, so it starts at six again —
     "Show 9 more" left over from the last search would be counting plans
     that are no longer there. Adjusted while rendering rather than in an
     effect, so the long list is never painted first. */
  const filters = `${query}\u0000${kind}`;
  const [filtersWere, setFiltersWere] = useState(filters);
  if (filters !== filtersWere) {
    setFiltersWere(filters);
    setPlansShown(PLANS);
  }

  const shortlist = useMemo(() => {
    const want = query.trim().toLowerCase();

    return rows
      .filter((row) => !kind || row.type === kind)
      .filter((row) => {
        if (!want) return true;
        return [row.body, label(row.type), row.requestTitle, row.streamName]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(want));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, kind, query, typeLabel]);

  /*
   * One section per work plan.
   *
   * Eighty-nine of these in one table is a wall: every row says something
   * different about something different, and nothing tells you which piece
   * of work it belongs to. Grouped, it is five plans of a dozen — and a
   * dozen about one plan can be read, decided on, and finished.
   *
   * The order the rows already carry is kept inside each group (newest
   * first), and the groups run by how many are outstanding, so the plan
   * that needs the most attention is the one you meet first.
   */
  const sections = useMemo(() => {
    const byPlan = new Map<string, { id: string; name: string; rows: Consideration[] }>();

    for (const row of shortlist) {
      const found = byPlan.get(row.planId);
      if (found) found.rows.push(row);
      else byPlan.set(row.planId, { id: row.planId, name: row.planName, rows: [row] });
    }

    /*
     * And what each one holds, by kind and biggest first, so a closed
     * section still says something about itself.
     */
    return [...byPlan.values()]
      .map((plan) => {
        const counted = new Map<string, number>();
        for (const row of plan.rows) counted.set(row.type, (counted.get(row.type) ?? 0) + 1);

        return {
          ...plan,
          kinds: [...counted.entries()]
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3),
        };
      })
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [shortlist]);

  /**
   * The address, kept in step without a navigation.
   *
   * `router.replace` would re-run the server component and undo the whole
   * point of filtering here. `history.replaceState` only rewrites the bar.
   */
  function remember(next: { q?: string; type?: string }) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const q = next.q ?? query;
    const type = next.type ?? kind;

    if (q.trim()) url.searchParams.set("q", q.trim());
    else url.searchParams.delete("q");
    if (type) url.searchParams.set("type", type);
    else url.searchParams.delete("type");

    window.history.replaceState(null, "", url.toString());
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <SearchField
          placeholder="Search insights…"
          label="Search insights"
          className="w-[260px]"
          defaultValue={initialQuery}
          onSearch={(value) => {
            setQuery(value);
            setOpenedUpTo({});
            remember({ q: value });
          }}
        />

        <FilterSelect
          name="type"
          value={kind}
          all="All kinds"
          options={kinds}
          onPick={(value) => {
            setKind(value);
            setOpenedUpTo({});
            remember({ type: value });
          }}
        />
      </div>

      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-[14px] font-semibold">Considerations needing attention</h2>
        <span className="text-[12px]" style={{ color: "var(--text-quiet)" }}>
          {shortlist.length === 1 ? "1 open" : `${shortlist.length} open`}
        </span>
      </div>

      {shortlist.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Nothing matches what you are looking for.
        </p>
      ) : (
        <>
          {sections.slice(0, plansShown).map((section, index) => {
            /* Nothing chosen yet means the first, which is the plan with
               the most outstanding on it. */
            const open = openPlan === null ? index === 0 : openPlan === section.id;

            return (
              <section
                key={section.id}
                className="mb-1.5 overflow-hidden rounded-[10px] border transition-shadow hover:shadow-[0_1px_6px_-3px_rgba(15,15,15,.2)]"
                style={{
                  borderColor: open ? "var(--border-strong)" : "var(--border)",
                  background: "var(--surface)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenPlan(open ? "" : section.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-soft)]"
                  style={open ? { background: "var(--surface-soft)" } : undefined}
                >
                  {/* A chevron in the faintest grey on the page, at 11px,
                      is a smudge — and it is the only thing saying these
                      fold at all. It gets a tile of its own, the accent
                      while it is open, and enough size to be aimed at. */}
                  <span
                    aria-hidden
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border text-[11px]"
                    style={{
                      borderColor: open ? "var(--accent)" : "var(--border-strong)",
                      background: open ? "var(--accent-tint)" : "var(--surface)",
                      color: open ? "var(--accent)" : "var(--text-secondary)",
                      transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 140ms ease",
                    }}
                  >
                    ▾
                  </span>

                  <span className="min-w-0 truncate text-[13.5px] font-semibold">
                    {section.name}
                  </span>

                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                    style={{ background: "var(--surface-active)", color: "var(--text-secondary)" }}
                  >
                    {section.rows.length}
                  </span>

                  {/*
                   * What is in it, without opening it.
                   *
                   * Fifteen rows of a name and a number tell you nothing
                   * about which one to press: a plan with four risks and a
                   * plan with four requirement notes looked identical. One
                   * chip per kind, in its colour, with how many — so the
                   * plan with something red on it is the one your eye goes
                   * to, which is the whole point of the screen.
                   */}
                  <span className="ml-auto flex min-w-0 shrink items-center justify-end gap-1.5 overflow-hidden">
                    {section.kinds.map((one) => (
                      <span
                        key={one.type}
                        title={`${one.count} ${label(one.type)}`}
                        className="hidden shrink-0 rounded-full px-2 py-[2px] text-[11px] font-medium tabular-nums sm:inline-block"
                        style={{ background: tone(one.type).bg, color: tone(one.type).fg }}
                      >
                        {one.count} {label(one.type)}
                      </span>
                    ))}
                  </span>
                </button>

                {/* Hidden rather than unmounted, so opening one that has
                    been read before is instant and the browser keeps its
                    place. */}
                <div hidden={!open} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <DataTable columns={COLUMNS} rowPadding={13}>
                    {section.rows.slice(0, openedUpTo[section.id] ?? FIRST).map((row) => (
                      <DataTableRow key={row.id}>
                        <DataTableCell emphasis="ink">{row.body}</DataTableCell>

                        {/* Its kind, in the colour its tile at the top of
                            the page wears. */}
                        <span className="min-w-0 pr-3">
                          <span
                            className="inline-block max-w-full truncate rounded-full px-2 py-[3px] text-[11.5px] font-medium"
                            style={{ background: tone(row.type).bg, color: tone(row.type).fg }}
                          >
                            {label(row.type)}
                          </span>
                        </span>

                        <DataTableCell>{row.streamName ?? "The plan as a whole"}</DataTableCell>

                        <span className="flex items-center justify-end gap-2">
                          <form action={dismissConsideration} className="flex">
                            <input type="hidden" name="consideration_id" value={row.id} />
                            <SubmitPlain
                              className="rounded-full px-2.5 py-[3px] text-[12px] font-medium transition-colors hover:bg-[var(--surface-active)]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              Dismiss
                            </SubmitPlain>
                          </form>
                          <Link
                            href={`/whitbyos/insights?open=${row.id}`}
                            className="rounded-full border px-2.5 py-[3px] text-[12px] font-medium no-underline transition-colors hover:bg-[var(--accent-tint)]"
                            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                          >
                            Review
                          </Link>
                        </span>
                      </DataTableRow>
                    ))}
                  </DataTable>

                  {section.rows.length > (openedUpTo[section.id] ?? FIRST) ? (
                    <button
                      type="button"
                      onClick={() =>
                        setOpenedUpTo((at) => ({
                          ...at,
                          [section.id]: (at[section.id] ?? FIRST) + 10,
                        }))
                      }
                      className="flex w-full items-center justify-center border-t px-4 py-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-soft)]"
                      style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                    >
                      Show {section.rows.length - (openedUpTo[section.id] ?? FIRST)} more
                    </button>
                  ) : null}

                  <div
                    className="border-t px-4 py-2.5"
                    style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                  >
                    <Link
                      href={`/whitbyos/work-plans/${section.id}`}
                      className="text-[12.5px] font-medium no-underline"
                      style={{ color: "var(--accent)" }}
                    >
                      Open {section.name} →
                    </Link>
                  </div>
                </div>
              </section>
            );
          })}

          {sections.length > plansShown ? (
            <button
              type="button"
              onClick={() => setPlansShown((at) => at + PLANS)}
              className="mt-1 flex w-full items-center justify-center rounded-[10px] border px-4 py-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-soft)]"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
                color: "var(--accent)",
              }}
            >
              Show {sections.length - plansShown} more{" "}
              {sections.length - plansShown === 1 ? "plan" : "plans"}
            </button>
          ) : null}
        </>
      )}
    </>
  );
}

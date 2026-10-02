import Link from "next/link";
import { Button } from "@/base/components/Button";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import { GenerateReportDialog } from "@/whitbyos/reports/components/GenerateReportDialog";
import { listReports, typeLabel, typeTone } from "@/whitbyos/lib/reports";
import { matchesSearch } from "@/whitbyos/lib/search";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { shortDate } from "@/whitbyos/lib/format";

const LIST = "/whitbyos/reports";

const COLUMNS: Column[] = [
  { label: "Report", width: "2.6fr" },
  { label: "Type", width: "1.2fr" },
  { label: "Client", width: "1.4fr" },
  { label: "Generated", width: "1.2fr" },
  { label: "Action", width: "1fr" },
];

const TABS = [
  { slug: "", label: "All" },
  { slug: "client_summary", label: "Client Summaries" },
  { slug: "activity", label: "Activity" },
  { slug: "scheduled", label: "Scheduled" },
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screen 15 — Reports, with 15.1 over it. */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tab = one(searchParams?.tab) ?? "";
  const q = (one(searchParams?.q) ?? "").trim();
  const adding = one(searchParams?.new) === "1";
  const error = one(searchParams?.error);
  const showClients = await usesClientWorkspaces();

  const [result, clients] = await Promise.all([
    listReports(),
    adding ? listClientOptions() : Promise.resolve([]),
  ]);

  const here = (slug = tab) => {
    const params = new URLSearchParams();
    if (slug) params.set("tab", slug);
    if (q) params.set("q", q);
    const search = params.toString();
    return search ? `${LIST}?${search}` : LIST;
  };

  /* The client to narrow to, and how many rows to draw. The tabs above
     already sort by kind, so the select answers the other question people
     come here with: whose reports are these. */
  const forClient = (one(searchParams?.client) ?? "").trim();

  const PAGE = 15;
  const shown = Number(one(searchParams?.show) ?? PAGE) || PAGE;

  const all = result.ok ? result.rows : [];

  const rows = all
    .filter((row) => {
      if (tab === "scheduled") return !row.generatedAt && row.scheduledFor;
      if (!tab) return true;
      return row.type === tab && row.generatedAt;
    })
    .filter((row) => !forClient || row.clientName === forClient)
    .filter((row) => matchesSearch(q, [row.title, typeLabel(row.type), row.clientName]));

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <PageHeader
        title="Reports"
        subtitle="A fixed statement about a period. It records what moved on the work between two dates, kept as it was so it can be sent and referred back to."
        size={22}
        gap={24}
        action={
          <Button unsized href={`${LIST}?new=1`} variant="primary" className="px-4 py-[9px] text-[13.5px]">
            + Generate Report
          </Button>
        }
      />

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Reports. Check your connection and try again. If this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Reports%20failed%20to%20load"
                variant="secondary"
                className="px-4 py-[9px]"
              >
                Contact support
              </Button>
              <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px]">
                Try again
              </Button>
            </>
          }
        />
      ) : result.rows.length === 0 ? (
        <StateMessage
          glyph="▥"
          title="No reports yet"
          description="A report is a fixed statement about a period. It records what moved on your work between two dates, kept as it was so it can be sent and referred back to."
          action={
            <Button unsized href={`${LIST}?new=1`} variant="primary" className="px-5 py-2.5 text-[13.5px]">
              + Generate Report
            </Button>
          }
        />
      ) : (
        <>
          {/* "Shared with Clients" stood here and counts `shared_with_client`,
              which nothing reads and, now that the button on 15.3 is gone,
              nothing can set either. A counter frozen at whatever it happened
              to reach says less than no counter. It comes back with the
              portal screen that makes sharing mean something. */}
          <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Stat
              glyph="▥"
              mark={{ bg: "var(--accent-tint)", fg: "var(--accent)" }}
              value={result.counts.thisMonth}
              label="Reports This Month"
            />
            <Stat
              glyph="◷"
              mark={{ bg: "var(--warning-bg)", fg: "var(--warning-fg)" }}
              value={result.counts.scheduled}
              label="Scheduled"
            />
          </div>

          <Months rows={all} />

          <div className="mb-5 flex gap-2">
            {(showClients ? TABS : TABS.filter((item) => item.slug !== "client_summary")).map((item) => {
              const on = item.slug === tab;
              return (
                <Link
                  key={item.label}
                  href={here(item.slug)}
                  className="rounded-control border px-2.5 py-1 text-[12.5px] no-underline"
                  style={
                    on
                      ? {
                          borderColor: "var(--accent)",
                          color: "var(--accent)",
                          background: "var(--accent-tint-mid)",
                        }
                      : { borderColor: "var(--border)", color: "var(--text-secondary)" }
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <FilterBar
            action={LIST}
            searchPlaceholder="Search reports…"
            searchValue={q}
            hidden={{ tab: tab || undefined }}
            selects={
              showClients
                ? [
                    {
                      name: "client",
                      anyLabel: "All clients",
                      value: forClient,
                      /* Built from the reports themselves, so it never
                         offers a client with nothing to show. */
                      options: [...new Set(all.map((row) => row.clientName).filter(Boolean))]
                        .sort()
                        .map((name) => ({ value: name as string, label: name as string })),
                    },
                  ]
                : []
            }
          />

          {rows.length === 0 ? (
            <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              {q ? `Nothing matches “${q}”.` : "Nothing of this kind yet."}
            </p>
          ) : (
            <>
            <DataTable columns={showClients ? COLUMNS : COLUMNS.filter((column) => column.label !== "Client")} rowPadding={13}>
              {rows.slice(0, shown).map((row) => (
                <DataTableRow key={row.id} href={`${LIST}/${row.id}`}>
                  <DataTableCell emphasis="strong">{row.title}</DataTableCell>

                  {/* Its kind, in its own colour — three rows with the same
                      title are otherwise told apart by their date alone. */}
                  <span className="min-w-0 pr-3">
                    <span
                      className="inline-block max-w-full truncate rounded-full px-2 py-[3px] text-[11.5px] font-medium"
                      style={
                        row.generatedAt
                          ? { background: typeTone(row.type).bg, color: typeTone(row.type).fg }
                          : { background: "var(--warning-bg)", color: "var(--warning-fg)" }
                      }
                    >
                      {row.generatedAt ? typeLabel(row.type) : "Scheduled"}
                    </span>
                  </span>
                  {showClients ? (
                    <DataTableCell>{row.clientName ?? "All Clients"}</DataTableCell>
                  ) : null}
                  <DataTableCell emphasis="muted">
                    {row.generatedAt
                      ? shortDate(row.generatedAt)
                      : `Next: ${shortDate(row.scheduledFor)}`}
                  </DataTableCell>
                  {/* The row already opens on a press — this says so rather
                      than sitting there as a word that looks clickable and
                      is not. */}
                  <span className="flex items-center justify-end">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[12px] font-medium"
                      style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                    >
                      {row.generatedAt ? "Open" : "Edit"}
                      <span aria-hidden>→</span>
                    </span>
                  </span>
                </DataTableRow>
              ))}
            </DataTable>

            {/* Fifteen is a screenful. The rest on a press, adding to what
                is there rather than turning a page — somebody reading down
                a list wants the next few under the ones they have read. */}
            {rows.length > shown ? (
              <div className="mt-3 flex justify-center">
                <Link
                  href={`${here()}${here().includes("?") ? "&" : "?"}show=${shown + PAGE}${forClient ? `&client=${encodeURIComponent(forClient)}` : ""}`}
                  className="rounded-full border px-3 py-[5px] text-[12px] font-medium no-underline transition-colors hover:bg-[var(--accent-tint)]"
                  style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}
                >
                  Show {rows.length - shown} more
                </Link>
              </div>
            ) : null}
            </>
          )}
        </>
      )}

      {adding ? (
        <GenerateReportDialog clients={clients} closeHref={here()} error={error} />
      ) : null}

      {one(searchParams?.scheduled) ? (
        <Toast
          title="Report scheduled"
          detail="It is on the list. Nothing runs on a timer yet, so it will need generating on the day."
          closeHref={here()}
        />
      ) : null}
    </div>
  );
}

function Stat({
  glyph,
  mark,
  value,
  label,
}: {
  glyph: string;
  mark: { bg: string; fg: string };
  value: number;
  label: string;
}) {
  /* Nothing to report is not a failure. A nought in full black beside a
     coloured tile reads as a broken counter, so an empty one steps back and
     the eye lands on the tiles that have something in them. */
  const empty = value === 0;

  /* The figure and what it counts, side by side. Stacked, each card was
     most of the way to a hundred pixels tall to carry one digit, and three
     of them pushed the list itself below the fold. */
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-3">
      <span
        aria-hidden
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[12px]"
        style={
          empty
            ? { background: "var(--surface-active)", color: "var(--text-quiet)" }
            : { background: mark.bg, color: mark.fg }
        }
      >
        {glyph}
      </span>

      <div className="min-w-0">
        <div
          className="text-[19px] font-bold leading-none tabular-nums"
          style={{ color: empty ? "var(--text-quiet)" : "var(--ink)" }}
        >
          {value}
        </div>
        <div className="mt-1 truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Six months of reporting, above the list.
 *
 * The page opened on three counters and a table of titles, which answers
 * "how many" and "which" and never answers the question somebody comes to a
 * Reports screen with: are we still doing this. A month with nothing in it
 * is the finding here, and a column of dates cannot show it — you have to
 * read fifteen rows and work out what is missing.
 *
 * Read off the reports themselves, by the day each was generated. A report
 * that has not been produced is not on here: it is scheduled, and the
 * counter above already says how many.
 */
function Months({ rows }: { rows: { generatedAt: string | null }[] }) {
  const now = new Date();

  const months = Array.from({ length: 6 }, (_, step) => {
    const when = new Date(now.getFullYear(), now.getMonth() - (5 - step), 1);
    return {
      key: `${when.getFullYear()}-${when.getMonth()}`,
      label: when.toLocaleDateString("en-GB", { month: "short" }),
      year: when.getFullYear(),
      count: 0,
    };
  });

  const at = new Map(months.map((month) => [month.key, month]));
  for (const row of rows) {
    if (!row.generatedAt) continue;
    const when = new Date(row.generatedAt);
    const month = at.get(`${when.getFullYear()}-${when.getMonth()}`);
    if (month) month.count += 1;
  }

  const most = Math.max(1, ...months.map((month) => month.count));
  const total = months.reduce((n, month) => n + month.count, 0);

  /* Nothing in half a year is a screen with six empty columns on it, which
     says less than the sentence the empty state already says. */
  if (total === 0) return null;

  return (
    <div className="mb-5 rounded-[10px] border border-line bg-surface px-4 py-3">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[12.5px] font-semibold">Reports generated</h2>
        <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
          {total === 1 ? "1 in the last six months" : `${total} in the last six months`}
        </span>
      </div>

      <div className="flex items-end gap-2 sm:gap-4">
        {months.map((month) => {
          const empty = month.count === 0;
          /* A track the same height every month, filled from the bottom.
             Drawn as bare bars, an empty month was a three-pixel line
             stretched the width of the column, which reads as a rule on the
             card rather than as a month with nothing in it.

             Narrow, because a bar as wide as a sixth of the page is a slab
             rather than a bar: what the eye is meant to compare is the
             heights, and width that carries no meaning fights them. */
          const fill = empty ? 0 : Math.max(6, Math.round((month.count / most) * 40));

          return (
            <div key={month.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full max-w-[42px] overflow-hidden rounded-[6px]"
                style={{ height: 40, background: "var(--surface-active)" }}
                title={`${month.count} in ${month.label} ${month.year}`}
              >
                <div
                  className="w-full rounded-[6px]"
                  style={{
                    marginTop: 40 - fill,
                    height: fill,
                    background: "var(--accent)",
                    opacity: 0.45 + 0.55 * (month.count / most),
                  }}
                />
              </div>

              <div className="text-center leading-tight">
                <div
                  className="text-[12px] font-semibold tabular-nums"
                  style={{ color: empty ? "var(--text-quiet)" : "var(--ink)" }}
                >
                  {month.count}
                </div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {month.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

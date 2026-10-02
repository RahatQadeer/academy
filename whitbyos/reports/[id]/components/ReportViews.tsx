import Link from "next/link";
import { shortDate } from "@/whitbyos/lib/format";
import { initialsOf } from "@/whitbyos/lib/contact-vocab";
import type { ReportMetrics, StreamLine, TaskLine, WeekBar } from "@/whitbyos/lib/reports";

export const REPORT_VIEWS = [
  { slug: "", label: "Charts" },
  { slug: "kanban", label: "Kanban" },
  { slug: "timeline", label: "Timeline" },
] as const;

export type ReportView = (typeof REPORT_VIEWS)[number]["slug"];

/**
 * 15.3, 15.3b and 15.3c are one screen with three views of the same streams,
 * and the reference draws the switch as a segmented control, not tabs.
 */
export function ReportViewTabs({ here, view }: { here: string; view: ReportView }) {
  return (
    <div
      className="mb-4 flex w-fit gap-1 rounded-[8px] p-0.5"
      style={{ background: "var(--canvas)" }}
    >
      {REPORT_VIEWS.map((tab) => {
        const on = tab.slug === view;
        return (
          <Link
            key={tab.label}
            href={tab.slug ? `${here}?view=${tab.slug}` : here}
            className="rounded-[6px] px-3.5 py-1.5 text-[13.5px] no-underline"
            style={
              on
                ? {
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontWeight: 600,
                    boxShadow: "0 1px 2px rgba(15,15,15,.08)",
                  }
                : { color: "var(--text-secondary)" }
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/** 15.3b's four columns, left to right, each with the colour it is drawn in. */
const COLUMNS = [
  { key: "not_started", label: "Not Started", colour: "var(--text-disabled)" },
  { key: "running", label: "Running", colour: "var(--accent)" },
  { key: "waiting", label: "Awaiting Client", colour: "var(--warning-fg)" },
  { key: "complete", label: "Complete", colour: "var(--success-fg)" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

/** A report stores whatever the status column held when it was generated. */
function column(status: string): ColumnKey {
  if (["complete", "completed", "done"].includes(status)) return "complete";
  if (["waiting", "waiting_on_client", "approval", "blocked"].includes(status)) return "waiting";
  if (["not_started", "planned", ""].includes(status)) return "not_started";
  return "running";
}

/** The pill 15.3b puts beside a stream's name — how it is going, in a word. */
function health(row: StreamLine): { label: string; tone: keyof typeof TONES } {
  if (row.blocked || row.blockedTasks > 0) return { label: "At risk", tone: "bad" };
  if (column(row.status) === "complete") return { label: "On time", tone: "good" };
  if (column(row.status) === "waiting") return { label: "Approval", tone: "warn" };
  if (row.complete === 0) return { label: "Not started", tone: "quiet" };
  return { label: "Running", tone: "quiet" };
}

const TONES = {
  good: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
  warn: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  bad: { bg: "var(--danger-action-bg)", fg: "var(--danger-action-fg)" },
  quiet: { bg: "var(--canvas)", fg: "var(--text-muted)" },
};

/**
 * Screen 15.3b — the same Work Streams, grouped by status.
 *
 * Everything is read from what the report stored when it was generated and
 * nothing is looked up live: a report is a statement about a period that
 * somebody may already have sent to a client, so a card that changed afterwards
 * would be a different report wearing the same name.
 *
 * Two rows the reference draws are absent and cannot be filled: the provider
 * against a stream, and its budget. A work stream records no provider, and the
 * product records no money at all — so there is nothing to capture at
 * generation and nothing to show here.
 */
export function ReportKanban({
  streams,
  from,
  to,
}: {
  streams: StreamLine[];
  from: string | null;
  to: string | null;
}) {
  const totals = streams.reduce(
    (sum, row) => ({
      tasks: sum.tasks + row.tasks,
      complete: sum.complete + row.done,
      atRisk: sum.atRisk + (row.blocked || row.blockedTasks > 0 ? 1 : 0),
      blocked: sum.blocked + row.blockedTasks,
    }),
    { tasks: 0, complete: 0, atRisk: 0, blocked: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-control border border-line-strong px-3 py-1.5 text-[13px]"
            style={{ background: "var(--surface)" }}
          >
            Group by <strong className="font-semibold">Status</strong>
          </span>
          {from && to ? (
            <span
              className="rounded-control border border-line-strong px-3 py-1.5 text-[13px]"
              style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
            >
              {shortDate(from)} – {shortDate(to)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
          <span style={{ color: "var(--text-secondary)" }}>
            {totals.tasks} task{totals.tasks === 1 ? "" : "s"} ·{" "}
            <strong style={{ color: "var(--ink)" }}>{totals.complete} complete</strong>
          </span>
          {totals.atRisk > 0 ? (
            <span style={{ color: "var(--warning-fg)" }}>
              {totals.atRisk} stream{totals.atRisk === 1 ? "" : "s"} at risk
            </span>
          ) : null}
          {totals.blocked > 0 ? (
            <span style={{ color: "var(--danger-action-fg)" }}>
              {totals.blocked} blocked task{totals.blocked === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        {COLUMNS.map((col) => {
          const rows = streams.filter((row) => column(row.status) === col.key);

          return (
            <div
              key={col.key}
              className="flex flex-col gap-2.5 rounded-card p-3"
              style={{ background: "var(--surface-subtle)" }}
            >
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: col.colour }}
                    aria-hidden
                  />
                  <span className="text-[13px] font-semibold">{col.label}</span>
                  <span
                    className="rounded-[4px] px-1.5 text-[11.5px]"
                    style={{ background: "var(--canvas)", color: "var(--text-tertiary)" }}
                  >
                    {rows.length}
                  </span>
                </span>
                <span
                  className="h-[2px] rounded-[1px]"
                  style={{ background: col.colour, opacity: rows.length ? 1 : 0.25 }}
                />
              </div>

              {rows.length === 0 ? (
                <span
                  className="px-1 py-4 text-center text-[12px]"
                  style={{ color: "var(--text-quiet)" }}
                >
                  Nothing here
                </span>
              ) : (
                <>
                  {rows.slice(0, FIRST_CARDS).map((row, index) => (
                    <KanbanCard key={`${row.name}-${index}`} row={row} colour={col.colour} />
                  ))}

                  {/* Twenty-five cards in one column is a column nobody
                      reaches the bottom of, and Not Started is always the
                      long one. A press rather than a scroll, and on
                      <details> so a printed or scripts-off page still has
                      them. */}
                  {rows.length > FIRST_CARDS ? (
                    <details className="group">
                      <summary
                        className="cursor-pointer list-none rounded-[7px] border px-2 py-1.5 text-center text-[11.5px] font-medium transition-colors hover:bg-[var(--surface)] [&::-webkit-details-marker]:hidden"
                        style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                      >
                        <span className="group-open:hidden">
                          Show the other {rows.length - FIRST_CARDS}
                        </span>
                        <span className="hidden group-open:inline">Show fewer</span>
                      </summary>

                      <div className="mt-2.5 flex flex-col gap-2.5">
                        {rows.slice(FIRST_CARDS).map((row, index) => (
                          <KanbanCard
                            key={`${row.name}-rest-${index}`}
                            row={row}
                            colour={col.colour}
                          />
                        ))}
                      </div>
                    </details>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** How many cards stand in a column before the rest are folded away. */
const FIRST_CARDS = 6;

/**
 * One stream, as a card on 15.3b.
 *
 * Shorter than it was, because most of what it carried said the same thing
 * twice. A stream nobody has started drew a bar at 0%, then "0%", then a
 * "0 done" chip and a "3 planned" chip, then "3 tasks" along the bottom:
 * five statements of one fact, on a card, in a column of twenty-five.
 *
 * What is left is the bar with the ratio beside it, whatever is actually
 * running or blocked, and the next action — the only line on here that is
 * not derivable from the others.
 */
function KanbanCard({ row, colour }: { row: StreamLine; colour: string }) {
  const state = health(row);

  return (
    <div
      className="flex flex-col gap-2 rounded-card bg-surface p-2.5"
      style={{ borderLeft: `3px solid ${colour}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-tight">{row.name}</span>
          {row.plan ? (
            <span
              className="mt-[2px] block max-w-full truncate text-[10.5px] leading-[1.4]"
              style={{ color: "var(--text-quiet)" }}
              title={row.plan}
            >
              {row.plan}
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className="rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-medium"
            style={{ background: TONES[state.tone].bg, color: TONES[state.tone].fg }}
          >
            {state.label}
          </span>
          {row.owner ? <Avatar name={row.owner} /> : null}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="h-1.5 flex-1 overflow-hidden rounded-[3px]"
          style={{ background: "var(--canvas)" }}
        >
          <span
            className="block h-full rounded-[3px]"
            style={{ width: `${row.complete}%`, background: colour }}
          />
        </span>
        <span
          className="shrink-0 whitespace-nowrap text-[11px] tabular-nums"
          style={{ color: "var(--text-tertiary)" }}
        >
          {row.done}/{row.tasks}
        </span>
        <span className="shrink-0 text-[12px] font-semibold tabular-nums">{row.complete}%</span>
      </div>

      {/* Only the kinds worth a second look. "0 done" and "3 planned" are
          the bar and the ratio again, in words. */}
      {row.running > 0 || row.blockedTasks > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {row.running > 0 ? <Chip label={`${row.running} running`} tone="info" /> : null}
          {row.blockedTasks > 0 ? (
            <Chip label={`${row.blockedTasks} blocked`} tone="bad" />
          ) : null}
        </div>
      ) : null}

      {row.nextAction || row.targetDate ? (
        <span
          className="flex gap-1.5 text-[11.5px] leading-snug"
          style={{ color: "var(--text-secondary)" }}
        >
          <span aria-hidden className="shrink-0" style={{ color: "var(--text-disabled)" }}>
            ◈
          </span>
          {[row.nextAction, row.targetDate ? shortDate(row.targetDate) : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      ) : null}
    </div>
  );
}

/** The zoom the column headings are drawn at. 15.3c's Week / Month / Quarter. */
export type Zoom = "week" | "month" | "quarter";
const ZOOMS: { slug: Zoom; label: string }[] = [
  { slug: "week", label: "Week" },
  { slug: "month", label: "Month" },
  { slug: "quarter", label: "Quarter" },
];

/**
 * Screen 15.3c — the streams laid out across the period the report covers.
 *
 * A stream records a target date but no start of its own, so its bar begins
 * where its Work Plan does. The tasks under it are the ones the report stored,
 * placed on their due dates, and a stream opens to show them.
 *
 * The columns are measured, not divided evenly. A report running 10 September
 * to 7 October covers three weeks of one month and one of the next; equal
 * columns would put the OCTOBER heading in the middle of September and every
 * bar would read a fortnight early.
 *
 * "Show dependencies" joins a task to the one it waits on. Only where both
 * ends are dated — a line between two unknown positions would be drawn from
 * nowhere to nowhere.
 */
export function ReportTimeline({
  streams,
  from,
  to,
  open,
  zoom,
  deps,
  bareOpen,
  here,
}: {
  streams: StreamLine[];
  from: string | null;
  to: string | null;
  /** Which stream is expanded to show its tasks. */
  open: string | null;
  zoom: string | null;
  /** "0" hides the dependency joins; anything else leaves them on. */
  deps: string | null;
  /** "1" unfolds the streams that carry no date at all. */
  bareOpen: boolean;
  here: string;
}) {
  const showDeps = deps !== "0";
  const start = from ? new Date(from).getTime() : null;
  const end = to ? new Date(to).getTime() : null;
  const span = start !== null && end !== null && end > start ? end - start : null;

  const at = (date: string | null) =>
    span !== null && date
      ? Math.min(100, Math.max(0, ((new Date(date).getTime() - start!) / span) * 100))
      : null;

  const grain: Zoom = ZOOMS.some((row) => row.slug === zoom) ? (zoom as Zoom) : "month";
  const columns = span !== null ? columnsFor(new Date(from!), new Date(to!), grain) : [];
  // The labelled columns are months; the reference rules the weeks inside them
  // too, which is what lets you read a bar off the chart instead of off its
  // label. One step finer than whatever is being counted.
  const ticks = span !== null ? ticksFor(new Date(from!), new Date(to!), grain) : [];

  const todayIso = new Date().toISOString().slice(0, 10);
  // `at()` clamps to 0–100, so a today outside the period came back as 0 and
  // was drawn hard against the left edge — a line saying the report starts
  // today when it starts in a week. Marked only when it genuinely falls inside.
  const inPeriod = from !== null && to !== null && todayIso >= from && todayIso <= to;
  const today = inPeriod ? at(todayIso) : null;

  // 33 streams across 9 Work Plans, 20 of them with no date anywhere — the
  // chart was mostly empty lanes with the handful that plot lost among them.
  // The dated ones come first and in the order they happen, which is what a
  // timeline is for; the rest are counted and folded away behind one line.
  const ordered = streams
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.startDate !== null || row.targetDate !== null)
    .sort((a, b) => {
      const left = a.row.startDate ?? a.row.targetDate ?? "";
      const right = b.row.startDate ?? b.row.targetDate ?? "";
      if (left !== right) return left < right ? -1 : 1;
      return a.index - b.index;
    });

  const bare = streams
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.startDate === null && row.targetDate === null);

  const showBare = open !== null && bare.some(({ index }) => String(index) === open);

  const tail = `${open !== null ? `&open=${open}` : ""}${showDeps ? "" : "&deps=0"}`;
  const link = (next: Zoom) => `${here}?view=timeline&zoom=${next}${tail}`;
  const depsLink = `${here}?view=timeline&zoom=${grain}${
    open !== null ? `&open=${open}` : ""
  }${showDeps ? "&deps=0" : ""}`;

  const DAY = 86_400_000;
  const days = span !== null ? Math.round(span / DAY) + 1 : null;
  const elapsed =
    days === null
      ? 0
      : Math.min(days, Math.max(0, Math.round((Date.now() - start!) / DAY) + 1));

  const milestones = streams.filter((row) => row.targetDate).length;
  const hit = streams.filter((row) => row.targetDate && row.complete === 100).length;
  const onSchedule = streams.filter((row) => !row.blocked && row.blockedTasks === 0).length;
  const next = streams
    .filter((row) => row.targetDate && row.complete < 100)
    .sort((a, b) => (a.targetDate! < b.targetDate! ? -1 : 1))[0];

  return (
    <div className="flex flex-col gap-3">
      {/* The four figures read before the chart, not after it. They were
          under it, which on a timeline of thirty-three lanes meant the
          sentence saying how much of the period is gone came after the
          period. */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        {/* The reference's first card is the period, not a count of the rows
            already listed below it. */}
        <StatCard
          label="Period elapsed"
          value={days === null ? "No period" : `${elapsed} of ${days} days`}
          note={
            from && to
              ? todayIso > to
                ? `${shortDate(from)} – ${shortDate(to)} window closed`
                : todayIso < from
                  ? `Opens ${shortDate(from)}`
                  : `${shortDate(from)} – ${shortDate(to)} window open`
              : "No period set"
          }
        />
        <StatCard
          label="On schedule"
          value={`${onSchedule} of ${streams.length} streams`}
          tone={onSchedule < streams.length ? "warn" : "plain"}
          note={
            onSchedule === streams.length
              ? "Nothing flagged"
              : `${streams.length - onSchedule} at risk or blocked`
          }
        />
        <StatCard
          label="Milestones hit"
          value={milestones === 0 ? "None set" : `${hit} of ${milestones}`}
          tone={milestones > 0 && hit < milestones ? "warn" : "plain"}
          note={milestones === 0 ? "No stream has a target date" : "Streams with a target date"}
        />
        <StatCard
          label="Next milestone"
          value={next?.targetDate ? shortDate(next.targetDate) : "None due"}
          note={next?.name ?? "Nothing outstanding"}
        />
      </div>

      <div className="rounded-card border border-line bg-surface px-4 py-3.5">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="flex items-center gap-0.5 rounded-control border border-line p-0.5"
              style={{ background: "var(--canvas)" }}
            >
              {ZOOMS.map((row) => (
                <Link
                  key={row.slug}
                  href={link(row.slug)}
                  scroll={false}
                  aria-current={grain === row.slug ? "true" : undefined}
                  className="rounded-[5px] px-2.5 py-[5px] text-[12.5px] font-medium no-underline"
                  style={
                    grain === row.slug
                      ? { background: "var(--ink)", color: "var(--surface)" }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  {row.label}
                </Link>
              ))}
            </span>

            {/* Only offered when it goes somewhere. Outside the period there is
                no today marker on the chart to jump to. */}
            {inPeriod ? (
              <a
                href="#report-today"
                className="rounded-control px-2.5 py-[5px] text-[12.5px] font-medium no-underline"
                style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
              >
                Jump to today
              </a>
            ) : null}

            <Link
              href={depsLink}
              scroll={false}
              aria-pressed={showDeps}
              className="rounded-control border px-2.5 py-[5px] text-[12.5px] font-medium no-underline"
              style={{
                borderColor: "var(--border-strong)",
                color: showDeps ? "var(--ink)" : "var(--text-tertiary)",
              }}
            >
              Show dependencies {showDeps ? "✓" : ""}
            </Link>

            <span className="text-[12.5px]" style={{ color: "var(--text-quiet)" }}>
              {from && to ? `${shortDate(from)} – ${shortDate(to)}` : "No period set"}
              {from && to && !inPeriod
                ? todayIso < from
                  ? " · not started yet"
                  : " · period has closed"
                : ""}
            </span>
          </div>

        </div>

        <div className="overflow-x-auto">
          <div className={grain === "week" ? "min-w-[1240px]" : "min-w-[860px]"}>
            {columns.length > 0 ? (
              <>
                {today !== null ? (
                  <div className="grid gap-3 [grid-template-columns:240px_1fr_136px]">
                    <span />
                    <span className="relative block h-[22px]">
                      <span
                        id="report-today"
                        className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap rounded-[4px] px-1.5 py-[3px] text-[10.5px] font-semibold"
                        style={{
                          left: `${today}%`,
                          background: "var(--danger-solid)",
                          color: "#fff",
                        }}
                      >
                        Today · {shortDate(todayIso)}
                      </span>
                    </span>
                  </div>
                ) : null}

                <div className="mb-1.5 grid gap-3 [grid-template-columns:240px_1fr_136px]">
                  <span />
                  <span className="relative block h-[18px]">
                    {columns.map((column) => (
                      <span
                        key={column.key}
                        className="absolute top-0 h-full border-l border-line pl-2 text-[11px] font-semibold uppercase tracking-[0.05em]"
                        style={{ left: `${column.left}%`, color: "var(--text-tertiary)" }}
                      >
                        {column.label}
                      </span>
                    ))}
                  </span>
                </div>
              </>
            ) : null}

            <div className="relative flex flex-col gap-1.5">
              {/* The grid and the today line belong to the chart column, not to
                  the whole row, otherwise both run under the stream names. */}
              <span
                className="pointer-events-none absolute inset-y-0 right-[148px] left-[252px] z-10"
                aria-hidden
              >
                {ticks.map((tick) => (
                  <span
                    key={`tick-${tick.key}`}
                    className="absolute inset-y-0 border-l"
                    style={{ left: `${tick.left}%`, borderColor: "var(--border)" }}
                  />
                ))}
                {columns.map((column) => (
                  <span
                    key={column.key}
                    className="absolute inset-y-0 border-l"
                    style={{ left: `${column.left}%`, borderColor: "var(--border-strong)" }}
                  />
                ))}
                {today !== null ? (
                  <span
                    className="absolute inset-y-0 border-l border-dashed"
                    style={{ left: `${today}%`, borderColor: "var(--danger-solid)" }}
                  />
                ) : null}
              </span>

              {[...ordered, ...(showBare || bareOpen ? bare : [])].map(({ row, index }) => {
                const isOpen = open === String(index);
                // A bar drawn full width because nothing is known says the
                // stream ran the whole period, which is a claim rather than a
                // gap. Where neither date exists it is drawn as an empty lane
                // and said so.
                const undated = row.startDate === null && row.targetDate === null;
                const barStart = at(row.startDate) ?? 0;
                const barEnd = at(row.targetDate) ?? 100;
                const width = Math.max(2, barEnd - barStart);
                const colour =
                  row.complete === 100
                    ? "var(--success-fg)"
                    : row.complete > 0
                      ? "var(--accent)"
                      : "var(--border-strong)";

                // `at()` clamps into the period, which is right for a stream
                // that overruns it and wrong for one that misses it entirely:
                // both of its ends land on the same edge and the bar becomes a
                // 2% sliver hard against the frame, saying nothing.
                const startMs = row.startDate ? new Date(row.startDate).getTime() : null;
                const endMs = row.targetDate ? new Date(row.targetDate).getTime() : null;
                const outside =
                  span !== null &&
                  ((endMs !== null && endMs < start!) || (startMs !== null && startMs > end!));

                // A stream that runs past either edge is squared off there, so
                // the frame does not read as the day the work stopped.
                const runsInFrom = startMs !== null && start !== null && startMs < start;
                const runsOutTo = endMs !== null && end !== null && endMs > end;

                return (
                  <div
                    key={`${row.name}-${index}`}
                    className="flex flex-col gap-1.5 rounded-[5px] transition-colors hover:bg-[var(--canvas)]"
                  >
                    <div className="grid items-center gap-3 [grid-template-columns:240px_1fr_136px]">
                      <Link
                        href={
                          isOpen
                            ? `${here}?view=timeline&zoom=${grain}`
                            : `${here}?view=timeline&zoom=${grain}&open=${index}`
                        }
                        scroll={false}
                        className="flex min-w-0 items-center gap-2 no-underline"
                        style={{ color: "var(--ink)" }}
                      >
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--text-disabled)" }}
                          aria-hidden
                        >
                          {row.taskLines.length > 0 ? (isOpen ? "▾" : "▸") : "·"}
                        </span>
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                          style={{ background: colour }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold">
                            {row.name}
                          </span>
                          {row.plan ? (
                            <span
                              className="block truncate text-[10.5px]"
                              style={{ color: "var(--text-quiet)" }}
                            >
                              {row.plan}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className="shrink-0 text-[11.5px] tabular-nums"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {row.done}/{row.tasks} · {row.complete}%
                        </span>
                      </Link>

                      <span
                        className="relative h-[22px] rounded-[5px]"
                        style={{ background: "var(--surface-soft)" }}
                      >
                        {undated || outside ? null : (
                          <>
                            <span
                              className="absolute inset-y-[3px] z-20 rounded-[4px]"
                              style={{
                                left: `${barStart}%`,
                                width: `${width}%`,
                                borderTopLeftRadius: runsInFrom ? 0 : undefined,
                                borderBottomLeftRadius: runsInFrom ? 0 : undefined,
                                borderTopRightRadius: runsOutTo ? 0 : undefined,
                                borderBottomRightRadius: runsOutTo ? 0 : undefined,
                                background: colour,
                                // Worked out from the tasks rather than set on
                                // the stream. A dashed outline said so and
                                // emptied the chart out doing it — nearly every
                                // bar here is derived, so nearly every bar was
                                // hollow. Same colour, carrying less weight.
                                ...(row.datesFromTasks ? { opacity: 0.55 } : {}),
                              }}
                            />
                            {/* The diamond marks a date somebody committed
                                to. A span worked out from task due dates is
                                not one, so it does not get one. */}
                            {row.targetDate && !row.datesFromTasks ? (
                              <span
                                className="absolute top-1/2 z-20 -translate-y-1/2 text-[10px]"
                                style={{ left: `calc(${barEnd}% - 4px)`, color: "var(--ink)" }}
                                aria-hidden
                              >
                                ◆
                              </span>
                            ) : null}
                          </>
                        )}
                      </span>

                      {/*
                        * The dates read down a column, not across the chart.
                        *
                        * Each span used to be printed in the lane at the end
                        * of its own bar, so thirteen rows put thirteen pieces
                        * of text at thirteen different places, each one
                        * crossing the month rules behind it. Nothing lined up
                        * with anything, and a row whose bar reached the
                        * right-hand edge had its dates tucked back inside the
                        * bar in white — a different position and a different
                        * colour from the row above it.
                        *
                        * In a column of their own they are read off in one
                        * downward glance, and the chart keeps only what a
                        * chart is for: where the bar sits.
                        */}
                      <span
                        className="flex flex-col justify-center whitespace-nowrap text-[10.5px] leading-[1.35] tabular-nums"
                        style={{ color: "var(--text-quiet)" }}
                      >
                        {undated ? (
                          "No dates set"
                        ) : (
                          <>
                            <span>
                              {runsInFrom ? "‹ " : ""}
                              {row.startDate ? shortDate(row.startDate) : "no start"} –{" "}
                              {row.targetDate ? shortDate(row.targetDate) : "no target"}
                              {runsOutTo ? " ›" : ""}
                            </span>
                            {/* "from tasks" was on nearly every row, which is
                                the faded fill the key already names. Only the
                                two that change how the row is read survive. */}
                            {outside ? (
                              <span style={{ color: "var(--text-disabled)" }}>
                                outside this period
                              </span>
                            ) : runsOutTo || runsInFrom ? (
                              <span style={{ color: "var(--text-disabled)" }}>
                                runs past this period
                              </span>
                            ) : null}
                          </>
                        )}
                      </span>
                    </div>

                    {isOpen ? (
                      <div className="relative flex flex-col gap-1.5">
                        {showDeps ? (
                          <DependencyJoins tasks={row.taskLines} at={at} />
                        ) : null}
                        {row.taskLines.map((task, taskIndex) => {
                          const due = at(task.dueDate);
                          const done = ["complete", "completed", "done"].includes(task.status);
                          return (
                            <div
                              key={`${task.title}-${taskIndex}`}
                              className="grid items-center gap-3 [grid-template-columns:240px_1fr_136px]"
                            >
                              <span className="flex min-w-0 items-center gap-2 pl-6">
                                <span
                                  className="min-w-0 flex-1 truncate text-[12.5px]"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {task.title}
                                </span>
                                {task.owner ? <Avatar name={task.owner} /> : null}
                              </span>
                              <span className="relative h-[16px]">
                                {due !== null ? (
                                  <span
                                    className="absolute inset-y-[2px] z-20 rounded-[3px]"
                                    style={{
                                      left: `${Math.max(0, due - 6)}%`,
                                      width: "6%",
                                      background: done ? "var(--success-fg)" : "var(--accent)",
                                      opacity: done ? 1 : 0.7,
                                    }}
                                  />
                                ) : null}
                                <span
                                  className="absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap text-[10.5px]"
                                  style={{
                                    left: `calc(${due === null ? 0 : Math.max(0, due)}% + 6px)`,
                                    color: "var(--text-quiet)",
                                  }}
                                >
                                  {taskNote(task, done)}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {bare.length > 0 ? (
              <Link
                href={`${here}?view=timeline&zoom=${grain}${showDeps ? "" : "&deps=0"}${
                  bareOpen ? "" : "&bare=1"
                }`}
                scroll={false}
                className="mt-2.5 flex items-center gap-2 rounded-[6px] border border-dashed px-3 py-2 text-[12px] no-underline"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
              >
                <span aria-hidden>{bareOpen || showBare ? "▾" : "▸"}</span>
                {bare.length} stream{bare.length === 1 ? "" : "s"} with no date on the stream,
                its plan, or any of its tasks
              </Link>
            ) : null}
          </div>
        </div>

        {/* The key reads under the chart rather than over it. Five swatches
            stood in the toolbar beside the zoom, the today jump, the
            dependency switch and the period — nine things across the top of
            a chart nobody had looked at yet. It is a legend: it is wanted
            once something on the chart needs explaining. */}
        <div
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-2.5 text-[11.5px]"
          style={{ borderColor: "var(--border)" }}
        >
          <Key colour="var(--success-fg)" label="Complete" />
          <Key colour="var(--accent)" label="In progress" />
          <Key colour="var(--border-strong)" label="Planned" />
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
            <span aria-hidden>◆</span> Milestone
          </span>
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
            <span
              className="inline-block h-2.5 w-4 rounded-[2px]"
              style={{ background: "var(--accent)", opacity: 0.55 }}
              aria-hidden
            />
            From tasks
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * One of the four figures under 15.3c's chart.
 *
 * `warn` is the reference's amber on a value that is short of its own total —
 * two of four streams on schedule, three of four milestones hit. The number
 * carries the warning, so nothing else in the card has to.
 */
function StatCard({
  label,
  value,
  note,
  tone = "plain",
  spark,
  sparkColour = "var(--accent)",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "plain" | "warn";
  /** The card's own figure week by week, for the line 15.3 draws beside it. */
  spark?: (number | null)[];
  sparkColour?: string;
}) {
  return (
    <div className="rounded-[9px] border border-line px-3.5 py-3">
      <span
        className="mb-1.5 block whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.04em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <span
            className="mb-[3px] block text-[18px] font-bold leading-[1.1] tabular-nums"
            style={{ color: tone === "warn" ? "var(--warning-fg)" : "var(--ink)" }}
          >
            {value}
          </span>
          <span className="block text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {note}
          </span>
        </div>
        {spark ? <Sparkline points={spark} colour={sparkColour} /> : null}
      </div>
    </div>
  );
}

/**
 * The small line on a 15.3 card.
 *
 * A week the figure could not be worked out — nothing closed, so there is no
 * on-time rate and no cycle time — is a gap in the line rather than a zero. A
 * zero there would read as the week everything went wrong.
 */
function Sparkline({ points, colour }: { points: (number | null)[]; colour: string }) {
  const known = points.filter((value): value is number => value !== null);
  if (known.length < 2) return null;

  const low = Math.min(...known);
  const high = Math.max(...known);
  // A figure that held still is a flat line, and that is a true reading of it.
  // Drawn across the middle so it is not mistaken for the floor of the chart —
  // 100% every week and 0% every week must not look the same.
  const flat = high === low;
  const range = flat ? 1 : high - low;

  const runs: string[] = [];
  let run: string[] = [];
  points.forEach((value, index) => {
    if (value === null) {
      if (run.length > 1) runs.push(run.join(" "));
      run = [];
      return;
    }
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    run.push(`${x},${flat ? 50 : 100 - ((value - low) / range) * 100}`);
  });
  if (run.length > 1) runs.push(run.join(" "));

  return (
    <svg
      className="h-[34px] w-[86px] shrink-0"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {runs.map((line) => (
        <polyline
          key={line}
          points={line}
          fill="none"
          stroke={colour}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function Chip({ label, tone }: { label: string; tone: "quiet" | "info" | "bad" }) {
  const colours =
    tone === "bad"
      ? TONES.bad
      : tone === "info"
        ? { bg: "var(--accent-tint)", fg: "var(--accent)" }
        : { bg: "var(--canvas)", fg: "var(--text-muted)" };

  return (
    <span
      className="rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-medium"
      style={{ background: colours.bg, color: colours.fg }}
    >
      {label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
      style={{ background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * 15.3c's dependency joins — the dashed elbows from a task to the one waiting
 * on it.
 *
 * Drawn as two rules and an arrowhead rather than an SVG, because the x
 * positions are percentages of the chart and the y positions are pixels down
 * the rows; one box model handles both, and a viewBox handles neither.
 *
 * Only where both ends are dated. A join between two tasks whose position on
 * the chart is unknown would be a line drawn from nowhere to nowhere.
 */
function DependencyJoins({
  tasks,
  at,
}: {
  tasks: TaskLine[];
  at: (date: string | null) => number | null;
}) {
  // The rows this sits over: 16px tall, 6px apart.
  const PITCH = 22;
  const MID = 8;

  const joins = tasks.flatMap((task, index) => {
    if (task.dependsOn === null) return [];
    const from = tasks[task.dependsOn];
    if (!from) return [];

    const fromEnd = at(from.dueDate);
    const toStart = at(task.dueDate);
    if (fromEnd === null || toStart === null) return [];

    return [
      {
        key: `${task.dependsOn}-${index}`,
        x: fromEnd,
        // Its predecessor's bar ends at that date; this one's begins 6% before.
        toX: Math.max(0, toStart - 6),
        top: Math.min(task.dependsOn, index) * PITCH + MID,
        height: Math.abs(index - task.dependsOn) * PITCH,
        down: index > task.dependsOn,
      },
    ];
  });

  if (joins.length === 0) return null;

  return (
    <span className="pointer-events-none absolute inset-y-0 right-[148px] left-[252px] z-30" aria-hidden>
      {joins.map((join) => (
        <span key={join.key}>
          <span
            className="absolute border-l border-dashed"
            style={{
              left: `${join.x}%`,
              top: `${join.top}px`,
              height: `${join.height}px`,
              borderColor: "var(--text-disabled)",
            }}
          />
          <span
            className="absolute border-t border-dashed"
            style={{
              left: `${Math.min(join.x, join.toX)}%`,
              width: `${Math.abs(join.toX - join.x)}%`,
              top: `${join.top + (join.down ? join.height : 0)}px`,
              borderColor: "var(--text-disabled)",
            }}
          />
          <span
            className="absolute text-[8px] leading-none"
            style={{
              left: `calc(${join.toX}% - 3px)`,
              top: `${join.top + (join.down ? join.height : 0) - 4}px`,
              color: "var(--text-disabled)",
            }}
          >
            ▸
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * What 15.3c prints beside a task's bar — "✓ done", "at risk", "planned".
 *
 * The reference also shows "45% · at risk", but a task carries a status and
 * not a percentage, so the number is left off rather than invented. Anything
 * genuinely under way falls through to its due date, which is the one thing
 * the row can say that the bar cannot say exactly.
 */
function taskNote(task: TaskLine, done: boolean) {
  if (done) return "✓ done";
  if (["blocked", "waiting", "at_risk"].includes(task.status)) return "at risk";
  if (["not_started", "planned", ""].includes(task.status)) return "planned";
  return task.dueDate ? shortDate(task.dueDate) : "no date";
}

function Key({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
      <span
        className="inline-block h-2.5 w-4 rounded-[2px]"
        style={{ background: colour }}
        aria-hidden
      />
      {label}
    </span>
  );
}

/**
 * The unlabelled rules between the headings — weeks inside a month, days
 * inside a week, months inside a quarter.
 *
 * They carry no text; they are there so a bar can be read against the chart
 * rather than only against the dates printed beside it.
 */
function ticksFor(from: Date, to: Date, grain: Zoom) {
  const start = from.getTime();
  const span = to.getTime() - start;
  const ticks: { key: string; left: number }[] = [];
  if (span <= 0) return ticks;

  const cursor =
    grain === "quarter"
      ? new Date(from.getFullYear(), from.getMonth(), 1)
      : grain === "week"
        ? new Date(from.getFullYear(), from.getMonth(), from.getDate())
        : // Weeks, counted from the Monday on or before the start so they line
          // up with the weeks anyone reading this keeps.
          new Date(
            from.getFullYear(),
            from.getMonth(),
            from.getDate() - ((from.getDay() + 6) % 7),
          );

  while (cursor <= to && ticks.length < 200) {
    const left = ((cursor.getTime() - start) / span) * 100;
    if (left > 0 && left < 100) {
      ticks.push({ key: cursor.toISOString().slice(0, 10), left });
    }

    if (grain === "quarter") cursor.setMonth(cursor.getMonth() + 1);
    else if (grain === "week") cursor.setDate(cursor.getDate() + 1);
    else cursor.setDate(cursor.getDate() + 7);
  }

  return ticks;
}

/**
 * The column headings across the top of 15.3c, measured against the period.
 *
 * Each column carries where it actually falls rather than a share of the width.
 * Months are not the same length and a report rarely starts on the first of
 * one, so evenly divided columns would sit a heading over the wrong fortnight
 * and every bar would be read against it.
 */
function columnsFor(from: Date, to: Date, grain: Zoom) {
  const start = from.getTime();
  const span = to.getTime() - start;
  const columns: { key: string; label: string; left: number }[] = [];
  if (span <= 0) return columns;

  const cursor =
    grain === "week"
      ? // Back to the Monday on or before the start, so the weeks line up with
        // the weeks anyone reading this keeps.
        new Date(
          from.getFullYear(),
          from.getMonth(),
          from.getDate() - ((from.getDay() + 6) % 7),
        )
      : grain === "quarter"
        ? new Date(from.getFullYear(), Math.floor(from.getMonth() / 3) * 3, 1)
        : new Date(from.getFullYear(), from.getMonth(), 1);

  while (cursor <= to && columns.length < 60) {
    const left = ((cursor.getTime() - start) / span) * 100;

    // The first column usually begins before the period does; it is pinned to
    // the left edge rather than drawn off the chart.
    if (left > -100) {
      columns.push({
        key: cursor.toISOString().slice(0, 10),
        label:
          grain === "week"
            ? cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase()
            : grain === "quarter"
              ? `Q${Math.floor(cursor.getMonth() / 3) + 1} ${cursor.getFullYear()}`
              : cursor.toLocaleDateString("en-GB", { month: "long" }).toUpperCase(),
        left: Math.max(0, left),
      });
    }

    if (grain === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + (grain === "quarter" ? 3 : 1));
  }

  return columns;
}

/**
 * Screen 15.3's four figures across the top of the Charts view.
 *
 * The reference's fourth is Provider spend against a budget. Nothing in the
 * schema records what anything costs — no budget, no spend, no invoice — so
 * that card would be four made-up numbers. Streams complete takes its place:
 * the same shape of fact, about work rather than money.
 */
function ChartKpis({ metrics, weeks }: { metrics: ReportMetrics; weeks: WeekBar[] }) {
  const onTime =
    metrics.onTimeOf === 0 ? null : Math.round((metrics.onTime / metrics.onTimeOf) * 100);

  return (
    <div className="mb-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      <StatCard
        label="Tasks completed"
        value={`${metrics.tasksDone} / ${metrics.tasksTotal}`}
        spark={weeks.map((week) => week.cumulative)}
        sparkColour="var(--success-fg)"
        note={
          metrics.closedInPeriod > 0
            ? `▲ ${metrics.closedInPeriod} closed in this period`
            : "None closed in this period"
        }
      />
      <StatCard
        label="On-time rate"
        value={onTime === null ? "Not known" : `${onTime}%`}
        spark={weeks.map((week) => week.onTimeRate)}
        tone={onTime !== null && onTime < 80 ? "warn" : "plain"}
        note={
          metrics.onTimeOf === 0
            ? "No task has both a due date and a completion"
            : `Of ${metrics.onTimeOf} with a due date and a completion`
        }
      />
      <StatCard
        label="Avg cycle time"
        value={metrics.avgCycleDays === null ? "Not known" : `${metrics.avgCycleDays}d`}
        spark={weeks.map((week) => week.cycleDays)}
        sparkColour="var(--warning-fg)"
        note={
          metrics.avgCycleDays === null
            ? "Nothing has been opened and closed yet"
            : "Raised to closed"
        }
      />
      <StatCard
        label="Streams complete"
        value={`${metrics.streamsDone} of ${metrics.streamsTotal}`}
        spark={weeks.map((week) => week.streamsDone)}
        tone={metrics.streamsDone < metrics.streamsTotal ? "warn" : "plain"}
        note="Every task in them closed"
      />
    </div>
  );
}

/** A y-axis that lands on round numbers, with four gaps like the reference's. */
function axisFor(max: number) {
  const step = Math.max(1, Math.ceil(Math.max(1, max) / 4));
  const top = step * 4;
  return { top, ticks: [0, step, step * 2, step * 3, top] };
}

/** The frame both charts sit in — title, one line under it, key on the right. */
function ChartPanel({
  title,
  note,
  legend,
  children,
}: {
  title: string;
  note: string;
  legend: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[10px] border border-line px-4 py-3.5">
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{title}</div>
          <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {note}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-3 text-[11px]">
          {legend}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * 15.3's "Task throughput by week".
 *
 * A bar per week, stacked closed / running / blocked, with the week's total
 * printed over it and a ruled axis behind it. Without the axis a stack of
 * coloured blocks is a shape rather than a count — the reference rules it, and
 * so does this.
 */
function ThroughputChart({ weeks, moved }: { weeks: WeekBar[]; moved: number }) {
  const { top, ticks } = axisFor(
    Math.max(...weeks.map((week) => week.done + week.running + week.blocked + week.planned), 0),
  );

  return (
    <ChartPanel
      title="Task throughput by week"
      note={`${weeks.length} week${weeks.length === 1 ? "" : "s"} · ${moved} task${moved === 1 ? "" : "s"} falling in them`}
      legend={
        <>
          <Key colour="var(--success-fg)" label="Completed" />
          <Key colour="var(--accent)" label="Running" />
          <Key colour="var(--danger-border)" label="Blocked" />
          <Key colour="var(--border-strong)" label="Planned" />
        </>
      }
    >
      <div className="flex gap-2">
        <div
          className="flex h-[176px] w-6 shrink-0 flex-col-reverse justify-between text-right text-[10px] tabular-nums"
          style={{ color: "var(--text-quiet)" }}
          aria-hidden
        >
          {ticks.map((tick) => (
            <span key={tick} className="leading-none">
              {tick}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-0" aria-hidden>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute inset-x-0 border-t"
                style={{
                  bottom: `${(tick / top) * 100}%`,
                  borderColor: tick === 0 ? "var(--border-strong)" : "var(--border)",
                }}
              />
            ))}
          </span>

          <div className="relative flex h-[176px] items-end gap-[3px]">
            {weeks.map((week, index) => {
              const total = week.done + week.running + week.blocked + week.planned;
              return (
                <span
                  key={`${week.label}-${index}`}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  style={{ height: "100%" }}
                  title={`${week.label} · ${week.done} completed, ${week.running} running, ${week.blocked} blocked, ${week.planned} planned`}
                >
                  {total > 0 ? (
                    <span
                      className="text-[9.5px] font-semibold leading-none tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {total}
                    </span>
                  ) : null}
                  <span
                    className="flex w-full max-w-[26px] flex-col-reverse overflow-hidden rounded-[2px]"
                    style={{ height: `${(total / top) * 100}%` }}
                  >
                    <span
                      className="w-full"
                      style={{ flex: week.done, background: "var(--success-fg)" }}
                    />
                    <span
                      className="w-full"
                      style={{ flex: week.running, background: "var(--accent)" }}
                    />
                    <span
                      className="w-full"
                      style={{ flex: week.blocked, background: "var(--danger-border)" }}
                    />
                    <span
                      className="w-full"
                      style={{ flex: week.planned, background: "var(--border-strong)" }}
                    />
                  </span>
                </span>
              );
            })}
          </div>

          <div className="mt-1.5 flex gap-[3px]">
            {weeks.map((week, index) => (
              <span
                key={`${week.label}-${index}`}
                className="min-w-0 flex-1 truncate text-center text-[9.5px]"
                style={{ color: "var(--text-quiet)" }}
              >
                {/* Every other one, so eleven weeks do not overlap. */}
                {index % 2 === 0 ? `W${index + 1}` : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ChartPanel>
  );
}

/**
 * 15.3's "Burn-up against plan".
 *
 * One line, not two. The reference draws actual against a planned curve, but
 * nothing here records when work was meant to land — only when it is due — so
 * there is no plan to draw. Scope is real and stays: the dashed line across
 * the top is every task in the report, and the gap under it is what is left.
 */
function BurnUpChart({ weeks, scope }: { weeks: WeekBar[]; scope: number }) {
  const { top, ticks } = axisFor(scope);
  const last = weeks[weeks.length - 1]?.cumulative ?? 0;

  const point = (week: WeekBar, index: number) =>
    `${weeks.length === 1 ? 50 : (index / (weeks.length - 1)) * 100},${
      100 - (week.cumulative / top) * 100
    }`;
  const line = weeks.map(point).join(" ");

  return (
    <ChartPanel
      title="Burn-up"
      note={`${last} of ${scope} tasks closed by the end of the period`}
      legend={
        <>
          <Key colour="var(--accent)" label="Closed" />
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
            <span
              className="inline-block h-0 w-4 border-t border-dashed"
              style={{ borderColor: "var(--text-disabled)" }}
              aria-hidden
            />
            Scope
          </span>
        </>
      }
    >
      <div className="flex gap-2">
        <div
          className="flex h-[176px] w-6 shrink-0 flex-col-reverse justify-between text-right text-[10px] tabular-nums"
          style={{ color: "var(--text-quiet)" }}
          aria-hidden
        >
          {ticks.map((tick) => (
            <span key={tick} className="leading-none">
              {tick}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-0" aria-hidden>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute inset-x-0 border-t"
                style={{
                  bottom: `${(tick / top) * 100}%`,
                  borderColor: tick === 0 ? "var(--border-strong)" : "var(--border)",
                }}
              />
            ))}
            <span
              className="absolute inset-x-0 border-t border-dashed"
              style={{ bottom: `${(scope / top) * 100}%`, borderColor: "var(--text-disabled)" }}
            />
          </span>

          <svg
            className="relative h-[176px] w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <polygon
              points={`0,100 ${line} 100,100`}
              fill="var(--accent)"
              opacity="0.12"
            />
            <polyline
              points={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>

          <span
            className="absolute right-1 top-1 text-[10px]"
            style={{ color: "var(--text-quiet)" }}
          >
            Scope · {scope} tasks
          </span>

          <div className="mt-1.5 flex">
            {weeks.map((week, index) => (
              <span
                key={`${week.label}-${index}`}
                className="min-w-0 flex-1 truncate text-center text-[9.5px]"
                style={{ color: "var(--text-quiet)" }}
              >
                {index % 2 === 0 ? `W${index + 1}` : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ChartPanel>
  );
}

/** 15.3's "Requests by status" — the ring, and what each slice of it is. */
function RequestDonut({
  requests,
}: {
  requests: { completed: number; running: number; notStarted: number };
}) {
  const slices = [
    { label: "Complete", value: requests.completed, colour: "var(--success-fg)" },
    { label: "Running", value: requests.running, colour: "var(--accent)" },
    { label: "Not started", value: requests.notStarted, colour: "var(--border-strong)" },
  ];
  const total = slices.reduce((n, slice) => n + slice.value, 0);

  let sweep = 0;
  const stops = slices
    .map((slice) => {
      const from = sweep;
      sweep += total === 0 ? 0 : (slice.value / total) * 100;
      return `${slice.colour} ${from}% ${sweep}%`;
    })
    .join(", ");

  return (
    <div className="rounded-[10px] border border-line px-4 py-3.5">
      <div className="text-[13px] font-semibold">Requests by status</div>
      <div className="mb-5 mt-0.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        Across the period
      </div>

      <div className="flex items-center gap-5">
        <span
          className="relative grid h-[132px] w-[132px] shrink-0 place-items-center rounded-full"
          style={{
            background:
              total === 0 ? "var(--surface-soft)" : `conic-gradient(${stops})`,
          }}
          aria-hidden
        >
          <span className="grid h-[92px] w-[92px] place-items-center rounded-full bg-surface">
            <span className="text-[22px] font-bold leading-none tabular-nums">{total}</span>
            <span
              className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Requests
            </span>
          </span>
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {slices.map((slice) => (
            <span key={slice.label} className="flex items-center gap-2 text-[12px]">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ background: slice.colour }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{slice.label}</span>
              <span className="tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                {slice.value} · {total === 0 ? 0 : Math.round((slice.value / total) * 100)}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 15.3's "Work stream progress".
 *
 * Each stream is a full-width bar under its own line, cut into three: the
 * tasks closed, the ones running, and what is left. That is the reference's
 * "solid = complete · faded = running · grey = planned", and it is why the
 * bar is worth more than the percentage beside it — 0/4 not started and 0/4
 * all blocked are the same number and a different picture.
 */
function StreamProgress({ streams }: { streams: StreamLine[] }) {
  const atRisk = streams.filter((row) => row.blocked || row.blockedTasks > 0).length;

  return (
    <div className="rounded-[10px] border border-line px-4 py-3.5">
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">Work stream progress</div>
          <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            Solid = complete · faded = running · grey = planned
          </div>
        </div>
        {atRisk > 0 ? (
          <span
            className="ml-auto shrink-0 whitespace-nowrap rounded-[4px] px-2 py-[3px] text-[10.5px] font-medium"
            style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
          >
            {atRisk} stream{atRisk === 1 ? "" : "s"} at risk
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-[10px]">
        {streams.slice(0, FIRST_STREAMS).map((row, index) => (
          <StreamBar key={`${row.name}-${index}`} row={row} />
        ))}
      </div>

      {/* Thirty-three of these is most of a screen, and a report is read from
          the top. The rest are a press away rather than a scroll, and this
          needs no script to open: on a page a client may be sent, that
          matters more than the animation. */}
      {streams.length > FIRST_STREAMS ? (
        <details className="group mt-[10px]">
          <summary
            className="cursor-pointer list-none rounded-[7px] border px-3 py-1.5 text-center text-[12px] font-medium transition-colors hover:bg-[var(--surface-soft)] [&::-webkit-details-marker]:hidden"
            style={{ borderColor: "var(--border)", color: "var(--accent)" }}
          >
            <span className="group-open:hidden">
              Show the other {streams.length - FIRST_STREAMS}
            </span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>

          <div className="mt-[10px] flex flex-col gap-[10px]">
            {streams.slice(FIRST_STREAMS).map((row, index) => (
              <StreamBar key={`${row.name}-rest-${index}`} row={row} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** How many stream bars stand above the fold before the rest are folded away. */
const FIRST_STREAMS = 8;

/**
 * One stream's bar.
 *
 * The plan is on it because the name alone does not identify it: six streams
 * here are called "Visa & Legal Compliance", one per plan, and told apart by
 * nothing. That used to be the table underneath's only reason to exist.
 */
function StreamBar({ row }: { row: StreamLine }) {
  const colour =
    row.complete === 100
      ? "var(--success-fg)"
      : row.complete > 0
        ? "var(--accent)"
        : "var(--border-strong)";
  const share = (count: number) => (row.tasks === 0 ? 0 : (count / row.tasks) * 100);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
          style={{ background: colour }}
          aria-hidden
        />
        <span className="min-w-0 truncate text-[12px] font-medium">
          {row.name}
          {row.plan ? (
            <span className="ml-1.5 font-normal" style={{ color: "var(--text-quiet)" }}>
              {row.plan}
            </span>
          ) : null}
        </span>
        <span
          className="ml-auto shrink-0 whitespace-nowrap text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {row.done}/{row.tasks}
          {row.targetDate ? ` · due ${shortDate(row.targetDate)}` : ""}
        </span>
        <span className="w-9 shrink-0 text-right text-[11.5px] font-bold tabular-nums">
          {row.complete}%
        </span>
      </div>

      <div
        className="flex h-2 overflow-hidden rounded-[4px]"
        style={{ background: "var(--surface-soft)" }}
      >
        <span style={{ width: `${share(row.done)}%`, background: colour }} />
        <span style={{ width: `${share(row.running)}%`, background: colour, opacity: 0.4 }} />
        <span
          style={{
            width: `${share(row.planned + row.blockedTasks)}%`,
            background: "var(--border)",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Screen 15.3's Charts view.
 *
 * Not built, because nothing behind it exists: the reference's Provider spend
 * card and its stacked spend-against-budget bar. There is no budget, no spend
 * and no invoice anywhere in the schema, so both would be invented figures on
 * a page a client reads.
 */
export function ReportCharts({
  metrics,
  weeks,
  requests,
  streams,
}: {
  metrics?: ReportMetrics;
  weeks?: WeekBar[];
  requests?: { completed: number; running: number; notStarted: number };
  streams: StreamLine[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {metrics ? (
        <ChartKpis metrics={metrics} weeks={weeks ?? []} />
      ) : (
        // A report holds what was worked out on the day it was made, and these
        // figures did not exist then. Saying so beats four blocks quietly
        // missing, which reads as a screen that is broken.
        <div
          className="rounded-[10px] border px-4 py-3 text-[12.5px]"
          style={{
            background: "var(--warning-bg)",
            borderColor: "var(--warning-border)",
            color: "var(--warning-fg)",
          }}
        >
          This report was generated before the throughput and cycle-time figures
          existed, so it does not carry them. It is a snapshot and is not
          recalculated, so generate a new report to see them.
        </div>
      )}

      {weeks && weeks.length > 0 ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          <ThroughputChart
            weeks={weeks}
            moved={weeks.reduce(
              (n, week) => n + week.done + week.running + week.blocked + week.planned,
              0,
            )}
          />
          <BurnUpChart weeks={weeks} scope={metrics?.tasksTotal ?? 0} />
        </div>
      ) : null}

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] lg:[grid-template-columns:minmax(280px,1fr)_minmax(0,1.9fr)]">
        {requests ? <RequestDonut requests={requests} /> : null}
        {streams.length > 0 ? <StreamProgress streams={streams} /> : null}
      </div>
    </div>
  );
}

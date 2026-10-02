import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { relativeTime } from "@/whitbyos/lib/format";
import type {
  FeedRow,
  HomeWidgets,
  LoadRow,
  OutstandingRow,
  OverdueTaskRow,
  ProviderRow,
  WeekRow,
} from "@/whitbyos/lib/home-widgets";

/**
 * Screen 1's widgets.
 *
 * Every one is the same card: a 14px semibold name, a link out and a "⋯" on
 * the right, then rows separated by hairlines with no line above the first.
 * That shape is `Widget`; the seven below only decide what goes in the rows.
 */
/**
 * Each widget's own colourway, keyed by what it is about.
 *
 * Nine white cards with a grey heading apiece gave the eye nothing to navigate
 * by — every one had to be read to be told from its neighbour. A colour and a
 * mark per kind is learned once. Red belongs to the two that carry lateness
 * and to nothing else, so it still means something when it appears.
 */
const WIDGET_MARKS: Record<string, { glyph: string; bg: string; fg: string }> = {
  outstanding: { glyph: "!", bg: "var(--danger-bg)", fg: "var(--danger-action-fg)" },
  overdue_tasks: { glyph: "☑", bg: "var(--danger-bg)", fg: "var(--danger-action-fg)" },
  feed: { glyph: "✉", bg: "var(--accent-tint)", fg: "var(--accent)" },
  team_activity: { glyph: "◷", bg: "var(--accent-tint)", fg: "var(--accent)" },
  this_week: { glyph: "▦", bg: "var(--success-bg)", fg: "var(--success-fg)" },
  insights: { glyph: "◈", bg: "var(--module-academy-bg)", fg: "var(--module-academy-fg)" },
  load: { glyph: "▥", bg: "var(--accent-tint)", fg: "var(--accent)" },
  plan_progress: { glyph: "❖", bg: "var(--avatar-tan-bg)", fg: "var(--avatar-tan-fg)" },
  providers: { glyph: "◫", bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
};

/** The two widgets whose whole subject is something being late. */
const URGENT = new Set(["outstanding", "overdue_tasks"]);

export function Widget({
  title,
  href,
  linkLabel = "View all",
  widgetKey,
  children,
}: {
  title: string;
  href: string;
  linkLabel?: string;
  /** Where the "⋯" points: 1.3, with this widget's own switch to turn off. */
  widgetKey: string;
  children: React.ReactNode;
}) {
  const mark = WIDGET_MARKS[widgetKey];

  // A card about lateness reads as a card about anything else when its only
  // red is a word at the end of a row. The edge carries it instead.
  const urgent = URGENT.has(widgetKey);

  return (
    <section
      className={`home-widget px-4 py-3.5 ${urgent ? "home-widget-urgent" : ""}`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 truncate text-[13.5px] font-semibold">
          {mark ? (
            <span
              aria-hidden
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-[11px]"
              style={{ background: mark.bg, color: mark.fg }}
            >
              {mark.glyph}
            </span>
          ) : null}
          <span className="truncate">{title}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href={href}
            className="whitespace-nowrap text-[12px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            {linkLabel}
          </Link>
          <Link
            href={`/whitbyos?widgets=1&focus=${widgetKey}`}
            aria-label={`Widget options for ${title}`}
            className="text-[14px] leading-none no-underline"
            style={{ color: "var(--text-quiet)" }}
          >
            ⋯
          </Link>
        </div>
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/** A row inside a widget. The export gives the first one a line too. */
function Row({ children, tall }: { children: React.ReactNode; tall?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 border-t border-line first:border-t-0 ${tall ? "py-2.5" : "py-2"}`}
    >
      {children}
    </div>
  );
}

/**
 * What a widget says when it has nothing to show.
 *
 * A bare grey sentence in a tall box reads as absence, and most of these are
 * good news: nothing overdue is the state you want to be in. So each one gets
 * a mark that says which kind of empty it is, and a way on where there is one.
 */
function Empty({
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
    <div className="flex flex-col items-center gap-2 px-2 py-5 text-center">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{
          background: tone === "good" ? "var(--success-bg)" : "var(--canvas)",
          color: tone === "good" ? "var(--success-fg)" : "var(--text-quiet)",
        }}
        aria-hidden
      >
        {mark}
      </span>

      <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {children}
      </span>

      {action ? (
        <Link href={action.href} className="text-[12.5px] no-underline">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** The three marks the empty states use, drawn rather than set as glyphs. */
function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8.5 6.5 11.5 12.5 5" />
    </svg>
  );
}

function CalendarMark() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </svg>
  );
}

function MessageMark() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.5 9.5a1.5 1.5 0 0 1-1.5 1.5H6l-3 2.5V4a1.5 1.5 0 0 1 1.5-1.5h7.5A1.5 1.5 0 0 1 13.5 4z" />
    </svg>
  );
}

export function OutstandingWidget({ rows }: { rows: OutstandingRow[] }) {
  return (
    <Widget title="Outstanding & Overdue Requests" href="/whitbyos/requests" widgetKey="outstanding">
      {rows.length === 0 ? (
        <Empty mark={<Tick />} tone="good">
          Nothing is overdue or waiting on you.
        </Empty>
      ) : (
        rows.map((row) => (
          <Row key={row.id}>
            <Link
              href={`/whitbyos/requests/${row.id}`}
              className="min-w-0 flex-1 no-underline"
              style={{ color: "var(--ink)" }}
            >
              <div className="truncate text-[13.5px] font-medium">{row.title}</div>
              <div className="truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {row.client}
              </div>
            </Link>
            <Pill tone={row.tone === "danger" ? "danger" : "warning"}>{row.note}</Pill>
          </Row>
        ))
      )}
    </Widget>
  );
}

export function OverdueTasksWidget({ rows }: { rows: OverdueTaskRow[] }) {
  return (
    <Widget title="Overdue Tasks" href="/whitbyos/tasks" widgetKey="overdue_tasks">
      {rows.length === 0 ? (
        <Empty mark={<Tick />} tone="good">
          No task is past its date.
        </Empty>
      ) : (
        rows.map((row) => (
          <Row key={row.id}>
            {/* The export draws the box; ticking one belongs to My Tasks,
                where completing a task records who did it and when. */}
            <Link
              href={`/whitbyos/tasks?task=${row.id}`}
              aria-label={`Open ${row.title}`}
              className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border no-underline"
              style={{ borderColor: "var(--border-strong)", background: "var(--canvas)" }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px]">{row.title}</div>
              <div className="truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {row.context}
              </div>
            </div>
            <span className="text-[12px] font-medium" style={{ color: "var(--danger-fg)" }}>
              Overdue
            </span>
          </Row>
        ))
      )}
    </Widget>
  );
}

function FeedRows({
  rows,
  empty,
  mark,
}: {
  rows: FeedRow[];
  empty: string;
  mark: React.ReactNode;
}) {
  if (rows.length === 0) return <Empty mark={mark}>{empty}</Empty>;

  return (
    <>
      {rows.map((row) => (
        <div key={row.id} className="flex items-start gap-2.5 border-t border-line py-2 first:border-t-0">
          <span
            className={`mt-0.5 flex h-[20px] w-[20px] shrink-0 items-center justify-center overflow-hidden text-[8px] font-bold ${
              row.whitby ? "rounded-[5px] text-white" : "rounded-full"
            }`}
            style={
              row.whitby
                ? { background: "var(--ink)" }
                : { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }
            }
            aria-hidden
          >
            {row.photo ? (
              // Signed URL on a private bucket, which the optimiser cannot
              // fetch; a Google photo is refused when a referrer is sent.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.photo}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              row.initials
            )}
          </span>
          <div className="min-w-0 flex-1">
            {row.href ? (
              <Link href={row.href} className="no-underline" style={{ color: "var(--ink)" }}>
                <div className="truncate text-[13.5px]">{row.text}</div>
              </Link>
            ) : (
              <div className="truncate text-[13.5px]">{row.text}</div>
            )}
            <div className="mt-0.5 truncate text-[12px]" style={{ color: "var(--text-faint)" }}>
              {row.context} · {relativeTime(row.at)}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export function FeedWidget({ rows }: { rows: FeedRow[] }) {
  return (
    <Widget title="Recent Messages & Updates" href="/whitbyos/messages" widgetKey="feed">
      <FeedRows rows={rows} mark={<MessageMark />} empty="Nothing new has come in." />
    </Widget>
  );
}

export function TeamActivityWidget({ rows }: { rows: FeedRow[] }) {
  return (
    <Widget title="Team Activity" href="/whitbyos/requests" widgetKey="team_activity">
      <FeedRows rows={rows} mark={<Tick />} empty="Nothing recorded yet." />
    </Widget>
  );
}

export function ThisWeekWidget({ rows }: { rows: WeekRow[] }) {
  return (
    <Widget title="This Week" href="/whitbyos/calendar" linkLabel="Open" widgetKey="this_week">
      {rows.length === 0 ? (
        /*
         * Compact, and its own colour.
         *
         * The shared empty state is built for a card in the wide column: a
         * 44px grey disc, a sentence and a link, which in a 320px rail was
         * four inches of nothing under a heading. This says the same in a
         * row, in the green this widget already wears.
         */
        <div className="flex items-center gap-3 py-1">
          <span
            aria-hidden
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] text-[13px]"
            style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
          >
            ▦
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
              Nothing this week.
            </span>
            <Link
              href="/whitbyos/calendar?new=1"
              className="text-[12px] no-underline"
              style={{ color: "var(--accent)" }}
            >
              Add something →
            </Link>
          </span>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <div key={row.id} className="flex gap-2.5 py-2 first:pt-0.5">
              <span
                className="w-14 shrink-0 text-[11.5px] font-semibold"
                style={{ color: "var(--accent)" }}
              >
                {row.day}
              </span>
              <span className="min-w-0 flex-1 text-[13px]">{row.title}</span>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

export function InsightsWidget({ insights }: { insights: HomeWidgets["insights"] }) {
  const lines = [
    { label: "Completed this month", value: String(insights.completedThisMonth), known: true },
    {
      // Short, because this sits in a 320px rail: "Avg. turnaround this month"
      // against "Nothing closed this month" wrapped both halves onto two lines
      // and made a three-row card look broken. The window is said once, in the
      // footnote under all three.
      label: "Avg. turnaround",
      value: insights.avgTurnaround.endsWith("days") ? insights.avgTurnaround : "—",
      known: insights.avgTurnaround.endsWith("days"),
    },
    { label: "Active requests", value: String(insights.activeRequests), known: true },
  ];

  return (
    <Widget title="Insights" href="/whitbyos/insights" widgetKey="insights">
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {lines.map((line) => (
          <div
            key={line.label}
            className="flex items-baseline justify-between gap-3 py-2 first:pt-0.5 last:pb-0.5"
          >
            <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              {line.label}
            </span>
            {line.known ? (
              <span className="text-[16px] font-bold tabular-nums">{line.value}</span>
            ) : (
              <span className="text-[12.5px]" style={{ color: "var(--text-quiet)" }}>
                {line.value}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* The window, said once under all three rather than folded into a
          label that then wraps. */}
      <p
        className="mt-2.5 border-t border-line pt-2 text-[11px] leading-[1.45]"
        style={{ color: "var(--text-quiet)", margin: 0 }}
      >
        {insights.avgTurnaround.endsWith("days")
          ? "Turnaround is measured over the requests closed this month."
          : "Nothing has closed this month, so there is no turnaround to average yet."}
      </p>
    </Widget>
  );
}

export function ProvidersWidget({ rows }: { rows: ProviderRow[] }) {
  return (
    <Widget title="Providers Needing Outreach" href="/whitbyos/providers" widgetKey="providers">
      {rows.length === 0 ? (
        <Empty mark={<Tick />} tone="good">
          Every provider has been contacted.
        </Empty>
      ) : (
        rows.map((row) => (
          <Row key={row.id}>
            <Link
              href={`/whitbyos/providers/${row.id}`}
              className="min-w-0 flex-1 truncate text-[13.5px] no-underline"
              style={{ color: "var(--ink)" }}
            >
              {row.name}
            </Link>
            <span className="shrink-0 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {row.note}
            </span>
          </Row>
        ))
      )}
    </Widget>
  );
}

/**
 * What is due, day by day, for the fortnight ahead.
 *
 * Home's counts say how much; they cannot say when it lands. "3 due today"
 * beside "5 open" leaves the shape of the fortnight unsaid, and four on one
 * Thursday is a different fortnight from one a day.
 *
 * Drawn rather than charted — fifteen columns and a baseline is not a reason
 * to add a library, and one rendering on the client would leave this blank
 * while it arrived.
 */
export function LoadWidget({ rows }: { rows: LoadRow[] }) {
  const peak = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const late = rows.find((row) => row.late)?.count ?? 0;

  return (
    <Widget title="What is due" href="/whitbyos/tasks" widgetKey="load">
      {total === 0 ? (
        <p className="py-4 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Nothing has a date in the next fortnight.
        </p>
      ) : (
        <>
          {/* The two figures the columns are made of, said in words before
              anybody has to read a shape. */}
          <div className="mb-2.5 flex items-baseline gap-4 text-[12px]">
            <span style={{ color: "var(--text-secondary)" }}>
              <strong className="text-[15px] font-bold tabular-nums">{total}</strong> due in
              the next fortnight
            </span>
            {late > 0 ? (
              <span style={{ color: "var(--danger-text)" }}>
                <strong className="text-[15px] font-bold tabular-nums">{late}</strong> already
                late
              </span>
            ) : null}
          </div>

          <div
            className="flex items-end gap-[5px] border-b pb-0"
            style={{ height: 104, borderColor: "var(--border-strong)" }}
          >
            {rows.map((row) => (
              <div
                key={row.label + row.full}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                title={`${row.full}: ${row.count} ${row.count === 1 ? "task" : "tasks"}`}
              >
                {/* The figure over its own column, and only where there is
                    one — fifteen zeroes along an axis is noise. */}
                {row.count > 0 ? (
                  <span
                    className="mb-1 text-[10px] font-semibold tabular-nums"
                    style={{ color: row.late ? "var(--danger-text)" : "var(--text-secondary)" }}
                  >
                    {row.count}
                  </span>
                ) : null}

                <span
                  className="w-full max-w-[26px] rounded-t-[4px] transition-opacity group-hover:opacity-85"
                  style={{
                    // A day with nothing gets a visible tick rather than a
                    // hairline, so the axis reads as a run of days.
                    height: row.count === 0 ? 3 : `${Math.max(10, (row.count / peak) * 100)}%`,
                    background:
                      row.count === 0
                        ? "var(--border-strong)"
                        : row.late
                          ? "var(--danger-solid)"
                          : row.today
                            ? "var(--accent)"
                            : "var(--accent-tint-mid)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* A label under every column, not three under fifteen. The weekday
              alone is enough once the row is read left to right, and the two
              that are not weekdays say so. */}
          <div className="mt-1.5 flex gap-[5px]">
            {rows.map((row) => (
              <span
                key={`label-${row.label}-${row.full}`}
                className="min-w-0 flex-1 truncate text-center text-[10px]"
                style={{
                  color: row.today
                    ? "var(--accent)"
                    : row.late
                      ? "var(--danger-text)"
                      : "var(--text-quiet)",
                  fontWeight: row.today || row.late ? 600 : 400,
                }}
              >
                {row.label}
              </span>
            ))}
          </div>
        </>
      )}
    </Widget>
  );
}

/**
 * How far each live Work Plan has got.
 *
 * The figure exists on every plan already — done over total, which the Work
 * Plans screen prints as a percentage in a column. As a row of bars it answers
 * the question that column cannot: which of these is nearly finished and which
 * has not started.
 */
export function PlanProgressWidget({
  rows,
}: {
  rows: { id: string; name: string; progress: number; taskDone: number; taskTotal: number }[];
}) {
  return (
    <Widget title="Work Plan progress" href="/whitbyos/work-plans" widgetKey="plan_progress">
      {rows.length === 0 ? (
        <p className="py-4 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          No Work Plan is running.
        </p>
      ) : (
        <div className="flex flex-col py-0.5">
          {rows.slice(0, 5).map((row) => (
            // Stacked, not three columns. This sits in a 320px rail, where a
            // name, a bar and a figure side by side leave a bar an inch wide.
            <Link
              key={row.id}
              href={`/whitbyos/work-plans/${row.id}`}
              className="-mx-2 block rounded-[6px] px-2 py-2 no-underline transition-colors hover:bg-[var(--surface-soft)]"
              style={{ color: "var(--ink)" }}
            >
              <span className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12.5px]">{row.name}</span>
                <span
                  className="shrink-0 text-[11px] tabular-nums"
                  style={{
                    color:
                      row.progress >= 100
                        ? "var(--success-fg)"
                        : row.progress > 0
                          ? "var(--text-secondary)"
                          : "var(--text-quiet)",
                  }}
                >
                  {row.progress > 0
                    ? `${row.taskDone}/${row.taskTotal}`
                    : `Not started · ${row.taskTotal}`}
                </span>
              </span>

              <span
                className="relative block h-[8px] overflow-hidden rounded-full"
                style={{ background: "var(--surface-active)" }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    // Nothing done draws nothing, and an empty track beside a
                    // full one reads as a bar that failed to load — which is
                    // why the words beside it say "Not started".
                    width: row.progress > 0 ? `${Math.max(4, row.progress)}%` : 0,
                    background: row.progress >= 100 ? "var(--success-dot)" : "var(--accent)",
                  }}
                />
              </span>
            </Link>
          ))}
        </div>
      )}
    </Widget>
  );
}

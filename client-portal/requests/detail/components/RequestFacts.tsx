import { Pill } from "@/base/components/Pill";
import { daysUntil, shortDate } from "@/client-portal/lib/format";

/** Base's `Pill` keeps its tone union to itself; this is the same set. */
type PillTone = React.ComponentProps<typeof Pill>["tone"];

/**
 * Where the Request stands, in one object at the top of the screen.
 *
 * WHAT IT REPLACED
 *
 * A status pill on one line, a progress bar and its caption on a second, a
 * "Next step: …" sentence on a third, and a target date tucked at the right
 * end of the progress caption where nobody read it. Four unrelated rows, each
 * carrying one fact, spending the top of the one screen a client returns to
 * most — and none of them answering the question they open it with, which is
 * some form of "is anything waiting on me?".
 *
 * So the four facts are four cells of one strip: where it stands, how far
 * along, when it is due, and how much of it is the client's own to do. Each is
 * a label and a value in the same place every time, which is what makes a strip
 * readable at a glance in a way four sentences are not. The next step spans the
 * foot of it, because it is prose and because it is the one line that says what
 * happens next rather than what has happened.
 *
 * Cells are separated by the grid's own 1px gaps over a border-coloured ground
 * rather than by borders on the cells: the strip wraps to two rows on a narrow
 * window, and a left border on each cell would leave a stray rule down the
 * start of the second row.
 */
export function RequestFacts({
  status,
  statusTone,
  steps,
  urgency,
  health,
  progress,
  taskCount,
  targetDate,
  targetFromPlan = false,
  closedAt,
  needsYou,
  nextStep,
  waitingOn,
  timeZone,
}: {
  status: string;
  statusTone: PillTone;
  /** Whitby's "Step 3 of 7", counted over the plans this client was shown. */
  steps: { done: number; total: number } | null;
  urgency: { label: string; tone: PillTone } | null;
  health: { label: string; tone: PillTone } | null;
  progress: number;
  taskCount: number;
  targetDate: string | null;
  /**
   * True when the Request itself has no target date and `targetDate` is the
   * shared Work Plan's instead — said under the date, so the client knows
   * where it came from.
   */
  targetFromPlan?: boolean;
  closedAt: string | null;
  /** How many things on this Request are waiting on the client. */
  needsYou: number;
  nextStep: string | null;
  waitingOn: string | null;
  timeZone: string;
}) {
  const now = new Date();
  const due = daysUntil(targetDate, now, timeZone);

  return (
    <div
      className="mb-4 grid gap-px overflow-hidden rounded-card-cp border border-line [grid-template-columns:repeat(auto-fit,minmax(156px,1fr))]"
      style={{ background: "var(--border)" }}
    >
      <Cell label="Status">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={statusTone}>
            {status}
            {steps && steps.total > 0 && !closedAt ? ` · Step ${steps.done} of ${steps.total}` : ""}
          </Pill>
          {/* The professional's own reading of the request (whitbyos/010), in
              their own words. Both are quiet when they say nothing unusual. */}
          {urgency ? <Pill tone={urgency.tone}>{urgency.label}</Pill> : null}
          {health ? <Pill tone={health.tone}>{health.label}</Pill> : null}
        </div>
      </Cell>

      {/*
       * The bar counts client-visible Tasks — see `requestProgress` in
       * `lib/data/requests.ts` for why it is deliberately not the
       * professional's own step count. The number of tasks is printed beside
       * the percentage precisely so it is checkable: they are the ones on the
       * Tasks tab, and nothing here rests on a figure the client cannot reach.
       *
       * A Request with no client-visible tasks says so rather than drawing an
       * empty bar. Zero of zero is not "no progress" — it is the portal having
       * nothing to say, and an empty bar states the opposite.
       */}
      <Cell label="Progress">
        {taskCount > 0 || closedAt ? (
          <>
            <Value>{closedAt ? "Complete" : `${progress}%`}</Value>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: "var(--surface-soft)" }}
              role="progressbar"
              aria-valuenow={closedAt ? 100 : progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Request progress"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${closedAt ? 100 : progress}%`,
                  background: closedAt ? "var(--success-fg)" : "var(--accent)",
                }}
              />
            </div>
            {taskCount > 0 ? (
              <Detail>{`${taskCount} task${taskCount === 1 ? "" : "s"}`}</Detail>
            ) : null}
          </>
        ) : (
          <Value muted>Not started</Value>
        )}
      </Cell>

      <Cell label={closedAt ? "Closed" : "Target date"}>
        {closedAt ? (
          <Value>{shortDate(closedAt, now, timeZone)}</Value>
        ) : targetDate ? (
          <>
            <Value>{shortDate(targetDate, now, timeZone)}</Value>
            <Detail danger={due !== null && due < 0}>
              {[dueNote(due), targetFromPlan ? "From the Work Plan" : ""]
                .filter(Boolean)
                .join(" · ")}
            </Detail>
          </>
        ) : (
          // Neither the Request nor a shared plan carries a date. Said as
          // something the team has yet to do, not as a fault on the client's
          // side of the screen.
          <>
            <Value muted>Not set yet</Value>
            <Detail>Your team will add one</Detail>
          </>
        )}
      </Cell>

      {/* The cell the client opens the screen for. Counted in red when it is
          not nought, because a number here is a number of things they owe:
          forms to fill, documents to review, tasks assigned to them — the
          same items as the "Waiting on you" card straight below, which is
          the only tab this strip is drawn on. */}
      <Cell label="Waiting on you">
        {needsYou > 0 ? (
          <>
            <Value danger>{`${needsYou} item${needsYou === 1 ? "" : "s"}`}</Value>
            <Detail>Listed below</Detail>
          </>
        ) : (
          <>
            <Value muted>Nothing</Value>
            <Detail>You are all caught up</Detail>
          </>
        )}
      </Cell>

      {nextStep || waitingOn ? (
        <div
          className="col-span-full flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5"
          style={{ background: "var(--surface)" }}
        >
          <span
            className="shrink-0 text-[11px] font-semibold uppercase tracking-[.05em]"
            style={{ color: "var(--text-faint)" }}
          >
            Next step
          </span>
          <span className="min-w-0 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {nextStep ?? "Not set"}
            {waitingOn ? ` · Waiting on ${waitingOn.toLowerCase()}` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** How the target date reads against today, in the professional's zone. */
function dueNote(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} past`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3" style={{ background: "var(--surface)" }}>
      <div
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Value({
  children,
  muted = false,
  danger = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className="text-[14.5px] font-semibold leading-tight"
      style={{
        color: danger ? "var(--danger-text)" : muted ? "var(--text-tertiary)" : "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}

function Detail({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  if (!children) return null;
  return (
    <div
      className="mt-1 text-[12px]"
      style={{ color: danger ? "var(--danger-text)" : "var(--text-tertiary)" }}
    >
      {children}
    </div>
  );
}

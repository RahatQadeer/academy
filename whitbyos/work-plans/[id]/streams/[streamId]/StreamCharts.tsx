import { CHART_STATES, type StreamCharts as Data } from "@/whitbyos/lib/work-plans";
import {
  Card,
  Nothing,
  STATE_INK,
  STATE_LABEL,
  Tile,
} from "@/whitbyos/work-plans/[id]/components/chart-parts";
import { shortDate } from "@/whitbyos/lib/format";

/**
 * WP.17k — one Work Stream read as numbers.
 *
 * Documents and approvals are here, and both were wrongly given up on once:
 * `document_context_type` has carried `workstream` since the base schema, and
 * migration 012 gave a task a `kind`, so an approval inside a stream is a row
 * like any other.
 *
 * What is still missing from the reference's activity card is messages and
 * provider calls, neither of which knows what a Work Stream is, and the spend
 * line, which needs a budget no table holds. Drawn from invented numbers they
 * would be worse than absent — a chart nobody can check is one everybody
 * believes.
 */
export function StreamChartsView({
  charts,
  clientView,
}: {
  charts: Data;
  /**
   * Drawn in the Client Portal, which does not count documents filed against a
   * stream — so the tile is left out rather than drawn at a zero that may be
   * false.
   */
  clientView?: boolean;
}) {
  const cycle =
    charts.cycleDays.length > 0
      ? charts.cycleDays.reduce((sum, days) => sum + days, 0) / charts.cycleDays.length
      : null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className={`grid gap-3.5 sm:grid-cols-2 ${clientView ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        <Tile
          label="Tasks complete"
          value={String(charts.done)}
          of={`/ ${charts.total}`}
          note={
            charts.doneThisWeek > 0
              ? { text: `▲ ${charts.doneThisWeek} this week`, ink: "var(--success-fg)" }
              : { text: "None finished this week", ink: "var(--text-tertiary)" }
          }
        />

        <Tile
          label="Avg cycle time"
          value={cycle === null ? "Not known" : `${cycle.toFixed(1)}d`}
          note={
            cycle === null
              ? { text: "Nothing finished yet to measure", ink: "var(--text-tertiary)" }
              : {
                  text: `Across ${charts.cycleDays.length} finished task${charts.cycleDays.length === 1 ? "" : "s"}`,
                  ink: "var(--text-tertiary)",
                }
          }
        />

        <Tile
          label="Days remaining"
          value={
            charts.daysRemaining === null ? "Not known" : String(Math.abs(charts.daysRemaining))
          }
          note={
            charts.targetDate === null
              ? { text: "No target date set", ink: "var(--text-tertiary)" }
              : charts.daysRemaining !== null && charts.daysRemaining < 0
                ? { text: `Past ${shortDate(charts.targetDate)}`, ink: "var(--danger-text)" }
                : { text: `Target ${shortDate(charts.targetDate)}`, ink: "var(--text-tertiary)" }
          }
        />
        {clientView ? null : (
          <Tile
            label="Documents filed"
            value={String(charts.documents)}
            note={
              charts.documents === 0
                ? { text: "None against this stream yet", ink: "var(--text-tertiary)" }
                : {
                    text: `Filed against this Work Stream`,
                    ink: "var(--text-tertiary)",
                  }
            }
          />
        )}
      </div>

      {charts.approvals > 0 ? (
        <Card
          title="Approvals in this stream"
          detail={`${charts.approvals} approval task${charts.approvals === 1 ? "" : "s"}`}
        >
          <div className="flex items-center gap-3 text-[12.5px]">
            <span
              className="h-2.5 flex-1 overflow-hidden rounded-[3px]"
              style={{ background: "var(--canvas)" }}
            >
              <span
                className="block h-full"
                style={{
                  width: `${((charts.approvals - charts.approvalsOpen) / charts.approvals) * 100}%`,
                  background: STATE_INK.complete,
                }}
              />
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              {charts.approvals - charts.approvalsOpen} cleared
              {charts.approvalsOpen > 0 ? `, ${charts.approvalsOpen} waiting` : ""}
            </span>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row">
        <Card
          className="min-w-0 flex-1"
          title="Task burn-down"
          detail="Open tasks remaining in this stream"
        >
          <Burndown charts={charts} />
        </Card>

        <Card
          className="w-full shrink-0 xl:w-[300px]"
          title="Task status"
          detail={`${charts.total} task${charts.total === 1 ? "" : "s"}`}
        >
          <StatusList charts={charts} />
        </Card>
      </div>
    </div>
  );
}

/** What is left, after each thing that was finished. */
function Burndown({ charts }: { charts: Data }) {
  const points = charts.burndown;

  if (charts.total === 0) return <Nothing>No tasks in this Work Stream yet.</Nothing>;
  if (points.length === 0) {
    return (
      <Nothing>
        Nothing finished yet, the line starts at the first task ticked off.
      </Nothing>
    );
  }

  const width = 470;
  const height = 130;
  const left = 30;
  const right = 12;
  const top = 12;
  const base = height - 22;

  const peak = charts.total;
  const span = Math.max(1, points.length);
  const step = (width - left - right) / span;

  const at = (index: number, open: number) => ({
    x: left + index * step,
    y: base - (open / peak) * (base - top),
  });

  const start = { x: left, y: top };
  const line = [start, ...points.map((point, index) => at(index + 1, point.open))];
  const path = line.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L${line[line.length - 1].x.toFixed(1)},${base} L${left},${base} Z`;

  return (
    <svg width="100%" height="130" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Open tasks remaining">
      <line x1={left} y1={base} x2={width - right} y2={base} stroke="#e4e4e1" />
      <line x1={left} y1={top} x2={width - right} y2={top} stroke="#f1f1ef" />
      <text x={left - 6} y={base + 3.5} fontSize="9.5" fill="#a8a8a4" textAnchor="end">
        0
      </text>
      <text x={left - 6} y={top + 3.5} fontSize="9.5" fill="#a8a8a4" textAnchor="end">
        {peak}
      </text>

      <path d={area} fill="var(--accent)" opacity="0.12" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />

      {line.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="3" fill="var(--accent)">
          <title>
            {index === 0
              ? `${peak} open to begin with`
              : `${points[index - 1].open} open after ${points[index - 1].day}`}
          </title>
        </circle>
      ))}

      <text x={left} y={height - 4} fontSize="10" fill="#8a8a86">
        {points[0].day}
      </text>
      <text x={width - right} y={height - 4} fontSize="10" fill="#8a8a86" textAnchor="end">
        {points[points.length - 1].day}
      </text>
    </svg>
  );
}

/** The four states, each with its share written out beside it. */
function StatusList({ charts }: { charts: Data }) {
  if (charts.total === 0) return <Nothing>No tasks in this Work Stream yet.</Nothing>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 overflow-hidden rounded-[3px]">
        {CHART_STATES.map((state) => {
          const count = charts.byState[state];
          if (count === 0) return null;
          return (
            <span
              key={state}
              className="h-full"
              style={{
                width: `${(count / charts.total) * 100}%`,
                background: STATE_INK[state],
                // The 2px that keeps waiting and planned apart for a reader
                // who cannot separate amber from grey.
                boxShadow: "inset -2px 0 0 var(--surface)",
              }}
              title={`${count} ${STATE_LABEL[state]}`}
            />
          );
        })}
      </div>

      {CHART_STATES.map((state) => {
        const count = charts.byState[state];
        return (
          <div key={state} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: STATE_INK[state] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
              {STATE_LABEL[state]}
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>
              {count} · {Math.round((count / charts.total) * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

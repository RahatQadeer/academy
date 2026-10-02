import Link from "next/link";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import { CHART_STATES, type PlanCharts, type WorkPlanDetail } from "@/whitbyos/lib/work-plans";
import { STATE_INK, STATE_LABEL } from "@/whitbyos/work-plans/[id]/components/chart-parts";
import { shortDate } from "@/whitbyos/lib/format";

/**
 * The rails beside WP.17b and WP.17c.
 *
 * Each view carries its own — the List's is about the engagement (who is on
 * it, what is linked, what Whitby noticed), the Table's is about the shape of
 * the work, and the Grid's is about how far each stream has got. They are not
 * one rail shown three times, which is what made them worth reading.
 *
 * Kanban, Timeline and Charts have none in the reference: each of those needs
 * the width more than it needs a summary beside it.
 */

const DONE = new Set(["complete", "completed", "done"]);

export function Panel({ title, action, children }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line p-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <div className="text-[13px] font-semibold">{title}</div>
        {action}
      </div>
      <div className="flex flex-col gap-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        {children}
      </div>
    </div>
  );
}

/** WP.17b's rail. */
export function TableRail({
  plan,
  charts,
  basePath,
}: {
  plan: WorkPlanDetail;
  charts: PlanCharts | null;
  basePath: string;
}) {
  return (
    <>
      {charts ? <StatusMix charts={charts} /> : null}
      {charts ? <WeeklyCompletions charts={charts} /> : null}
      {charts ? <OpenByOwner charts={charts} /> : null}
      <KeyDates plan={plan} basePath={basePath} />
    </>
  );
}

/** WP.17c's rail. */
export function GridRail({
  plan,
  charts,
  basePath,
}: {
  plan: WorkPlanDetail;
  charts: PlanCharts | null;
  basePath: string;
}) {
  return (
    <>
      <ProgressByStream plan={plan} />
      {charts ? <MiniBurnUp charts={charts} /> : null}
      <KeyDates plan={plan} basePath={basePath} />
    </>
  );
}

/**
 * The donut, with the plan's own percentage in the middle of it.
 *
 * Drawn as one ring of four arcs rather than four rings, because the question
 * it answers is what the whole plan is made of.
 */
function StatusMix({ charts }: { charts: PlanCharts }) {
  const total = charts.totalTasks;
  const percent = total > 0 ? Math.round((charts.doneTasks / total) * 100) : 0;

  const R = 26;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <Panel title="Status mix">
      <div className="flex items-center gap-3.5">
        <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0" role="img" aria-label={`${percent}% complete`}>
          <circle cx="34" cy="34" r={R} fill="none" stroke="var(--canvas)" strokeWidth="9" />
          {CHART_STATES.map((state) => {
            const value = charts.byState[state] ?? 0;
            if (total === 0 || value === 0) return null;
            const length = (value / total) * C;
            const dash = `${length} ${C - length}`;
            const node = (
              <circle
                key={state}
                cx="34"
                cy="34"
                r={R}
                fill="none"
                stroke={STATE_INK[state]}
                strokeWidth="9"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                transform="rotate(-90 34 34)"
              />
            );
            offset += length;
            return node;
          })}
          <text x="34" y="38" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink)">
            {percent}%
          </text>
        </svg>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {CHART_STATES.map((state) => (
            <div key={state} className="flex items-center gap-2 text-[11.5px]">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: STATE_INK[state] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{STATE_LABEL[state]}</span>
              <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                {charts.byState[state] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/**
 * How much has been finished each week, and whether that is up on last week.
 *
 * From the recorded completions, so a plan whose work was finished before
 * anything recorded a date draws nothing rather than a line along the bottom.
 */
function WeeklyCompletions({ charts }: { charts: PlanCharts }) {
  const WEEKS = 8;
  const DAY = 86_400_000;
  const now = Date.now();

  const buckets = Array.from({ length: WEEKS }, () => 0);
  for (const row of charts.completions) {
    const at = Date.parse(`${row.day}T00:00:00Z`);
    const back = Math.floor((now - at) / (7 * DAY));
    if (back >= 0 && back < WEEKS) buckets[WEEKS - 1 - back]! += row.count;
  }

  const thisWeek = buckets[WEEKS - 1] ?? 0;
  const lastWeek = buckets[WEEKS - 2] ?? 0;
  const peak = Math.max(...buckets, 1);

  const width = 200;
  const height = 46;
  const step = width / Math.max(WEEKS - 1, 1);
  const points = buckets.map((value, index) => ({
    x: index * step,
    y: height - 3 - (value / peak) * (height - 8),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <Panel
      title="Weekly completions"
      action={
        <span
          className="text-[11.5px] font-semibold"
          style={{ color: thisWeek >= lastWeek ? "var(--success-fg)" : "var(--danger-text)" }}
        >
          {thisWeek >= lastWeek ? "▲" : "▼"} {thisWeek}
        </span>
      }
    >
      {charts.datedCompletions === 0 ? (
        <span style={{ color: "var(--text-tertiary)" }}>
          Nothing completed with a recorded date yet.
        </span>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label="Completions per week">
          <path d={`${line} L${width},${height} L0,${height} Z`} fill="var(--success-fg)" opacity="0.10" />
          <path d={line} fill="none" stroke="var(--success-fg)" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )}
    </Panel>
  );
}

/** Who is still carrying work, most first. */
function OpenByOwner({ charts }: { charts: PlanCharts }) {
  const rows = charts.byOwner
    .filter((row) => row.open > 0)
    .sort((a, b) => b.open - a.open)
    .slice(0, 6);

  const peak = Math.max(...rows.map((row) => row.open), 1);

  return (
    <Panel title="Open work by owner">
      {rows.length === 0 ? (
        <span style={{ color: "var(--text-tertiary)" }}>Nothing open.</span>
      ) : (
        rows.map((row, index) => (
          <div key={`${row.name}-${index}`} className="flex items-center gap-2">
            <OwnerAvatar name={row.name} initials={initials(row.name)} userId={null} size={19} />
            <span className="min-w-0 flex-1 truncate text-[12px]">{row.name}</span>
            <span
              className="h-1.5 w-14 shrink-0 overflow-hidden rounded-[2px]"
              style={{ background: "var(--canvas)" }}
            >
              <span
                className="block h-full"
                style={{ width: `${(row.open / peak) * 100}%`, background: "var(--accent)" }}
              />
            </span>
            <span className="w-4 shrink-0 text-right text-[11.5px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
              {row.open}
            </span>
          </div>
        ))
      )}
    </Panel>
  );
}

/** WP.17c's rail: how far each stream has got, in the order they are worked. */
function ProgressByStream({ plan }: { plan: WorkPlanDetail }) {
  return (
    <Panel title="Progress by stream">
      {plan.workstreams.length === 0 ? (
        <span style={{ color: "var(--text-tertiary)" }}>No Work Streams yet.</span>
      ) : (
        plan.workstreams.map((stream) => {
          const done = stream.tasks.filter((task) => DONE.has(task.status.toLowerCase())).length;
          const percent =
            stream.tasks.length === 0
              ? DONE.has(stream.status.toLowerCase())
                ? 100
                : 0
              : Math.round((done / stream.tasks.length) * 100);
          const ink = percent >= 100 ? "var(--success-fg)" : "var(--accent)";

          return (
            <div key={stream.id} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span
                  className="h-2 w-2 shrink-0 translate-y-px rounded-[2px]"
                  style={{ background: ink }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[12px]">{stream.name}</span>
                <span className="shrink-0 text-[11.5px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                  {percent}%
                </span>
              </div>
              <span
                className="h-1.5 overflow-hidden rounded-[2px]"
                style={{ background: "var(--canvas)" }}
              >
                <span className="block h-full" style={{ width: `${percent}%`, background: ink }} />
              </span>
            </div>
          );
        })
      )}
    </Panel>
  );
}

/**
 * The burn-up at rail size — the same two lines and the same reading, with the
 * axis and the callout left to the Charts view where there is room for them.
 */
function MiniBurnUp({ charts }: { charts: PlanCharts }) {
  const total = charts.totalTasks;
  const done = charts.datedCompletions;

  const start = charts.startedOn ? Date.parse(`${charts.startedOn}T00:00:00Z`) : null;
  const target = charts.targetOn ? Date.parse(`${charts.targetOn}T00:00:00Z`) : null;
  const now = Date.now();

  const planToday =
    start && target && target > start
      ? Math.round(Math.min(1, (now - start) / (target - start)) * total)
      : null;
  const drift = planToday === null ? null : done - planToday;

  const width = 200;
  const height = 56;

  let running = 0;
  const points: Array<{ x: number; y: number }> = [{ x: 0, y: height - 2 }];
  if (start && total > 0) {
    const span = Math.max((target ?? now) - start, 1);
    for (const row of charts.completions) {
      running += row.count;
      const at = Date.parse(`${row.day}T00:00:00Z`);
      points.push({
        x: Math.min(width, ((at - start) / span) * width),
        y: height - 2 - (running / total) * (height - 6),
      });
    }
  }
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <Panel
      title="Plan burn-up"
      action={
        drift === null ? null : (
          <span
            className="text-[11.5px] font-medium"
            style={{ color: drift < 0 ? "var(--danger-text)" : "var(--success-fg)" }}
          >
            {drift < 0 ? `${Math.abs(drift)} behind plan` : drift > 0 ? `${drift} ahead` : "on pace"}
          </span>
        )
      }
    >
      {done === 0 || total === 0 ? (
        <span style={{ color: "var(--text-tertiary)" }}>
          Nothing completed with a recorded date yet.
        </span>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={`${done} of ${total} complete`}>
            <text x={width} y="8" textAnchor="end" fontSize="8" fill="var(--text-faint)">
              {total}
            </text>
            <path
              d={`M0,${height - 2} L${width},${height - 2 - (height - 6)}`}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <path d={`${line} L${points[points.length - 1]!.x},${height} L0,${height} Z`} fill="var(--accent)" opacity="0.10" />
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>

          <span className="flex items-center gap-3 text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3.5" style={{ background: "var(--accent)" }} aria-hidden />
              Actual
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3.5" style={{ background: "var(--border-strong)" }} aria-hidden />
              Plan
            </span>
          </span>
        </>
      )}
    </Panel>
  );
}

/** The two dates and the one thing waiting, which both rails end with. */
function KeyDates({ plan, basePath }: { plan: WorkPlanDetail; basePath: string }) {
  return (
    <Panel title="Key dates">
      <span>Created {shortDate(plan.created_at)}</span>
      {plan.target_date ? <span>Target completion {shortDate(plan.target_date)}</span> : null}
      {plan.approvalsWaiting > 0 ? (
        <Link href={`${basePath}?view=kanban`} className="no-underline" style={{ color: "var(--warning-fg)" }}>
          {plan.approvalsWaiting} approval{plan.approvalsWaiting === 1 ? "" : "s"} waiting
        </Link>
      ) : null}
    </Panel>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Nothing recorded";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

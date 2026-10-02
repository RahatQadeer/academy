import { CHART_STATES, type PlanCharts } from "@/whitbyos/lib/work-plans";
import { shortDate } from "@/whitbyos/lib/format";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import {
  Card,
  Nothing,
  STATE_INK,
  STATE_LABEL,
  Tile,
} from "@/whitbyos/work-plans/[id]/components/chart-parts";

/**
 * WP.17j — the plan read as numbers.
 *
 * Every mark comes from the plan's own tasks; nothing is smoothed, projected
 * or filled in. Where the data cannot answer — a plan whose tasks were
 * finished before completions were recorded — the chart says so rather than
 * drawing a line through nothing.
 */



export function ChartsView({ charts }: { charts: PlanCharts }) {
  return (
    <div className="flex flex-col gap-3.5">
      <Tiles charts={charts} />

      <div className="flex flex-col gap-4 xl:flex-row">
        <Card
          className="min-w-0 flex-1"
          title="Tasks by work stream"
          detail={`${charts.totalTasks} task${charts.totalTasks === 1 ? "" : "s"} across ${charts.streamsTotal} stream${charts.streamsTotal === 1 ? "" : "s"}`}
          legend
        >
          <StreamBars charts={charts} />
        </Card>

        <Card
          className="w-full shrink-0 xl:w-[300px]"
          title="Tasks by status"
          detail={`Whole plan · ${charts.totalTasks} task${charts.totalTasks === 1 ? "" : "s"}`}
        >
          <StatusDonut charts={charts} />
        </Card>
      </div>

      <Card
        title="Plan burn-up"
        detail="Cumulative complete vs plan · forecast dashed"
      >
        <BurnUp charts={charts} />
      </Card>

      <div className="flex flex-col gap-4 xl:flex-row">
        <Card className="min-w-0 flex-1" title="Workload by owner" detail="Open and complete">
          <OwnerBars charts={charts} />
        </Card>

        <Card
          className="min-w-0 flex-1"
          title="Open task age"
          detail="How long open work has been waiting"
        >
          <AgeBars charts={charts} />
        </Card>
      </div>
    </div>
  );
}



function Tiles({ charts }: { charts: PlanCharts }) {
  const percent =
    charts.totalTasks > 0 ? Math.round((charts.doneTasks / charts.totalTasks) * 100) : 0;

  const overdueMoved = charts.overdue - charts.overdueLastWeek;

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="Tasks complete"
        value={String(charts.doneTasks)}
        of={`/ ${charts.totalTasks}`}
        spark={charts.trends.complete}
        sparkInk="var(--success-fg)"
        note={
          charts.doneThisWeek > 0
            ? { text: `▲ ${charts.doneThisWeek} this week`, ink: "var(--success-fg)" }
            : { text: `${percent}% of the plan`, ink: "var(--text-tertiary)" }
        }
      />

      <Tile
        label="Streams on track"
        value={String(charts.streamsOnTrack)}
        of={`/ ${charts.streamsTotal}`}
        spark={charts.trends.onTrack}
        sparkInk="var(--avatar-tan-fg)"
        note={
          // The reference names the stream — "Housing slipping" — rather than
          // counting them, because one name is more use than a number.
          charts.slipping
            ? { text: `${charts.slipping} slipping`, ink: "var(--avatar-tan-fg)" }
            : { text: "All moving", ink: "var(--success-fg)" }
        }
      />

      <Tile
        label="Overdue tasks"
        value={String(charts.overdue)}
        spark={charts.trends.overdue}
        sparkInk="var(--danger-fg)"
        note={
          overdueMoved > 0
            ? { text: `▲ ${overdueMoved} vs last week`, ink: "var(--danger-fg)" }
            : overdueMoved < 0
              ? { text: `▼ ${Math.abs(overdueMoved)} vs last week`, ink: "var(--success-fg)" }
              : charts.overdue > 0
                ? { text: "Same as last week", ink: "var(--danger-fg)" }
                : { text: "Nothing late", ink: "var(--success-fg)" }
        }
      />

      <Tile
        label="Days to target"
        value={charts.daysToTarget === null ? "Not known" : String(Math.abs(charts.daysToTarget))}
        spark={charts.trends.daysToTarget}
        sparkInk="var(--accent)"
        note={
          charts.daysToTarget === null
            ? { text: "No target date set", ink: "var(--text-tertiary)" }
            : charts.targetOn
              ? {
                  // "Jun 30 · forecast Jul 4" — the date it is meant to land on
                  // and the date today's pace actually lands on.
                  text: `${shortDate(charts.targetOn)}${
                    charts.forecastFinish ? ` · forecast ${shortDate(charts.forecastFinish)}` : ""
                  }`,
                  ink:
                    charts.forecastFinish && charts.targetOn && charts.forecastFinish > charts.targetOn
                      ? "var(--danger-fg)"
                      : "var(--text-tertiary)",
                }
              : { text: "Remaining", ink: "var(--text-tertiary)" }
        }
      />
    </div>
  );
}


/**
 * Tasks by work stream, stacked.
 *
 * The reference butts the segments together; they are drawn 2px apart here,
 * which is what keeps "Waiting" and "Planned" apart for a reader who cannot
 * separate amber from grey — the pair the palette validator flags.
 */
function StreamBars({ charts }: { charts: PlanCharts }) {
  const streams = charts.byStream;
  if (streams.length === 0) return <Nothing>No Work Streams on this plan yet.</Nothing>;

  const totals = streams.map((row) =>
    CHART_STATES.reduce((sum, state) => sum + row.counts[state], 0),
  );
  const peak = Math.max(1, ...totals);

  const top = 14;
  const base = 150;
  const height = base - top;
  const barWidth = Math.min(48, Math.max(18, 420 / streams.length - 26));
  const step = 420 / streams.length;

  const ticks = [0, 1, 2, 3].map((index) => {
    const value = Math.round((peak / 3) * index);
    return { value, y: base - (value / peak) * height };
  });

  return (
    <svg width="100%" height="158" viewBox="0 0 470 172" role="img" aria-label="Tasks by work stream">
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line
            x1="32"
            y1={tick.y}
            x2="452"
            y2={tick.y}
            stroke={tick.value === 0 ? "#e4e4e1" : "#f1f1ef"}
          />
          <text x="24" y={tick.y + 3.5} fontSize="9.5" fill="#a8a8a4" textAnchor="end">
            {tick.value}
          </text>
        </g>
      ))}

      {streams.map((row, index) => {
        const x = 32 + index * step + (step - barWidth) / 2;
        const total = totals[index];
        let cursor = base;

        return (
          <g key={`${row.name}-${index}`}>
            {CHART_STATES.map((state) => {
              const count = row.counts[state];
              if (count === 0) return null;
              const size = (count / peak) * height;
              cursor -= size;
              return (
                <rect
                  key={state}
                  x={x}
                  y={cursor}
                  width={barWidth}
                  height={Math.max(1, size - 2)}
                  /* Square-cut columns of flat fill read as a spreadsheet.
                     Three pixels of radius is enough to make them objects. */
                  rx={3}
                  fill={STATE_INK[state]}
                >
                  <title>{`${row.name}, ${count} ${STATE_LABEL[state]}`}</title>
                </rect>
              );
            })}

            {total > 0 ? (
              <text
                x={x + barWidth / 2}
                y={cursor - 6}
                fontSize="9.5"
                fontWeight="700"
                fill="rgba(55,53,47,.55)"
                textAnchor="middle"
              >
                {total}
              </text>
            ) : null}

            <text
              x={x + barWidth / 2}
              y="165"
              fontSize="10"
              fill="#8a8a86"
              textAnchor="middle"
            >
              {row.name.length > 14 ? `${row.name.slice(0, 13)}…` : row.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Tasks by status, as a ring with the count in the middle. */
function StatusDonut({ charts }: { charts: PlanCharts }) {
  const total = charts.totalTasks;
  if (total === 0) return <Nothing>No tasks on this plan yet.</Nothing>;

  const radius = 52;
  const thickness = 18;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Tasks by status">
        <g transform="rotate(-90 70 70)">
          {CHART_STATES.map((state) => {
            const count = charts.byState[state];
            if (count === 0) return null;
            const share = count / total;
            // A 2px gap, in the same surface the card sits on.
            const length = Math.max(0, share * circumference - 2);
            const dash = `${length} ${circumference - length}`;
            const element = (
              <circle
                key={state}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={STATE_INK[state]}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              >
                <title>{`${count} ${STATE_LABEL[state]}`}</title>
              </circle>
            );
            offset += share * circumference;
            return element;
          })}
        </g>
        <text x="70" y="66" fontSize="24" fontWeight="700" fill="#37352f" textAnchor="middle">
          {total}
        </text>
        <text x="70" y="84" fontSize="9.5" fill="#a8a8a4" textAnchor="middle" letterSpacing="0.05em">
          TASKS
        </text>
      </svg>

      <div className="flex w-full flex-col gap-1.5">
        {CHART_STATES.map((state) => (
          <div key={state} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: STATE_INK[state] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text-muted)" }}>
              {STATE_LABEL[state]}
            </span>
            {/* The count and its share, as the reference writes it: "14 · 52%".
                The number says how much work; the percentage says how much of
                the plan, and on a donut the second is the one being read. */}
            <span className="shrink-0 whitespace-nowrap font-medium tabular-nums">
              {charts.byState[state]}
              <span className="font-normal" style={{ color: "var(--text-tertiary)" }}>
                {" · "}
                {total === 0 ? 0 : Math.round((charts.byState[state] / total) * 100)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Who is carrying what — complete against still open. */
function OwnerBars({ charts }: { charts: PlanCharts }) {
  const owners = charts.byOwner.slice(0, 6);
  if (owners.length === 0) return <Nothing>No tasks to attribute yet.</Nothing>;

  const peak = Math.max(1, ...owners.map((row) => row.done + row.open));

  return (
    <div className="flex flex-col gap-2.5">
      {owners.map((owner) => {
        const total = owner.done + owner.open;
        const width = (total / peak) * 100;
        const share = total === 0 ? 0 : (owner.done / total) * 100;

        return (
          <div key={owner.name} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[12px]">
              <OwnerAvatar name={owner.name} initials={initialsOf(owner.name)} userId={null} size={20} />
              <span className="min-w-0 flex-1 truncate font-medium" style={{ color: "var(--ink)" }}>
                {owner.name}
              </span>
              <span className="shrink-0 whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
                {owner.done} done · {owner.open} open
              </span>
            </div>

            {/* One bar, in two tones — solid for what has been delivered and
                faded for what is still open, which is what the reference's own
                caption says it means. Two separate bars read as two people. */}
            <span
              className="block h-2 overflow-hidden rounded-[2px]"
              style={{ background: "var(--canvas)" }}
            >
              <span className="block h-full" style={{ width: `${width}%` }}>
                <span className="flex h-full w-full">
                  <span
                    className="h-full"
                    style={{ width: `${share}%`, background: "var(--accent)" }}
                    title={`${owner.done} delivered`}
                  />
                  <span
                    className="h-full flex-1"
                    style={{ background: "var(--accent)", opacity: 0.32 }}
                    title={`${owner.open} still open`}
                  />
                </span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AgeBars({ charts }: { charts: PlanCharts }) {
  const ages = charts.openAges;
  if (ages.length === 0) return <Nothing>Nothing open, every task is finished.</Nothing>;

  const buckets = AGE_BUCKETS.map((bucket, index) => ({
    ...bucket,
    ink: AGE_INK[index] ?? AGE_INK[AGE_INK.length - 1]!,
    count: ages.filter((age) => age >= bucket.from && age <= bucket.to).length,
  }));
  const peak = Math.max(1, ...buckets.map((bucket) => bucket.count));

  const average = Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
  const oldest = Math.max(...ages);
  const unassigned = charts.byOwner.find((row) => row.name === "Unassigned")?.open ?? 0;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Laid out across rather than up: the buckets are ordered, and a row per
          bucket keeps the labels readable where a column of them is not. The
          colour walks from fresh to stale so the bottom row reads as the
          problem it is. */}
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex items-center gap-2.5 text-[11.5px]">
          <span className="w-[68px] shrink-0" style={{ color: "var(--text-muted)" }}>
            {bucket.label}
          </span>
          <span
            className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-[2px]"
            style={{ background: "var(--canvas)" }}
          >
            <span
              className="block h-full"
              style={{ width: `${(bucket.count / peak) * 100}%`, background: bucket.ink }}
            />
          </span>
          <span
            className="w-4 shrink-0 text-right font-semibold tabular-nums"
            style={{ color: "var(--ink)" }}
          >
            {bucket.count}
          </span>
        </div>
      ))}

      <div
        className="mt-1 flex flex-wrap items-baseline justify-between gap-3 border-t border-line pt-2.5 text-[11.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        <span>
          Avg cycle{" "}
          <b className="font-semibold" style={{ color: "var(--ink)" }}>
            {average}d
          </b>{" "}
          · Oldest{" "}
          <b className="font-semibold" style={{ color: oldest >= 30 ? "var(--danger-text)" : "var(--ink)" }}>
            {oldest}d
          </b>
        </span>
        {unassigned > 0 ? <span>{unassigned} unassigned</span> : null}
      </div>
    </div>
  );
}

/**
 * The buckets, in WP.17j's own words: "0–7 days", "8–14", "15–30", "30+".
 *
 * Four, not five. The reference splits open work at a week, a fortnight and a
 * month, which is how long a thing has been waiting rather than how old it is.
 */
const AGE_BUCKETS = [
  { label: "0–7 days", from: 0, to: 7 },
  { label: "8–14 days", from: 8, to: 14 },
  { label: "15–30 days", from: 15, to: 30 },
  { label: "30+ days", from: 31, to: Infinity },
];

/** Fresh to stale, in the order the buckets run. */
const AGE_INK = [
  "var(--success-fg)",
  "var(--accent)",
  "var(--avatar-tan-fg)",
  "var(--danger-text)",
  "var(--danger-fg)",
];

/**
 * WP.17j's burn-up: what has actually been finished, against what finishing on
 * time would have looked like.
 *
 * The plan line is a straight run from the day the plan was made to its target
 * date, ending at every task done. It is not a schedule anybody wrote — it is
 * the even pace that would land on the target, which is what a burn-up
 * compares against.
 *
 * The actual line stops at today and does not guess beyond it. The dashed
 * continuation is the current pace carried forward, drawn only once there is a
 * pace to carry: two days of completions is not a rate.
 */
function BurnUp({ charts }: { charts: PlanCharts }) {
  const total = charts.totalTasks;

  if (total === 0 || charts.datedCompletions === 0 || !charts.startedOn) {
    return (
      <Nothing>
        Nothing has been completed with a recorded date yet, so there is no
        curve to draw. Tick a task off and it starts here.
      </Nothing>
    );
  }

  const DAY = 86_400_000;
  const start = Date.parse(`${charts.startedOn}T00:00:00Z`);
  const today = startOfDay(Date.now());
  const target = charts.targetOn ? Date.parse(`${charts.targetOn}T00:00:00Z`) : null;

  // The axis runs to whichever is later, so neither the target nor work done
  // past it falls off the end.
  const last = Math.max(today, target ?? today, ...charts.completions.map(dayOf));
  const span = Math.max(last - start, DAY);

  const W = 640;
  const H = 210;
  const PAD_L = 30;
  const PAD_R = 8;
  const PAD_B = 26;
  // Room above the plan line for the scope label, which was being drawn off
  // the top of the chart and clipped.
  const PAD_T = 26;

  const x = (at: number) => PAD_L + ((at - start) / span) * (W - PAD_L - PAD_R);
  const y = (value: number) => PAD_T + (1 - value / total) * (H - PAD_T - PAD_B);

  // Actual, one point per day that has a completion, carried to today.
  let running = 0;
  const actual: Array<{ at: number; value: number }> = [{ at: start, value: 0 }];
  for (const row of charts.completions) {
    running += row.count;
    actual.push({ at: dayOf(row), value: running });
  }
  if (actual[actual.length - 1]!.at < today) actual.push({ at: today, value: running });

  const line = (points: Array<{ at: number; value: number }>) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  // The pace so far, carried to the end of the axis — only where there is
  // enough of a run to call it a pace.
  const elapsed = Math.max(Math.round((today - dayOf(charts.completions[0]!)) / DAY), 1);
  const perDay = running / elapsed;
  const forecast =
    running < total && perDay > 0 && charts.completions.length > 1
      ? [
          { at: today, value: running },
          {
            at: Math.min(today + ((total - running) / perDay) * DAY, last),
            value: Math.min(total, running + ((last - today) / DAY) * perDay),
          },
        ]
      : null;

  // Where an even pace says the plan should be today.
  const planToday =
    target && target > start
      ? Math.round(Math.min(1, (today - start) / (target - start)) * total)
      : null;
  const drift = planToday === null ? null : running - planToday;

  const ticks = [0, Math.round(total / 3), Math.round((total * 2) / 3), total];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full min-w-[420px]"
          role="img"
          aria-label={`${running} of ${total} tasks complete`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_L}
                y1={y(tick)}
                x2={W - PAD_R}
                y2={y(tick)}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 6}
                y={y(tick) + 3}
                textAnchor="end"
                fontSize="9"
                fill="var(--text-faint)"
              >
                {tick}
              </text>
            </g>
          ))}

          {target ? (
            <>
              <path
                d={line([
                  { at: start, value: 0 },
                  { at: target, value: total },
                ])}
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <text
                x={W - PAD_R}
                y={PAD_T - 8}
                textAnchor="end"
                fontSize="9"
                fill="var(--text-faint)"
              >
                Scope · {total} task{total === 1 ? "" : "s"}
              </text>
            </>
          ) : null}

          {forecast ? (
            <path
              d={line(forecast)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.6"
            />
          ) : null}

          {/* Filled underneath, as the reference draws it — the area is what
              makes "how much of the plan is done" readable at a glance. */}
          <path
            d={`${line(actual)} L${x(actual[actual.length - 1]!.at).toFixed(1)},${(H - PAD_B).toFixed(1)} L${x(start).toFixed(1)},${(H - PAD_B).toFixed(1)} Z`}
            fill="var(--accent)"
            opacity="0.10"
          />
          <path d={line(actual)} fill="none" stroke="var(--accent)" strokeWidth="2" />
          {actual.slice(1).map((point) => (
            <circle
              key={point.at}
              cx={x(point.at)}
              cy={y(point.value)}
              r="2.4"
              fill="var(--accent)"
            />
          ))}
          <circle
            cx={x(today)}
            cy={y(running)}
            r="4"
            fill="var(--surface)"
            stroke="var(--accent)"
            strokeWidth="2"
          />

          <line
            x1={x(today)}
            y1={PAD_T}
            x2={x(today)}
            y2={H - PAD_B}
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* The reading sits on the chart, where the line it describes is —
              the reference sets it in a box beside today rather than in a
              column of numbers off to one side. */}
          <g
            transform={`translate(${
              x(today) + 8 + 124 <= W - PAD_R ? x(today) + 8 : Math.max(PAD_L + 2, x(today) - 132)
            }, ${PAD_T + 4})`}
          >
            <rect
              width="124"
              height="46"
              rx="6"
              fill="var(--surface)"
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text x="9" y="15" fontSize="8.5" fontWeight="700" fill="var(--danger-text)">
              TODAY · {shortDate(new Date(today).toISOString()).toUpperCase()}
            </text>
            <text x="9" y="29" fontSize="9.5" fill="var(--text-muted)">
              Complete
            </text>
            <text x="115" y="29" textAnchor="end" fontSize="9.5" fontWeight="700" fill="var(--ink)">
              {running}
            </text>
            {drift === null ? null : (
              <>
                <text x="9" y="41" fontSize="9.5" fill="var(--text-muted)">
                  vs plan
                </text>
                <text
                  x="115"
                  y="41"
                  textAnchor="end"
                  fontSize="9.5"
                  fontWeight="700"
                  fill={drift < 0 ? "var(--danger-text)" : "var(--success-fg)"}
                >
                  {drift > 0 ? `+${drift}` : drift}
                </text>
              </>
            )}
          </g>

          {/* The foot, at the scale's own steps rather than only its ends. */}
          {axisDates(start, last).map((at, index, all) => (
            <text
              key={at}
              x={x(at)}
              y={H - PAD_B + 13}
              // The ends anchor inward. Centred, the first and last labels hang
              // half outside the viewBox and get cut off — which is how "Sep 16"
              // came out as "Sep 1".
              textAnchor={index === 0 ? "start" : index === all.length - 1 ? "end" : "middle"}
              fontSize="9"
              fill="var(--text-faint)"
            >
              {shortDate(new Date(at).toISOString())}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex shrink-0 gap-6 lg:flex-col lg:gap-3.5">
        <span className="flex items-center gap-3 text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4" style={{ background: "var(--accent)" }} aria-hidden />
            Actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4" style={{ background: "var(--border-strong)" }} aria-hidden />
            Plan
          </span>
        </span>
      </div>
    </div>
  );
}


/**
 * Five or so evenly spaced dates along the foot of the burn-up.
 *
 * Spaced by the span rather than by the completions, so the axis reads as a
 * calendar and not as a record of when somebody happened to tick things off.
 */
function axisDates(from: number, to: number) {
  const STEPS = 5;
  const span = Math.max(to - from, 1);
  return Array.from({ length: STEPS }, (_, i) => from + (span * i) / (STEPS - 1));
}

function startOfDay(at: number) {
  const date = new Date(at);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayOf(row: { day: string }) {
  return Date.parse(`${row.day}T00:00:00Z`);
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Nothing recorded";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

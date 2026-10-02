import { CHART_STATES, type ChartState } from "@/whitbyos/lib/work-plans";
import { PLAN_INK } from "@/whitbyos/lib/plan-ink";

/**
 * The pieces WP.17j and WP.17k are both made of.
 *
 * Shared because the plan's charts and a Work Stream's charts are the same
 * screen at two scales — the same tiles, the same card, the same four states —
 * and two copies would drift the moment either was touched.
 */

/**
 * The four states, in colour.
 *
 * `planned` was `var(--border)` — the page's own hairline grey. Every task on
 * a plan that has just been drafted is planned, so every bar and the whole
 * donut came out in the colour of a divider: a legend showing four colours
 * above a chart showing none. It is a slate now, quiet enough to still read as
 * work that has not begun and dark enough to be a bar.
 */
export const STATE_INK: Record<ChartState, string> = {
  complete: PLAN_INK.complete,
  running: PLAN_INK.running,
  waiting: PLAN_INK.waiting,
  planned: PLAN_INK.planned,
};

export const STATE_LABEL: Record<ChartState, string> = {
  complete: "Complete",
  running: "Running",
  waiting: "Waiting",
  planned: "Planned",
};

export function Card({
  title,
  detail,
  legend,
  className,
  children,
}: {
  title: string;
  detail: string;
  legend?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[10px] border border-line px-4 py-3.5 ${className ?? ""}`}>
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{title}</div>
          <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {detail}
          </div>
        </div>

        {legend ? (
          <div
            className="ml-auto flex flex-wrap gap-3 text-[10.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {CHART_STATES.map((state) => (
              <span key={state} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: STATE_INK[state] }}
                  aria-hidden
                />
                {STATE_LABEL[state]}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}

export /** Nothing to draw is worth saying, rather than an empty frame. */
function Nothing({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
      {children}
    </p>
  );
}

export function Tile({
  label,
  value,
  of,
  note,
  spark,
  sparkInk,
}: {
  label: string;
  value: string;
  of?: string;
  note: { text: string; ink: string };
  /** WP.17j sets a 104×28 spark beside the figure on every tile. */
  spark?: number[];
  /**
   * The spark's own colour. The reference gives each tile one and keeps it —
   * green, tan, red, blue — rather than borrowing the note's, which changes
   * with the reading and would leave four sparks the same colour on a good
   * week and four different ones on a bad.
   */
  sparkInk?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-line px-3.5 py-[11px]">
      <div
        className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </div>

      <div className="flex items-end justify-between gap-2.5">
        <div className="min-w-0">
          <div className="whitespace-nowrap text-[22px] font-bold leading-none">
            {value}
            {of ? (
              <span className="text-[13px] font-medium" style={{ color: "var(--text-quiet)" }}>
                {" "}
                {of}
              </span>
            ) : null}
          </div>
          <div className="mt-[5px] whitespace-nowrap text-[11px]" style={{ color: note.ink }}>
            {note.text}
          </div>
        </div>

        {spark && spark.length > 1 ? <Spark series={spark} ink={sparkInk ?? note.ink} /> : null}
      </div>
    </div>
  );
}

/**
 * The tile's own line — 104×28, filled underneath, with the last reading marked.
 *
 * A flat series is drawn as a flat line rather than skipped: on these tiles
 * "nothing changed for eight weeks" is a reading, not an absence. What is
 * skipped is a series with nothing in it at all.
 */
function Spark({ series, ink }: { series: number[]; ink: string }) {
  const W = 104;
  const H = 28;
  const peak = Math.max(...series);
  const floor = Math.min(...series);
  const span = Math.max(peak - floor, 1);
  const step = W / (series.length - 1);

  const points = series.map((value, index) => ({
    x: index * step,
    y: H - 2 - ((value - floor) / span) * (H - 6),
  }));

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1]!;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block shrink-0" aria-hidden>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={ink} opacity="0.12" />
      <path d={line} fill="none" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.6" fill={ink} />
    </svg>
  );
}

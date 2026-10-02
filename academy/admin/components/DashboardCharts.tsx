/** Lightweight SVG charts — no chart library, matches Academy tokens. */

export type ChartSlice = {
  label: string;
  value: number;
  color: string;
};

function totalOf(slices: ChartSlice[]) {
  return slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
}

export function DonutChart({
  slices,
  size = 156,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  slices: ChartSlice[];
  size?: number;
  thickness?: number;
  centerLabel: string;
  centerValue: string;
}) {
  const total = totalOf(slices);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const visible = slices.filter((slice) => slice.value > 0);
  // Small breathing gap between segments so colours read as distinct chips.
  const gap = visible.length > 1 ? 4 : 0;

  let offset = 0;
  const arcs =
    total <= 0
      ? [
          {
            key: "empty",
            color: "var(--border)",
            dash: circumference,
            offset: 0,
          },
        ]
      : visible.map((slice) => {
          const length = (slice.value / total) * circumference;
          const arc = {
            key: slice.label,
            color: slice.color,
            dash: Math.max(0, length - gap),
            offset: -offset,
          };
          offset += length;
          return arc;
        });

  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {/* Recessed track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--surface-soft)"
          strokeWidth={thickness + 2}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={thickness}
          strokeDasharray="1.5 6"
          strokeLinecap="round"
          opacity={total <= 0 ? 0 : 0.5}
        />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{
              transition: "stroke-dasharray 500ms cubic-bezier(0.22,1,0.36,1), stroke-dashoffset 500ms cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <p
          className="font-bold tabular-nums leading-none text-ink"
          style={{ fontSize: size >= 140 ? 26 : 20, letterSpacing: "-0.5px" }}
        >
          {centerValue}
        </p>
        <p
          className="mt-1 text-[10px] font-semibold uppercase tracking-[0.07em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {centerLabel}
        </p>
      </div>
    </div>
  );
}

export function StackedBar({
  slices,
  height = 14,
}: {
  slices: ChartSlice[];
  height?: number;
}) {
  const total = totalOf(slices);
  if (total <= 0) {
    return (
      <div
        className="w-full overflow-hidden rounded-full"
        style={{ height, background: "var(--surface-soft)", boxShadow: "inset 0 0 0 1px var(--border)" }}
        aria-hidden
      />
    );
  }

  const visible = slices.filter((slice) => slice.value > 0);

  return (
    <div
      className="flex w-full items-stretch gap-[3px] overflow-hidden rounded-full p-[3px]"
      style={{ height, background: "var(--surface-soft)", boxShadow: "inset 0 0 0 1px var(--border)" }}
      role="img"
      aria-label={visible.map((s) => `${s.label}: ${s.value}`).join(", ")}
    >
      {visible.map((slice) => (
        <span
          key={slice.label}
          className="h-full min-w-[3px] rounded-full transition-[flex-grow] duration-500 ease-out"
          style={{
            flexGrow: slice.value,
            flexBasis: 0,
            background: slice.color,
          }}
          title={`${slice.label}: ${slice.value}`}
        />
      ))}
    </div>
  );
}

export function VerticalBars({
  slices,
  maxHeight = 96,
}: {
  slices: ChartSlice[];
  maxHeight?: number;
}) {
  const peak = Math.max(1, ...slices.map((slice) => slice.value));
  const labelSpace = maxHeight <= 72 ? 34 : 42;

  return (
    <div
      className="relative flex h-full items-end justify-between gap-3 pt-1"
      style={{ minHeight: maxHeight + labelSpace }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-1 flex flex-col justify-between"
        style={{ bottom: labelSpace }}
      >
        {[0, 1, 2].map((line) => (
          <span key={line} className="block h-px w-full" style={{ background: "var(--border)", opacity: 0.6 }} />
        ))}
      </div>
      {slices.map((slice) => {
        const pct = slice.value / peak;
        const barHeight = Math.max(slice.value > 0 ? 8 : 3, Math.round(pct * maxHeight));
        return (
          <div key={slice.label} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <p className="text-[12.5px] font-bold tabular-nums text-ink">{slice.value.toLocaleString()}</p>
            <div className="flex w-full items-end justify-center" style={{ height: maxHeight }}>
              <span
                className="group w-full max-w-[32px] rounded-t-[6px] rounded-b-[2px] transition-[height] duration-500 ease-out"
                style={{
                  height: barHeight,
                  background:
                    slice.value > 0
                      ? `linear-gradient(180deg, ${slice.color} 0%, color-mix(in srgb, ${slice.color} 78%, #000) 100%)`
                      : "var(--border)",
                  boxShadow:
                    slice.value > 0
                      ? `0 2px 6px color-mix(in srgb, ${slice.color} 28%, transparent), inset 0 1px 0 color-mix(in srgb, #fff 30%, transparent)`
                      : undefined,
                }}
                title={`${slice.label}: ${slice.value}`}
              />
            </div>
            <span
              className="w-full truncate text-center text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {slice.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ChartLegend({ slices }: { slices: ChartSlice[] }) {
  const total = totalOf(slices);

  return (
    <ul className="space-y-1">
      {slices.map((slice) => {
        const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
        return (
          <li
            key={slice.label}
            className="flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 transition-colors hover:bg-[var(--surface-soft)]"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: slice.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${slice.color} 16%, transparent)` }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {slice.label}
            </span>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
              {slice.value.toLocaleString()}
            </span>
            <span
              className="w-9 shrink-0 text-right text-[11.5px] font-medium tabular-nums"
              style={{ color: "var(--text-tertiary)" }}
            >
              {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** One row per status with count, share, and proportional track — clearer than a thin stacked pill. */
export function ProgressBreakdown({
  slices,
  emptyLabel = "No data yet",
}: {
  slices: ChartSlice[];
  emptyLabel?: string;
}) {
  const total = totalOf(slices);
  const rows = slices.filter((slice) => slice.value > 0 || total === 0);

  if (total <= 0) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="h-2.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--surface-soft)", boxShadow: "inset 0 0 0 1px var(--border)" }}
          aria-hidden
        />
        <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5" aria-label="Enrollment status breakdown">
      {rows.map((slice) => {
        const pct = Math.round((slice.value / total) * 100);
        return (
          <li key={slice.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: slice.color,
                    boxShadow: `0 0 0 2px color-mix(in srgb, ${slice.color} 18%, transparent)`,
                  }}
                  aria-hidden
                />
                <span className="truncate text-[12.5px] font-medium text-ink">{slice.label}</span>
              </div>
              <div className="flex shrink-0 items-baseline gap-1.5">
                <span className="text-[13px] font-semibold tabular-nums tracking-[-0.15px] text-ink">
                  {slice.value.toLocaleString()}
                </span>
                <span className="w-7 text-right text-[11.5px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                  {pct}%
                </span>
              </div>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: "var(--surface-soft)", boxShadow: "inset 0 0 0 1px var(--border)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.max(pct, slice.value > 0 ? 4 : 0)}%`,
                  background: `linear-gradient(90deg, ${slice.color} 0%, color-mix(in srgb, ${slice.color} 82%, #000) 100%)`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

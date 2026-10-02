import Link from "next/link";
import type { MonthRow } from "@/whitbyos/lib/overview-board";

const DONUT = ["#2383e2", "#f0a05a", "#6cc07a", "#e07a7a", "#7b8cde", "#c9a227"];

const RANK = [
  { bg: "#e7f2fb", fg: "#1f6fbf", place: "1st" },
  { bg: "#fde8ef", fg: "#c45a7a", place: "2nd" },
  { bg: "#f8efd2", fg: "#9a7a1f", place: "3rd" },
] as const;

type Slice = { name: string; value: number; color: string };

type Recent = {
  id: string;
  title: string;
  note: string;
  href: string;
};

export function OverviewDashboard({
  year,
  trend,
  slices,
  top,
  progress,
  recent,
  recentHref,
}: {
  year: number;
  trend: MonthRow[];
  slices: Slice[];
  top: { name: string; value: number }[];
  progress: { label: string; value: number }[];
  recent: Recent[];
  recentHref: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="grid w-full gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section className="ws-dash-card flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-quiet)" }}>
              Requests this year
            </h3>
            <span className="rounded-control border px-2.5 py-[3px] text-[12px]" style={{ borderColor: "var(--chrome-line)", color: "var(--text-secondary)" }}>
              {year}
            </span>
          </div>
          <AreaChart months={trend} />
        </section>

        <section className="ws-dash-card flex flex-col p-5">
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-quiet)" }}>
            Where the work sits
          </h3>
          <Donut slices={slices} total={total} />
        </section>
      </div>

      <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-3">
        <section className="ws-dash-card p-5">
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-quiet)" }}>
            Top clients
          </h3>
          {top.length === 0 ? (
            <p className="py-6 text-center text-[13px]" style={{ color: "var(--text-secondary)" }}>
              No workspaces yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {top.slice(0, 3).map((row, index) => {
                const tone = RANK[index] ?? RANK[2];
                return (
                  <div
                    key={row.name}
                    className="flex flex-col rounded-[12px] px-2.5 py-3"
                    style={{ background: tone.bg }}
                  >
                    <span className="truncate text-[10.5px] font-semibold" style={{ color: tone.fg }}>
                      {tone.place} {row.name}
                    </span>
                    <span className="mt-2 text-[22px] font-bold leading-none tabular-nums" style={{ color: "var(--ink)" }}>
                      {row.value}
                    </span>
                    <span className="mt-1 text-[11px]" style={{ color: "var(--text-quiet)" }}>
                      {row.value === 1 ? "request" : "requests"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="ws-dash-card p-5">
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-quiet)" }}>
            Work progress
          </h3>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {progress.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-[13.5px]">{row.label}</span>
                <span className="text-[15px] font-semibold tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ws-dash-card flex flex-col p-5 md:col-span-2 xl:col-span-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-quiet)" }}>
              Recent
            </h3>
            <Link href={recentHref} className="text-[11.5px] font-semibold no-underline" style={{ color: "var(--accent)" }}>
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-6 text-center text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Nothing has moved yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {recent.map((row) => (
                <li key={row.id}>
                  <Link href={row.href} className="block no-underline" style={{ color: "var(--ink)" }}>
                    <span className="block truncate text-[13.5px] leading-snug">{row.title}</span>
                    <span className="mt-0.5 block truncate text-[12px]" style={{ color: "var(--text-quiet)" }}>
                      {row.note}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function donutSlices(rows: { name: string; value: number }[]): Slice[] {
  const live = rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  if (live.length === 0) return [];

  const head = live.slice(0, 5);
  const rest = live.slice(5).reduce((sum, row) => sum + row.value, 0);
  const packed = rest > 0 ? [...head, { name: "Other", value: rest }] : head;

  return packed.map((row, index) => ({
    ...row,
    color: DONUT[index % DONUT.length],
  }));
}

export function AreaChart({ months }: { months: MonthRow[] }) {
  const values = months.map((month) => month.opened + month.closed);
  const peak = Math.max(2, ...values);
  const top = Math.ceil(peak * 1.15);
  const w = 640;
  const h = 220;
  const pad = { l: 28, r: 8, t: 16, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const points = values.map((value, index) => ({
    x: pad.l + (index / Math.max(1, values.length - 1)) * innerW,
    y: pad.t + innerH - (value / top) * innerH,
  }));
  const line = smooth(points);
  const area = `${line} L ${points[points.length - 1]?.x ?? pad.l} ${pad.t + innerH} L ${points[0]?.x ?? pad.l} ${pad.t + innerH} Z`;
  const ticks = [top, Math.round(top / 2), 0];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[220px] w-full" role="img" aria-label="Requests opened and closed by month">
      <defs>
        <linearGradient id="ws-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2383e2" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2383e2" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick, index) => {
        const y = pad.t + (index / 2) * innerH;
        return (
          <g key={tick}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-quiet)">
              {tick}
            </text>
          </g>
        );
      })}
      {values.some((value) => value > 0) ? (
        <>
          <path d={area} fill="url(#ws-area-fill)" />
          <path d={line} fill="none" stroke="#2383e2" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        </>
      ) : (
        <text x={w / 2} y={h / 2} textAnchor="middle" fontSize="13" fill="var(--text-secondary)">
          Fills in as requests are taken on.
        </text>
      )}
      {months.map((month, index) => (
        <text
          key={`${month.label}-${index}`}
          x={pad.l + (index / Math.max(1, months.length - 1)) * innerW}
          y={h - 8}
          textAnchor="middle"
          fontSize="10"
          fill="var(--text-quiet)"
        >
          {month.label}
        </text>
      ))}
    </svg>
  );
}

export function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const stroke = 22;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const rings =
    total === 0
      ? [
          <circle
            key="empty"
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth={stroke}
          />,
        ]
      : slices.map((slice) => {
          const length = (slice.value / total) * circ;
          const node = (
            <circle
              key={slice.name}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={stroke}
              strokeDasharray={`${length} ${circ - length}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          );
          offset += length;
          return node;
        });

  return (
    <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`${total} active requests`}>
        {rings}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink)">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="var(--text-quiet)">
          requests
        </text>
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {(slices.length ? slices : [{ name: "No open requests", value: 0, color: "var(--border-strong)" }]).map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="shrink-0 tabular-nums" style={{ color: "var(--text-quiet)" }}>
              {total === 0 ? "0%" : `${Math.round((slice.value / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function smooth(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

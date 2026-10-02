import type { SwitcherOverview } from "@/base/switcher/overview";
import { StatusRing } from "@/base/switcher/StatusRing";

const W = 560;
const H = 168;
const PAD = { left: 28, right: 10, top: 14, bottom: 28 };

function linePath(values: number[], max: number) {
  const span = W - PAD.left - PAD.right;
  const height = H - PAD.top - PAD.bottom;
  return values.map((value, index) => {
    const x = PAD.left + (values.length === 1 ? span : (span * index) / (values.length - 1));
    const y = PAD.top + height - (max === 0 ? 0 : (value / max) * height);
    return { x, y };
  });
}

export function WhitbyPanel({ data }: { data: SwitcherOverview["whitby"] }) {
  const hasWork = data.stats.some((stat) => Number(stat.value) > 0) || data.recent.length > 0;
  const peak = Math.max(...data.weeks, 0);
  const max = Math.max(4, ...data.weeks);
  const points = linePath(data.weeks, max);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area =
    points.length > 0
      ? `${line} L${points.at(-1)!.x},${H - PAD.bottom} L${points[0]!.x},${H - PAD.bottom} Z`
      : "";

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      {data.stats.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--border)", gap: 1 }}>
          {data.stats.map((stat) => (
            <div key={stat.label} className="bg-surface px-5 py-4">
              <div
                className="text-[26px] font-bold leading-none tracking-[-0.5px]"
                style={{ color: stat.direction === "down" && Number(stat.value) > 0 ? "var(--danger-fg)" : "var(--ink)" }}
              >
                {stat.value}
              </div>
              <div className="mt-1.5 text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                {stat.label}
              </div>
              <div
                className="mt-1 text-[11.5px]"
                style={{
                  color:
                    stat.direction === "up"
                      ? "var(--success-fg)"
                      : stat.direction === "down" && Number(stat.value) > 0
                        ? "var(--danger-text, var(--danger-fg))"
                        : "var(--text-tertiary)",
                }}
              >
                {stat.trend}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        className="grid lg:grid-cols-[1.45fr_1fr]"
        style={{ borderTop: data.stats.length > 0 ? "1px solid var(--border)" : undefined }}
      >
        <div className="p-5 lg:border-r lg:border-line">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold">Active requests, last 8 weeks</div>
              <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                Counted from live request open and close dates
              </div>
            </div>
            {peak > 0 ? (
              <span className="text-[11.5px] font-medium" style={{ color: "var(--accent)" }}>
                Peak {peak}
              </span>
            ) : null}
          </div>

          {peak === 0 ? (
            <div
              className="flex h-[168px] flex-col items-center justify-center rounded-[8px] border border-dashed border-line"
              style={{ background: "var(--surface-soft)" }}
            >
              <div className="text-[13px] font-medium">No requests in this window</div>
              <p className="mt-1 max-w-[260px] text-center text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                The line fills in as client work opens. Nothing here is a placeholder.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Active requests over the last eight weeks">
                <defs>
                  <linearGradient id="pa-glance-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2383e2" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#2383e2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 1, 2, 3].map((step) => {
                  const value = (max / 3) * (3 - step);
                  const y = PAD.top + ((H - PAD.top - PAD.bottom) * step) / 3;
                  return (
                    <g key={step}>
                      <line
                        x1={PAD.left}
                        y1={y}
                        x2={W - PAD.right}
                        y2={y}
                        stroke={step === 3 ? "#ececea" : "#f1f1ef"}
                      />
                      <text x={PAD.left - 7} y={y + 3.5} fontSize="9.5" fill="rgba(55,53,47,.35)" textAnchor="end">
                        {Math.round(value)}
                      </text>
                    </g>
                  );
                })}
                {area ? <path d={area} fill="url(#pa-glance-fill)" /> : null}
                {line ? (
                  <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
                ) : null}
                {points.map((point, index) => (
                  <circle key={index} cx={point.x} cy={point.y} r="2.6" fill="var(--accent)" />
                ))}
                {points.length > 0 ? (
                  <circle
                    cx={points.at(-1)!.x}
                    cy={points.at(-1)!.y}
                    r="4.5"
                    fill="#fff"
                    stroke="var(--accent)"
                    strokeWidth="2"
                  />
                ) : null}
                {points.map((point, index) => (
                  <text
                    key={data.weekLabels[index] ?? index}
                    x={point.x}
                    y={H - 8}
                    fontSize="9"
                    fill="rgba(55,53,47,.4)"
                    textAnchor="middle"
                  >
                    {data.weekLabels[index] ?? ""}
                  </text>
                ))}
              </svg>
            </div>
          )}
        </div>

        <div className="border-t border-line p-5 lg:border-t-0">
          <div className="text-[13px] font-semibold">In flight</div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            {data.recent.length > 0 ? "Open requests from your workspaces" : "Nothing open right now"}
          </div>
          {data.recent.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {data.recent.map((row) => (
                <li key={row.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: row.colour }} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{row.title}</div>
                    <div className="truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                      {row.client} · {row.status}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <StatusRing rows={data.byStatus} />
          )}
        </div>
      </div>

      {hasWork && data.households.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-5 py-3">
          <span className="mr-1 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            Households
          </span>
          {data.households.map((name, index) => (
            <span
              key={`${name}-${index}`}
              className="rounded-[6px] px-2 py-0.5 text-[12px] font-medium"
              style={{ background: "var(--module-whitby-bg)", color: "var(--module-whitby-fg)" }}
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

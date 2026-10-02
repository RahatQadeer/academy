"use client";

import { useState } from "react";

export function StatusRing({
  rows,
}: {
  rows: { label: string; count: number; colour: string }[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const circumference = 2 * Math.PI * 52;
  let offset = 0;

  if (total === 0) {
    return (
      <div className="mt-5 flex items-center gap-4">
        <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
          <circle cx="44" cy="44" r="32" fill="none" stroke="#ececea" strokeWidth="10" />
          <text x="44" y="48" textAnchor="middle" fontSize="18" fontWeight="700" fill="#37352f">
            0
          </text>
        </svg>
        <p className="max-w-[200px] text-[12.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          Open requests from your workspaces will list here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-5">
      <svg width="130" height="130" viewBox="0 0 140 140" role="img" aria-label="Open requests by status">
        {rows.map((row) => {
          const length = (row.count / total) * circumference;
          const dash = `${length.toFixed(1)} ${(circumference - length).toFixed(1)}`;
          const current = -offset;
          offset += length;
          const dim = active !== null && active !== row.label;
          return (
            <circle
              key={row.label}
              cx="70"
              cy="70"
              r="52"
              fill="none"
              stroke={row.colour}
              strokeWidth={active === row.label ? 18 : 15}
              strokeDasharray={dash}
              strokeDashoffset={current}
              transform="rotate(-90 70 70)"
              opacity={dim ? 0.28 : 1}
              className="cursor-pointer transition-[stroke-width,opacity] duration-150"
              onMouseEnter={() => setActive(row.label)}
              onMouseLeave={() => setActive(null)}
            />
          );
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="700" fill="#37352f">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="10" fill="rgba(55,53,47,.5)">
          open
        </text>
      </svg>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onMouseEnter={() => setActive(row.label)}
            onMouseLeave={() => setActive(null)}
            className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-left transition-colors"
            style={{
              background: active === row.label ? "var(--surface-soft)" : "transparent",
            }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.colour }} />
            <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
              {row.label}
            </span>
            <span className="text-[12.5px] font-semibold">{row.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

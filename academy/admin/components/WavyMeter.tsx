"use client";

import { useEffect, useState } from "react";

/** Soft sine-wave meter — sine stroke, wash, round CSS tip (never ovalized by stretch). */
export function WavyMeter({
  pct,
  color,
  id,
  delayMs = 0,
}: {
  pct: number;
  color: string;
  id: string;
  delayMs?: number;
}) {
  const target = Math.max(0, Math.min(100, pct));
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFill(target);
      return;
    }
    const fillTimer = window.setTimeout(() => setFill(target), 40 + delayMs);
    return () => window.clearTimeout(fillTimer);
  }, [target, delayMs]);

  const uid = `wm-${id}`;
  const vbW = 480;
  const vbH = 36;
  const mid = vbH / 2;
  const amp = 7.2;
  const periods = 2.75;
  const steps = 80;
  const phase = id === "instructors" ? 0.55 : id === "admins" ? 1.15 : 0;

  let wave = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * vbW;
    const y = mid + Math.sin(t * periods * Math.PI * 2 + phase) * amp;
    wave += i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : ` L${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  const wash = `${wave} L${vbW} ${vbH} L0 ${vbH} Z`;
  const showTip = target >= 1.5;

  return (
    <div className="relative mt-2.5 h-[18px] w-full" aria-hidden>
      <div
        className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
        style={{ background: "var(--surface-soft, #f7f7f5)" }}
      />

      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
        role="presentation"
      >
        <defs>
          <linearGradient id={`${uid}-track`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d9d9d6" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#d9d9d6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#d9d9d6" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        <path
          d={wave}
          fill="none"
          stroke={`url(#${uid}-track)`}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: `${fill}%`,
          transition: "width 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <svg
            viewBox={`0 0 ${vbW} ${vbH}`}
            className="absolute inset-y-0 left-0 h-full overflow-visible"
            style={{ width: `${fill > 0 ? 10000 / fill : 100}%`, maxWidth: "none" }}
            preserveAspectRatio="none"
            role="presentation"
          >
            <defs>
              <linearGradient id={`${uid}-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="12%" stopColor={color} stopOpacity="0.92" />
                <stop offset="70%" stopColor={color} stopOpacity="1" />
                <stop offset="100%" stopColor={color} stopOpacity="0.88" />
              </linearGradient>
              <linearGradient id={`${uid}-wash`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.26" />
                <stop offset="45%" stopColor={color} stopOpacity="0.1" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
              <filter id={`${uid}-glow`} x="-8%" y="-80%" width="116%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
                  result="soft"
                />
                <feMerge>
                  <feMergeNode in="soft" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path d={wash} fill={`url(#${uid}-wash)`} />
            <path
              d={wave}
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.2"
              filter={`url(#${uid}-glow)`}
            />
            <path
              d={wave}
              fill="none"
              stroke={`url(#${uid}-stroke)`}
              strokeWidth="2.85"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={wave}
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.42"
              transform="translate(0 -1.5)"
            />
          </svg>
        </div>

        {showTip ? (
          <span
            className="pointer-events-none absolute top-1/2 right-0 z-[1] block rounded-full bg-white"
            style={{
              width: 11,
              height: 11,
              marginRight: -5.5,
              marginTop: -5.5,
              border: `2px solid ${color}`,
              boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 18%, transparent), 0 1px 3px rgba(15,15,15,.12)`,
              opacity: fill > 0 ? 1 : 0,
              transition: "opacity 0.25s ease",
              animation: fill > 0 ? "sa-wave-tip 2.6s ease-in-out infinite" : undefined,
              willChange: "transform",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

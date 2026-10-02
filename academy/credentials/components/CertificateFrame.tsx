const NAVY = "#0e2b5b";
const PAPER = "#faf8f5";
const SEAL_LIGHT = "#8eb8d4";
const SEAL_MID = "#5a8fb8";
const SEAL_DARK = "#3d6f99";

function scallopedCircle(cx: number, cy: number, outerR: number, innerR: number, teeth: number) {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const a = (Math.PI * 2 * i) / (teeth * 2) - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  return pts.join(" ");
}

/** Corner flourish — two arcs meeting at a point in the margin */
function CornerFlourish({ x, y, rotate }: { x: number; y: number; rotate: number }) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotate})`}>
      <path
        d="M 0 0 C 16 0, 0 16, -14 -14"
        fill="none"
        stroke={NAVY}
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path
        d="M 0 0 C 0 16, 16 0, -14 -14"
        fill="none"
        stroke={NAVY}
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Decorative frame, ribbon, and seal — no text */
export function CertificateFrame() {
  const w = 1024;
  const h = 729;
  const outer = 14;
  const inner = 28;
  const ribbonW = 118;
  const ribbonTop = inner;
  const ribbonBottom = h - inner - 52;
  const ribbonX = w - inner - ribbonW;
  const notchY = ribbonBottom + 48;
  const sealCx = ribbonX + ribbonW / 2;
  const sealCy = 132;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {/* Outer thick border */}
      <rect x="0" y="0" width={w} height={h} fill={NAVY} />
      <rect x={outer} y={outer} width={w - outer * 2} height={h - outer * 2} fill={PAPER} />

      {/* Inner thin border */}
      <rect
        x={inner}
        y={inner}
        width={w - inner * 2}
        height={h - inner * 2}
        fill="none"
        stroke={NAVY}
        strokeWidth="1.2"
      />

      {/* Corner flourishes */}
      <CornerFlourish x={inner} y={inner} rotate={0} />
      <CornerFlourish x={w - inner} y={inner} rotate={90} />
      <CornerFlourish x={w - inner} y={h - inner} rotate={180} />
      <CornerFlourish x={inner} y={h - inner} rotate={270} />

      {/* Ribbon + fishtail */}
      <path
        d={`M ${ribbonX} ${ribbonTop}
            H ${ribbonX + ribbonW}
            V ${ribbonBottom}
            L ${sealCx} ${notchY}
            L ${ribbonX} ${ribbonBottom}
            Z`}
        fill={NAVY}
      />

      {/* Seal */}
      <defs>
        <radialGradient id="certSealGrad" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor={SEAL_LIGHT} />
          <stop offset="55%" stopColor={SEAL_MID} />
          <stop offset="100%" stopColor={SEAL_DARK} />
        </radialGradient>
      </defs>
      <polygon
        points={scallopedCircle(sealCx, sealCy, 58, 50, 28)}
        fill="url(#certSealGrad)"
      />
      <circle cx={sealCx} cy={sealCy} r="38" fill="rgba(255,255,255,0.12)" />
      <circle
        cx={sealCx}
        cy={sealCy}
        r="30"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.1"
      />
      {/* Eagle icon */}
      <g transform={`translate(${sealCx}, ${sealCy})`} fill="#e8f2f8">
        <path d="M0-24c-2.5-8-10-13-19-13 8 4.5 11.5 9.5 9.5 16.5-8-6-17-4.5-23 5 11.5-1.5 21 4 26.5 15.5 5.5-11.5 15-17 26.5-15.5-6-10.5-15-16-23-5 1.5-8 6.5-9.5 14.5-9.5 1-16.5 6-19 14z" />
      </g>
    </svg>
  );
}

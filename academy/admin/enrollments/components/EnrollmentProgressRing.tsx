function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2L4.8 8.5 9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IdleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.2 2.4" />
      <path
        d="M6.1 5.1v3.8L9.2 7 6.1 5.1z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

function ProgressIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M6 2.2v3.3l2.2 1.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="6" r="3.9" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
    </svg>
  );
}

export function EnrollmentProgressRing({
  value,
  complete,
  size = 36,
  showCaption = true,
}: {
  value: number;
  complete?: boolean;
  size?: number;
  showCaption?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, value));
  const done = complete || percent >= 100;
  const stroke = size >= 88 ? 6 : 3.2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const centerLabel = size >= 88;

  if (done && !centerLabel) {
    return (
      <span className="inline-flex items-center gap-2.5">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
          aria-hidden
        >
          <CheckIcon />
        </span>
        {showCaption ? (
          <span className="text-[13px] font-medium" style={{ color: "var(--success-fg)" }}>
            Complete
          </span>
        ) : null}
      </span>
    );
  }

  if (percent <= 0 && !centerLabel) {
    return (
      <span className="inline-flex items-center gap-2.5">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: "var(--surface-soft)",
            color: "var(--text-tertiary)",
            boxShadow: "inset 0 0 0 1.5px var(--border-strong)",
          }}
          aria-hidden
          title="Not started"
        >
          <IdleIcon />
        </span>
        {showCaption ? (
          <span className="text-[13px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            0%
          </span>
        ) : null}
      </span>
    );
  }

  const ring = (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={done ? "var(--success-fg)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={
            centerLabel
              ? {
                  ["--ring-circ" as string]: circumference,
                  ["--ring-offset" as string]: offset,
                  animation: "academy-enrollment-ring 900ms cubic-bezier(0.22, 1, 0.36, 1) both",
                }
              : undefined
          }
        />
      </svg>
      {centerLabel ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          {done ? (
            <span style={{ color: "var(--success-fg)" }}>
              <CheckIcon size={18} />
            </span>
          ) : (
            <span className="text-[22px] font-semibold tabular-nums leading-none tracking-[-0.6px]">
              {percent}
              <span className="text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                %
              </span>
            </span>
          )}
        </span>
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: done ? "var(--success-fg)" : "var(--accent)" }}
          aria-hidden
        >
          {done ? <CheckIcon size={11} /> : <ProgressIcon size={11} />}
        </span>
      )}
    </span>
  );

  if (centerLabel || !showCaption) return ring;

  return (
    <span className="inline-flex items-center gap-2.5">
      {ring}
      <span className="text-[13px] font-medium tabular-nums">{percent}%</span>
    </span>
  );
}

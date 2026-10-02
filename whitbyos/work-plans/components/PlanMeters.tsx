import { Pill } from "@/base/components/Pill";
import type { Health, Urgency } from "@/whitbyos/lib/work-plans";
import { statusLabel } from "@/whitbyos/lib/format";

const HEALTH: Record<Health, { tone: "success" | "warning" | "danger"; label: string }> = {
  on_track: { tone: "success", label: "On Track" },
  needs_attention: { tone: "warning", label: "Needs Attention" },
  at_risk: { tone: "danger", label: "At Risk" },
};

const URGENCY: Record<Urgency, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Health as a pill. WP.17 writes the word inside it — "Health: On Track" — so
 * the label travels with the colour rather than sitting beside it in loose
 * text; WP.2's column has the heading above it already and passes no prefix.
 */
export function HealthPill({ health, prefix }: { health: Health; prefix?: string }) {
  const meta = HEALTH[health] ?? HEALTH.on_track;
  return (
    <Pill tone={meta.tone}>
      {prefix}
      {meta.label}
    </Pill>
  );
}

/** WP.17 writes the health as a word in the meta line, without its pill. */
export function healthLabel(health: Health) {
  return (HEALTH[health] ?? HEALTH.on_track).label;
}

/**
 * The status word in WP.17's meta line, and the one colour on it.
 *
 * The reference tints only the status — running in the info ink, complete in
 * the success one, anything not started or paused left grey. The rest of the
 * line is a single muted colour, so the eye lands on the state and not on
 * four competing ones.
 */
const STATUS_INK: Record<string, string> = {
  running: "var(--info-fg)",
  in_progress: "var(--info-fg)",
  open: "var(--info-fg)",
  complete: "var(--success-fg)",
  completed: "var(--success-fg)",
  blocked: "var(--danger-text)",
  overdue: "var(--danger-text)",
};

export function planStatusColour(status: string) {
  const key = status?.toLowerCase().replace(/\s+/g, "_") ?? "";
  return STATUS_INK[key] ?? "var(--text-secondary)";
}

export function planStatusLabel(status: string) {
  return statusLabel(status);
}

export function urgencyLabel(urgency: Urgency) {
  return URGENCY[urgency] ?? "Medium";
}

/**
 * WP.17's own meter: a full-width 8px bar with the count beside it, rather than
 * WP.2's 60px one. The fill turns green at 100% — the reference colours a
 * finished bar with the success green, not the accent blue.
 */
export function PlanProgressBar({
  percent,
  done,
  total,
  gap = 16,
}: {
  percent: number;
  done: number;
  total: number;
  /** WP.17 leaves 16px under the bar; the draft screens leave 24. */
  gap?: number;
}) {
  return (
    <div className="flex items-center gap-2.5" style={{ marginBottom: gap }}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-[4px]"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-[4px]"
          style={{
            width: `${percent}%`,
            background: percent >= 100 ? "var(--success-fg)" : "var(--accent)",
          }}
        />
      </div>
      <span className="shrink-0 text-[12.5px]" style={{ color: "rgba(55,53,47,.55)" }}>
        {done} of {total} task{total === 1 ? "" : "s"} complete · {percent}%
      </span>
    </div>
  );
}

/** Bar plus percentage, as WP.2 draws it. */
export function ProgressMeter({
  percent,
  done,
  total,
}: {
  percent: number;
  done?: number;
  total?: number;
}) {
  return (
    <span
      className="flex items-center gap-2"
      title={total !== undefined ? `${done} of ${total} tasks complete` : undefined}
    >
      <span
        className="block h-1.5 w-[60px] overflow-hidden rounded-[3px]"
        style={{ background: "var(--border)" }}
      >
        <span
          className="block h-full rounded-[3px]"
          style={{ width: `${percent}%`, background: "var(--accent)" }}
        />
      </span>
      <span className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
        {percent}%
      </span>
    </span>
  );
}

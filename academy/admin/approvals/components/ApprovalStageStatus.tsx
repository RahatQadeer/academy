import type { QueueStatusFilter } from "../../types";
import { approvalStageLabel } from "../utils/labels";

const STAGE_STYLE: Record<
  QueueStatusFilter,
  { background: string; color: string; border: string }
> = {
  pending: {
    background: "var(--warning-bg)",
    color: "var(--warning-fg)",
    border: "var(--warning-border)",
  },
  ready: {
    background: "var(--accent-tint)",
    color: "var(--accent)",
    border: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  published: {
    background: "var(--success-bg)",
    color: "var(--success-fg)",
    border: "var(--success-bg)",
  },
  returned: {
    background: "var(--surface-soft)",
    color: "var(--text-secondary)",
    border: "var(--border)",
  },
};

export function ApprovalStageStatus({ stage }: { stage: QueueStatusFilter }) {
  const colors = STAGE_STYLE[stage];

  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none"
      style={{
        background: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {approvalStageLabel(stage)}
    </span>
  );
}

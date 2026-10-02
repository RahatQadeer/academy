import type { AcademyPublishRequestStatus } from "@/academy/lib/domain";
import { approvalStatusLabel } from "../utils/labels";

const STATUS_STYLE: Record<
  AcademyPublishRequestStatus,
  { background: string; color: string; border: string }
> = {
  pending: {
    background: "var(--warning-bg)",
    color: "var(--warning-fg)",
    border: "var(--warning-border)",
  },
  approved: {
    background: "var(--success-bg)",
    color: "var(--success-fg)",
    border: "var(--success-bg)",
  },
  rejected: {
    background: "var(--surface-soft)",
    color: "var(--text-secondary)",
    border: "var(--border)",
  },
};

export function ApprovalRequestStatus({ status }: { status: AcademyPublishRequestStatus }) {
  const label = approvalStatusLabel(status);
  const colors = STATUS_STYLE[status];

  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none"
      style={{
        background: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}
    </span>
  );
}

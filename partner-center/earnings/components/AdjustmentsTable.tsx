import { formatMoney } from "@/partner-center/earnings/lib/format";
import type { AdjustmentRow } from "@/partner-center/earnings/types";

function adjustmentTypeLabel(type: string): string {
  if (type === "chargeback") return "Chargeback";
  if (type === "refund") return "Refund";
  if (type === "manual") return "Manual adjustment";
  return type;
}

export function AdjustmentsTable({
  adjustments,
}: {
  adjustments: AdjustmentRow[];
}) {
  if (adjustments.length === 0) return null;

  return (
    <div className="mt-8">
      <div
        className="mb-3 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Adjustments
      </div>
      <div className="pa-partner-card overflow-hidden">
        <div
          className="grid grid-cols-[1fr_120px_1fr_100px] px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.03em]"
          style={{
            color: "var(--text-tertiary)",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-soft)",
          }}
        >
          <div>Date</div>
          <div>Type</div>
          <div>Reason</div>
          <div>Amount</div>
        </div>
        {adjustments.map((row, index) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_120px_1fr_100px] items-center px-5 py-3.5"
            style={{
              borderBottom:
                index < adjustments.length - 1
                  ? "1px solid var(--border)"
                  : undefined,
            }}
          >
            <div className="text-[13px]" style={{ color: "var(--ink)" }}>
              {row.dateLabel}
            </div>
            <div className="text-[13px]" style={{ color: "var(--ink)" }}>
              {adjustmentTypeLabel(row.type)}
            </div>
            <div
              className="text-[13px] truncate"
              style={{ color: "var(--text-secondary)" }}
              title={row.reason ?? undefined}
            >
              {row.reason ?? "—"}
            </div>
            <div
              className="text-[13.5px] font-semibold"
              style={{
                color:
                  row.amountDelta < 0 ? "var(--danger-fg)" : "var(--ink)",
              }}
            >
              {formatMoney(row.amountDelta)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

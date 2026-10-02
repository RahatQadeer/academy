import { Pill } from "@/base/components/Pill";
import {
  earningStatusLabel,
  earningStatusTone,
  formatMoney,
} from "@/partner-center/earnings/lib/format";
import type { CollectedPaymentRow } from "@/partner-center/earnings/types";

const COLUMNS = "grid-cols-[1fr_1fr_1fr_110px]";

export function CollectedPaymentsTable({
  payments,
}: {
  payments: CollectedPaymentRow[];
}) {
  return (
    <div>
      <div
        className="mb-3 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Collected payments
      </div>
      <div className="pa-partner-card overflow-hidden">
        <div
          className={`grid ${COLUMNS} px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.03em]`}
          style={{
            color: "var(--text-tertiary)",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-soft)",
          }}
        >
          <div>Date</div>
          <div>Collected</div>
          <div>Commission</div>
          <div>Status</div>
        </div>

        {payments.length === 0 ? (
          <div
            className="px-5 py-8 text-[14px]"
            style={{ color: "var(--text-secondary)" }}
          >
            No collected payments on this earning yet.
          </div>
        ) : (
          payments.map((row, index) => (
            <div
              key={row.id}
              className={`grid ${COLUMNS} items-center px-5 py-3.5`}
              style={{
                borderBottom:
                  index < payments.length - 1
                    ? "1px solid var(--border)"
                    : undefined,
              }}
            >
              <div className="text-[13px]" style={{ color: "var(--ink)" }}>
                {row.dateLabel}
              </div>
              <div className="text-[13.5px]" style={{ color: "var(--ink)" }}>
                {row.collectedLabel}
              </div>
              <div className="text-[13.5px] font-semibold">
                {formatMoney(row.commission)}
              </div>
              <div>
                <Pill tone={earningStatusTone(row.status)}>
                  {earningStatusLabel(row.status)}
                </Pill>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

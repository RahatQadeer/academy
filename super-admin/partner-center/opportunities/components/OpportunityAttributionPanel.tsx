import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import { formatShortDate } from "@/super-admin/partner-center/lib/format";
import type { AdminOpportunityAttributionItem } from "@/super-admin/partner-center/types";

function formatUsd(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function earningStatusTone(status: string) {
  const key = status.toLowerCase();
  if (key === "paid" || key === "payable") return "success" as const;
  if (key === "reversed" || key === "ineligible") return "danger" as const;
  return "neutral" as const;
}

export function OpportunityAttributionPanel({
  items,
}: {
  items: AdminOpportunityAttributionItem[];
}) {
  if (items.length === 0) {
    return (
      <AdminDetailSection title="Payments & earnings" variant="form">
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          No payments linked yet.
        </p>
      </AdminDetailSection>
    );
  }

  return (
    <AdminDetailSection title="Payments & earnings" variant="form">
      <div className="pa-partner-card overflow-hidden">
        <table className="w-full border-collapse text-left text-[13.5px]">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Payment id", "Recorded", "Collected", "Commission"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.04em]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.eventId}
                style={{ borderBottom: "1px solid var(--border)" }}
                className="hover:bg-[#fafaf9]"
              >
                <td
                  className="px-4 py-3 font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  {item.externalPaymentId ?? "—"}
                </td>
                <td
                  className="px-4 py-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatShortDate(item.eventTimestamp)}
                </td>
                <td
                  className="px-4 py-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatUsd(item.amountCollectedUsd)}
                </td>
                <td className="px-4 py-3">
                  {item.earningAmount != null ? (
                    <span className="inline-flex items-center gap-2">
                      <span style={{ color: "var(--ink)" }}>
                        {formatUsd(item.earningAmount)}
                      </span>
                      {item.earningStatus ? (
                        <AdminStatusPill
                          label={item.earningStatus}
                          tone={earningStatusTone(item.earningStatus)}
                        />
                      ) : null}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-secondary)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminDetailSection>
  );
}

import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import {
  formatShortDate,
  programLabel,
  statusLabel,
  statusTone,
} from "@/partner-center/referrals/lib/format";
import type { ReferralListItem } from "@/partner-center/referrals/types";

/** Equal share of row width — avoid fr-only early cols + fixed late cols. */
const COLUMNS =
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]";

export function ReferralsTable({
  items,
  emptyMessage = "No referrals match these filters.",
}: {
  items: ReferralListItem[];
  emptyMessage?: string;
}) {
  return (
    <div className="pa-partner-card overflow-hidden">
      <div className="min-w-[720px]">
        <div
          className={`grid ${COLUMNS} gap-2 px-4 py-3 text-[11.5px] font-medium uppercase tracking-[0.04em] lg:gap-3 lg:px-5`}
          style={{
            color: "var(--text-tertiary)",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-soft)",
          }}
        >
          <div>Referral ID</div>
          <div>Contact</div>
          <div>Program</div>
          <div>Referred</div>
          <div>Converted</div>
          <div>Status</div>
        </div>

        {items.length === 0 ? (
          <div
            className="px-5 py-10 text-center text-[14px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {emptyMessage}
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/partner-center/referrals/${item.id}`}
              className={`grid ${COLUMNS} gap-2 px-4 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)] lg:gap-3 lg:px-5`}
              style={{
                borderBottom: "1px solid var(--border)",
                color: "var(--ink)",
              }}
            >
              <div
                className="truncate font-mono text-[12.5px] tabular-nums"
                style={{ color: "var(--text-tertiary)" }}
                title={item.displayId}
              >
                {item.displayId}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold">
                  {item.contactName || item.companyName || "—"}
                </div>
                {item.contactName && item.companyName ? (
                  <div
                    className="truncate text-[12.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {item.companyName}
                  </div>
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13.5px]">
                  {programLabel(item.program)}
                </div>
              </div>
              <div
                className="text-[13.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatShortDate(item.referralDate)}
              </div>
              <div
                className="text-[13.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.conversionDate
                  ? formatShortDate(item.conversionDate)
                  : "—"}
              </div>
              <div>
                <Pill tone={statusTone(item.status)}>
                  {statusLabel(item.status)}
                </Pill>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import {
  contactLine,
  estimatedSizeLabel,
  formatMoney,
  formatShortDate,
  productInterestLabel,
  statusLabel,
  statusTone,
} from "@/partner-center/opportunities/lib/format";
import type { OpportunityListItem } from "@/partner-center/opportunities/types";

const COLUMNS =
  "grid-cols-[minmax(150px,1.3fr)_minmax(100px,1fr)_minmax(80px,0.8fr)_minmax(80px,0.85fr)_88px_minmax(100px,1fr)_100px]";

export function OpportunitiesTable({
  items,
  productInterestOptions = [],
  emptyMessage = "No opportunities match this filter.",
}: {
  items: OpportunityListItem[];
  productInterestOptions?: Array<{ value: string; label: string }>;
  emptyMessage?: string;
}) {
  return (
    <div className="pa-partner-card overflow-x-auto overflow-y-clip">
      <div className="min-w-[860px]">
      <div
        className={`grid ${COLUMNS} gap-2 px-4 py-3 text-[11.5px] font-medium uppercase tracking-[0.04em] lg:gap-3 lg:px-5`}
        style={{
          color: "var(--text-tertiary)",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-soft)",
        }}
      >
        <div>Company</div>
        <div>Interest</div>
        <div>Est. size</div>
        <div>Est. value</div>
        <div>Submitted</div>
        <div>Protection through</div>
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
        items.map((item) => {
          const subtitle = contactLine(item.contactName, item.contactTitle);
          return (
            <Link
              key={item.id}
              href={`/partner-center/opportunities/${item.id}`}
              className={`grid ${COLUMNS} gap-2 px-4 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)] lg:gap-3 lg:px-5`}
              style={{
                borderBottom: "1px solid var(--border)",
                color: "var(--ink)",
              }}
            >
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold">
                  {item.companyName}
                </div>
                {subtitle ? (
                  <div
                    className="truncate text-[12.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {subtitle}
                  </div>
                ) : null}
              </div>
              <div
                className="truncate text-[13.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {productInterestLabel(
                  item.productInterest,
                  productInterestOptions,
                )}
              </div>
              <div
                className="text-[13.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {estimatedSizeLabel(item.estimatedSeats, item.productInterest)}
              </div>
              <div
                className="text-[13.5px] tabular-nums"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatMoney(item.estimatedValue)}
              </div>
              <div
                className="text-[13.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatShortDate(item.submittedAt)}
              </div>
              <div
                className="text-[13.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.protectedUntil
                  ? formatShortDate(item.protectedUntil)
                  : "—"}
              </div>
              <div>
                <Pill tone={statusTone(item.status)}>
                  {statusLabel(item.status)}
                </Pill>
              </div>
            </Link>
          );
        })
      )}
      </div>
    </div>
  );
}

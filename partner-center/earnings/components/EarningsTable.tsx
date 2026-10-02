import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import {
  earningStatusLabel,
  earningStatusTone,
  formatMoney,
} from "@/partner-center/earnings/lib/format";
import type { EarningsListItem } from "@/partner-center/earnings/types";

const COLUMNS =
  "grid-cols-[110px_minmax(160px,1.3fr)_0.9fr_0.7fr_0.8fr_110px]";

export function EarningsTable({
  items,
  emptyMessage,
  title = "Earnings",
  viewAllHref,
  previewLimit,
}: {
  items: EarningsListItem[];
  emptyMessage: string;
  title?: string;
  viewAllHref?: string;
  previewLimit?: number;
}) {
  const limited =
    previewLimit != null ? items.slice(0, previewLimit) : items;
  // Filters live on the full list — always show the link when provided.
  const showViewAll = Boolean(viewAllHref);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div
          className="text-[13.5px] font-semibold"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </div>
        {showViewAll ? (
          <Link
            href={viewAllHref!}
            className="text-[13px] font-medium no-underline hover:underline"
            style={{ color: "var(--accent)" }}
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="pa-partner-card overflow-hidden">
        <div
          className={
            previewLimit != null
              ? undefined
              : "max-h-[min(28rem,55vh)] overflow-auto overscroll-contain"
          }
        >
          <div className="min-w-[720px]">
            <div
              className={`sticky top-0 z-[1] grid ${COLUMNS} gap-3 px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.03em]`}
              style={{
                color: "var(--text-tertiary)",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-soft)",
              }}
            >
              <div>Referral</div>
              <div>Source</div>
              <div>Basis</div>
              <div>Rate</div>
              <div>Amount</div>
              <div>Status</div>
            </div>

            {limited.length === 0 ? (
              <div
                className="px-5 py-10 text-center text-[14px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {emptyMessage}
              </div>
            ) : (
              limited.map((item) => (
                <Link
                  key={item.id}
                  href={`/partner-center/earnings/${item.id}`}
                  className={`grid ${COLUMNS} items-center gap-3 px-5 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)]`}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--ink)",
                  }}
                >
                  <div
                    className="truncate font-mono text-[12.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                    title={item.displayId}
                  >
                    {item.displayId}
                  </div>
                  <div className="truncate text-[13.5px]">{item.sourceLabel}</div>
                  <div
                    className="truncate text-[13px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {item.basisLabel}
                  </div>
                  <div
                    className="text-[13px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {item.rateLabel}
                  </div>
                  <div className="text-[13.5px] font-semibold">
                    {formatMoney(item.amount)}
                  </div>
                  <div>
                    <Pill tone={earningStatusTone(item.status)}>
                      {earningStatusLabel(item.status)}
                    </Pill>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

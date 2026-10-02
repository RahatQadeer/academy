"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { cn } from "@/base/lib/cn";
import { PayableQueueRow } from "@/super-admin/partner-center/payouts/components/PayableQueueRow";
import { PayoutsHistoryFilters } from "@/super-admin/partner-center/payouts/components/PayoutsHistoryFilters";
import { PayoutsQueueFilters } from "@/super-admin/partner-center/payouts/components/PayoutsQueueFilters";
import {
  applyHistoryFilters,
  DEFAULT_HISTORY_FILTERS,
  type HistoryFilterState,
} from "@/super-admin/partner-center/payouts/lib/filter-payout-history";
import {
  applyPayableFilters,
  DEFAULT_PAYABLE_FILTERS,
  type EnabledPayoutMethods,
  type PayableFilterState,
} from "@/super-admin/partner-center/payouts/lib/filter-payable";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import type {
  PartnerPayoutHistoryItem,
  PayablePartnerListItem,
} from "@/super-admin/partner-center/types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Tab = "queue" | "history";

export function PayoutsAdminView({
  items,
  historyRows,
  enabled,
}: {
  items: PayablePartnerListItem[];
  historyRows: PartnerPayoutHistoryItem[];
  enabled: EnabledPayoutMethods;
}) {
  const [tab, setTab] = useState<Tab>("queue");
  const [queueFilters, setQueueFilters] = useState<PayableFilterState>(
    DEFAULT_PAYABLE_FILTERS,
  );
  const [historyFilters, setHistoryFilters] = useState<HistoryFilterState>(
    DEFAULT_HISTORY_FILTERS,
  );

  const deferredQueueSearch = useDeferredValue(queueFilters.search);
  const deferredHistorySearch = useDeferredValue(historyFilters.search);

  const filteredQueue = applyPayableFilters(
    items,
    { ...queueFilters, search: deferredQueueSearch },
    enabled,
  );
  const filteredHistory = applyHistoryFilters(historyRows, {
    ...historyFilters,
    search: deferredHistorySearch,
  });

  return (
    <div>
      <div
        className="mb-4 flex flex-wrap gap-1"
        role="tablist"
        aria-label="Payouts views"
      >
        {(
          [
            { key: "queue" as const, label: "Queue" },
            { key: "history" as const, label: "History" },
          ] as const
        ).map((entry) => {
          const active = tab === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.key)}
              className={cn(
                "rounded-[6px] px-2.5 py-1.5 text-[13px]",
                active ? "font-semibold" : "font-normal",
              )}
              style={{
                background: active ? "#efefed" : "transparent",
                color: active ? "var(--ink)" : "rgba(55,53,47,.85)",
              }}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {tab === "queue" ? (
        <QueuePanel
          items={items}
          filtered={filteredQueue}
          filters={queueFilters}
          onFiltersChange={setQueueFilters}
          enabled={enabled}
        />
      ) : (
        <HistoryPanel
          rows={historyRows}
          filtered={filteredHistory}
          filters={historyFilters}
          onFiltersChange={setHistoryFilters}
        />
      )}
    </div>
  );
}

function QueuePanel({
  items,
  filtered,
  filters,
  onFiltersChange,
  enabled,
}: {
  items: PayablePartnerListItem[];
  filtered: PayablePartnerListItem[];
  filters: PayableFilterState;
  onFiltersChange: (next: PayableFilterState) => void;
  enabled: EnabledPayoutMethods;
}) {
  return (
    <>
      <PayoutsQueueFilters value={filters} onChange={onFiltersChange} />
      {items.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
          No partners with payable earnings right now.
        </p>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center">
          <p
            className="m-0 text-[14px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            No partners match
          </p>
          <p
            className="m-0 mt-1.5 text-[12.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Try clearing search or widening the filters.
          </p>
          <button
            type="button"
            className="mt-4 text-[13px]"
            style={{ color: "var(--accent)" }}
            onClick={() => onFiltersChange(DEFAULT_PAYABLE_FILTERS)}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="pa-partner-card overflow-hidden">
          <table className="w-full border-collapse text-left text-[13.5px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  "Partner",
                  "Payable",
                  "Earnings",
                  "Tax",
                  "Method",
                  "Gate",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.04em]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <PayableQueueRow
                  key={item.id}
                  item={item}
                  enabled={enabled}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function HistoryPanel({
  rows,
  filtered,
  filters,
  onFiltersChange,
}: {
  rows: PartnerPayoutHistoryItem[];
  filtered: PartnerPayoutHistoryItem[];
  filters: HistoryFilterState;
  onFiltersChange: (next: HistoryFilterState) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
        No payout history yet.
      </p>
    );
  }

  return (
    <>
      <PayoutsHistoryFilters value={filters} onChange={onFiltersChange} />
      {filtered.length === 0 ? (
        <div className="py-8 text-center">
          <p
            className="m-0 text-[14px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            No payouts match
          </p>
          <p
            className="m-0 mt-1.5 text-[12.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Try clearing search or widening the filters.
          </p>
          <button
            type="button"
            className="mt-4 text-[13px]"
            style={{ color: "var(--accent)" }}
            onClick={() => onFiltersChange(DEFAULT_HISTORY_FILTERS)}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="pa-partner-card overflow-hidden">
          <table className="w-full border-collapse text-left text-[13.5px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  "Partner",
                  "Amount",
                  "Method",
                  "Status",
                  "Reference",
                  "Date",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.04em]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={PC_ADMIN.partner(row.partnerProfileId)}
                      className="font-medium no-underline"
                      style={{ color: "var(--ink)" }}
                    >
                      {row.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(row.amount)}
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.method.replace(/_/g, " ")}
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.status.replace(/_/g, " ")}
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.reference?.trim() || "—"}
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatDate(row.paidAt ?? row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

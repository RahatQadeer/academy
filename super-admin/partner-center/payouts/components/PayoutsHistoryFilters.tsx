"use client";

import { Input } from "@/base/components/Input";
import { cn } from "@/base/lib/cn";
import type {
  HistoryDateFilter,
  HistoryFilterState,
  HistoryMethodFilter,
  HistorySort,
  HistoryStatusFilter,
} from "@/super-admin/partner-center/payouts/lib/filter-payout-history";

const STATUS_CHIPS: { key: HistoryStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scheduled", label: "Scheduled" },
  { key: "paid", label: "Paid" },
  { key: "failed", label: "Failed" },
];

const SELECT_CLASS =
  "min-w-0 flex-1 rounded-[6px] border border-line bg-white px-2 py-1.5 text-[12.5px]";

export function PayoutsHistoryFilters({
  value,
  onChange,
}: {
  value: HistoryFilterState;
  onChange: (next: HistoryFilterState) => void;
}) {
  function patch<K extends keyof HistoryFilterState>(
    key: K,
    next: HistoryFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="pa-partner-card mb-4 space-y-2.5 px-3 py-3">
      <Input
        label="Search payout history"
        labelHidden
        type="search"
        placeholder="Search partner or reference…"
        value={value.search}
        onChange={(e) => patch("search", e.target.value)}
        className="!py-2 text-[13px]"
      />

      <div className="flex flex-wrap gap-1" role="group" aria-label="Status">
        {STATUS_CHIPS.map((tab) => {
          const active = value.status === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => patch("status", tab.key)}
              aria-pressed={active}
              className={cn(
                "rounded-[6px] px-2 py-1 text-[12.5px]",
                active ? "font-semibold" : "font-normal",
              )}
              style={{
                background: active ? "#efefed" : "transparent",
                color: active ? "var(--ink)" : "rgba(55,53,47,.85)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
        <label className="sr-only" htmlFor="history-method">
          Method
        </label>
        <select
          id="history-method"
          className={SELECT_CLASS}
          value={value.method}
          onChange={(e) =>
            patch("method", e.target.value as HistoryMethodFilter)
          }
        >
          <option value="all">Any method</option>
          <option value="stripe_connect">Stripe Connect</option>
          <option value="quickbooks">QuickBooks</option>
          <option value="ach">ACH</option>
          <option value="check">Check</option>
        </select>

        <label className="sr-only" htmlFor="history-date">
          Date
        </label>
        <select
          id="history-date"
          className={SELECT_CLASS}
          value={value.date}
          onChange={(e) => patch("date", e.target.value as HistoryDateFilter)}
        >
          <option value="all">Any time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="older">Older than 30 days</option>
        </select>

        <label className="sr-only" htmlFor="history-sort">
          Sort
        </label>
        <select
          id="history-sort"
          className={SELECT_CLASS}
          value={value.sort}
          onChange={(e) => patch("sort", e.target.value as HistorySort)}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="amount_desc">Amount high → low</option>
          <option value="name">Partner A–Z</option>
        </select>
      </div>
    </div>
  );
}

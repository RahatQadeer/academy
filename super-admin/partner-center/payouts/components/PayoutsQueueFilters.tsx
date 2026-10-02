"use client";

import { Input } from "@/base/components/Input";
import { cn } from "@/base/lib/cn";
import {
  type PayableFilterState,
  type PayableGateFilter,
  type PayableMethodFilter,
  type PayableSort,
} from "@/super-admin/partner-center/payouts/lib/filter-payable";

const GATE_CHIPS: { key: PayableGateFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready to pay" },
  { key: "needs_tax_setup", label: "Needs tax" },
  { key: "needs_payment_setup", label: "Needs payment" },
  { key: "on_hold", label: "On hold" },
];

const SELECT_CLASS =
  "min-w-0 flex-1 rounded-[6px] border border-line bg-white px-2 py-1.5 text-[12.5px]";

export function PayoutsQueueFilters({
  value,
  onChange,
}: {
  value: PayableFilterState;
  onChange: (next: PayableFilterState) => void;
}) {
  function patch<K extends keyof PayableFilterState>(
    key: K,
    next: PayableFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="pa-partner-card mb-4 space-y-2.5 px-3 py-3">
      <Input
        label="Search payable partners"
        labelHidden
        type="search"
        placeholder="Search partner…"
        value={value.search}
        onChange={(e) => patch("search", e.target.value)}
        className="!py-2 text-[13px]"
      />

      <div className="flex flex-wrap gap-1" role="group" aria-label="Gate">
        {GATE_CHIPS.map((tab) => {
          const active = value.gate === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => patch("gate", tab.key)}
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

      <div className="grid grid-cols-2 gap-1.5">
        <label className="sr-only" htmlFor="payable-method">
          Preferred method
        </label>
        <select
          id="payable-method"
          className={SELECT_CLASS}
          value={value.method}
          onChange={(e) =>
            patch("method", e.target.value as PayableMethodFilter)
          }
        >
          <option value="all">Any method</option>
          <option value="stripe_connect">Stripe Connect</option>
          <option value="quickbooks">QuickBooks</option>
          <option value="ach">ACH</option>
          <option value="check">Check</option>
          <option value="unset">Unset</option>
        </select>

        <label className="sr-only" htmlFor="payable-sort">
          Sort
        </label>
        <select
          id="payable-sort"
          className={SELECT_CLASS}
          value={value.sort}
          onChange={(e) => patch("sort", e.target.value as PayableSort)}
        >
          <option value="payable_desc">Payable high → low</option>
          <option value="payable_asc">Payable low → high</option>
          <option value="name">Partner A–Z</option>
        </select>
      </div>
    </div>
  );
}

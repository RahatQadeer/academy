"use client";

import { Input } from "@/base/components/Input";
import { cn } from "@/base/lib/cn";
import type {
  RollupFilterState,
  RollupRailFilter,
  RollupReferenceFilter,
  RollupReportableFilter,
  RollupSort,
  RollupStatusFilter,
} from "@/super-admin/partner-center/tax-1099/lib/filter-rollups";
import { REPORTABLE_THRESHOLD } from "@/super-admin/partner-center/tax-1099/lib/filter-rollups";

const STATUS_CHIPS: { key: RollupStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "not_started", label: "Not started" },
  { key: "in_progress", label: "In progress" },
  { key: "complete", label: "Complete" },
  { key: "filed", label: "Filed" },
];

const SELECT_CLASS =
  "min-w-0 flex-1 rounded-[6px] border border-line bg-white px-2 py-1.5 text-[12.5px]";

export function Tax1099Filters({
  value,
  onChange,
}: {
  value: RollupFilterState;
  onChange: (next: RollupFilterState) => void;
}) {
  function patch<K extends keyof RollupFilterState>(
    key: K,
    next: RollupFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="pa-partner-card mb-4 space-y-2.5 px-3 py-3">
      <Input
        label="Search rollups"
        labelHidden
        type="search"
        placeholder="Search partner or filing reference…"
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

      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        <label className="sr-only" htmlFor="rollup-rail">
          Payment rail
        </label>
        <select
          id="rollup-rail"
          className={SELECT_CLASS}
          value={value.rail}
          onChange={(e) => patch("rail", e.target.value as RollupRailFilter)}
        >
          <option value="all">Any rail</option>
          <option value="stripe">Stripe only</option>
          <option value="non_stripe">Non-Stripe only</option>
          <option value="both">Both rails</option>
          <option value="neither">Neither rail</option>
        </select>

        <label className="sr-only" htmlFor="rollup-reportable">
          Reportable amount
        </label>
        <select
          id="rollup-reportable"
          className={SELECT_CLASS}
          value={value.reportable}
          onChange={(e) =>
            patch("reportable", e.target.value as RollupReportableFilter)
          }
        >
          <option value="all">Any amount</option>
          <option value="at_or_above">
            ≥ ${REPORTABLE_THRESHOLD.toLocaleString("en-US")}
          </option>
          <option value="below">
            Below ${REPORTABLE_THRESHOLD.toLocaleString("en-US")}
          </option>
        </select>

        <label className="sr-only" htmlFor="rollup-reference">
          Filing reference
        </label>
        <select
          id="rollup-reference"
          className={SELECT_CLASS}
          value={value.reference}
          onChange={(e) =>
            patch("reference", e.target.value as RollupReferenceFilter)
          }
        >
          <option value="all">Any reference</option>
          <option value="with">Has reference</option>
          <option value="without">Missing reference</option>
        </select>

        <label className="sr-only" htmlFor="rollup-sort">
          Sort
        </label>
        <select
          id="rollup-sort"
          className={SELECT_CLASS}
          value={value.sort}
          onChange={(e) => patch("sort", e.target.value as RollupSort)}
        >
          <option value="reportable_desc">Reportable high → low</option>
          <option value="reportable_asc">Reportable low → high</option>
          <option value="name">Partner A–Z</option>
          <option value="status">Status</option>
        </select>
      </div>
    </div>
  );
}

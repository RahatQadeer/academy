"use client";

import { Input } from "@/base/components/Input";
import { cn } from "@/base/lib/cn";
import type {
  PartnerFilterState,
  PartnerStatusFilter,
} from "@/super-admin/partner-center/partners/lib/filter-partners";

const STATUS_CHIPS: { key: PartnerStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "approved", label: "Approved" },
];

export function PartnersFilters({
  value,
  onChange,
}: {
  value: PartnerFilterState;
  onChange: (next: PartnerFilterState) => void;
}) {
  function patch<K extends keyof PartnerFilterState>(
    key: K,
    next: PartnerFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="pa-partner-card mb-4 space-y-2.5 px-3 py-3">
      <Input
        label="Search partners"
        labelHidden
        type="search"
        placeholder="Search company, contact, email…"
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
    </div>
  );
}

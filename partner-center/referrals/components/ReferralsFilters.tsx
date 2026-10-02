"use client";

import { Search } from "lucide-react";
import { FilterSelect } from "@/partner-center/components/FilterSelect";
import type {
  ReferralDateRange,
  ReferralListFilters,
  ReferralProgramFilter,
} from "@/partner-center/referrals/types";

/**
 * Program / date / search — updates parent state + URL via replaceState
 * as soon as a control changes (no Apply step).
 */
export function ReferralsFilters({
  filters,
  onChange,
}: {
  filters: ReferralListFilters;
  onChange: (next: Partial<ReferralListFilters>) => void;
}) {
  return (
    <div className="mb-5 flex w-full flex-wrap items-center gap-2.5">
      <div className="min-w-[220px] flex-1 basis-[240px]">
        <label className="relative block">
          <span className="sr-only">Search referrals</span>
          <Search
            size={15}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-tertiary)" }}
            aria-hidden
          />
          <input
            type="search"
            name="q"
            value={filters.q}
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder="Search referrals…"
            className="w-full rounded-[10px] border bg-surface py-[9px] pl-9 pr-3 transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
            style={{
              borderColor: "var(--border-strong)",
              color: "var(--ink)",
            }}
          />
        </label>
      </div>

      <FilterSelect
        label="Program"
        value={filters.program}
        minWidth={148}
        onChange={(value) =>
          onChange({ program: value as ReferralProgramFilter })
        }
        options={[
          { value: "all", label: "All programs" },
          { value: "platform", label: "Private Attaché" },
          { value: "academy", label: "Academy" },
          { value: "whitbyos", label: "Whitby" },
        ]}
      />

      <FilterSelect
        label="Date range"
        value={filters.range}
        minWidth={132}
        onChange={(value) =>
          onChange({ range: value as ReferralDateRange })
        }
        options={[
          { value: "all", label: "All time" },
          { value: "30", label: "Last 30 days" },
          { value: "90", label: "Last 90 days" },
        ]}
      />
    </div>
  );
}

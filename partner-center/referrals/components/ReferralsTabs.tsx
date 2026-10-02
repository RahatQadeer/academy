"use client";

import type {
  ReferralListFilters,
  ReferralTab,
} from "@/partner-center/referrals/types";

const TABS: { id: ReferralTab; label: string; status: string }[] = [
  { id: "all", label: "All", status: "all" },
  { id: "in_progress", label: "In Progress", status: "in_progress" },
  { id: "converted", label: "Converted", status: "converted" },
  { id: "not_converted", label: "Not Converted", status: "not_converted" },
];

export function referralsTabHref(
  tabStatus: string,
  filters: Pick<ReferralListFilters, "program" | "range" | "q">,
): string {
  const params = new URLSearchParams();
  if (tabStatus !== "all") params.set("status", tabStatus);
  if (filters.program !== "all") params.set("program", filters.program);
  if (filters.range !== "all") params.set("range", filters.range);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  return qs ? `/partner-center/referrals?${qs}` : "/partner-center/referrals";
}

export function ReferralsTabs({
  active,
  filters,
  onChange,
}: {
  active: ReferralTab;
  filters: ReferralListFilters;
  onChange: (tab: ReferralTab) => void;
}) {
  return (
    <div
      className="mb-5 flex gap-5 overflow-x-auto overflow-y-hidden sm:gap-7"
      style={{ borderBottom: "1px solid var(--border)" }}
      role="tablist"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className="relative mb-[-1px] shrink-0 border-0 bg-transparent p-0 pb-3.5 text-[14px] font-medium transition-colors sm:text-[14.5px]"
            style={{
              color: selected ? "var(--ink)" : "var(--text-tertiary)",
              boxShadow: selected
                ? "inset 0 -2px 0 var(--ink)"
                : "inset 0 -2px 0 transparent",
            }}
            onMouseEnter={(e) => {
              if (!selected) e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              if (!selected) {
                e.currentTarget.style.color = "var(--text-tertiary)";
              }
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

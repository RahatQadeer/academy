"use client";

import type { OpportunityTab } from "@/partner-center/opportunities/types";

const TABS: { id: OpportunityTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "submitted", label: "Submitted" },
  { id: "accepted", label: "Accepted" },
  { id: "in_progress", label: "In Progress" },
  { id: "converted", label: "Converted" },
  { id: "closed", label: "Closed" },
];

export function opportunitiesTabHref(tab: OpportunityTab): string {
  const params = new URLSearchParams();
  if (tab !== "all") {
    params.set(
      "status",
      tab === "closed" ? "closed" : tab,
    );
  }
  const qs = params.toString();
  return qs
    ? `/partner-center/opportunities?${qs}`
    : "/partner-center/opportunities";
}

export function OpportunitiesTabs({
  active,
  onChange,
}: {
  active: OpportunityTab;
  onChange: (tab: OpportunityTab) => void;
}) {
  return (
    <div
      className="mb-5 flex gap-4 overflow-x-auto overflow-y-hidden sm:gap-6"
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
            className="relative mb-[-1px] shrink-0 border-0 bg-transparent p-0 pb-3 text-[13.5px] font-medium transition-colors sm:text-[14px]"
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

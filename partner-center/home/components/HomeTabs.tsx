"use client";

import type { HomeTab } from "@/partner-center/home/types";

const TABS: { id: HomeTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "action", label: "Action Needed" },
  { id: "activity", label: "Recent Activity" },
];

export function tabHref(id: HomeTab): string {
  return id === "overview" ? "/partner-center" : `/partner-center?tab=${id}`;
}

export function HomeTabs({
  active,
  actionCount,
  onChange,
}: {
  active: HomeTab;
  actionCount?: number;
  onChange: (tab: HomeTab) => void;
}) {
  return (
    <div
      className="mb-7 flex gap-6 overflow-x-auto overflow-y-hidden"
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
            className="relative mb-[-1px] inline-flex shrink-0 items-center gap-1.5 border-0 bg-transparent p-0 pb-3 text-[14px] font-medium transition-colors"
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
            {tab.id === "action" && actionCount != null && actionCount > 0 ? (
              <span
                className="rounded px-1.5 py-px text-[10.5px] font-semibold"
                style={{
                  background: "var(--warning-bg)",
                  color: "var(--warning-fg)",
                }}
              >
                {actionCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import type { DocumentsTab } from "@/partner-center/documents/types";

const TABS: { id: DocumentsTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "action-needed", label: "Action Needed" },
  { id: "labels", label: "My Labels" },
  { id: "archived", label: "Archived" },
];

/** F45 sub-nav — instant client switch (same pattern as Home tabs). */
export function DocumentsTabs({
  active,
  actionNeededCount,
  onChange,
}: {
  active: DocumentsTab;
  actionNeededCount: number;
  onChange: (tab: DocumentsTab) => void;
}) {
  return (
    <div
      className="mb-5 flex gap-6 overflow-x-auto overflow-y-hidden"
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
            className="relative mb-[-1px] flex shrink-0 items-center gap-1.5 border-0 bg-transparent p-0 pb-3 text-[14px] font-medium"
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
            {tab.id === "action-needed" && actionNeededCount > 0 ? (
              <span
                className="rounded px-1.5 py-px text-[10.5px] font-semibold"
                style={{
                  background: "var(--warning-bg)",
                  color: "var(--warning-fg)",
                }}
              >
                {actionNeededCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

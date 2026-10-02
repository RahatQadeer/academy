"use client";

import { useRef } from "react";
import { cn } from "@/base/lib/cn";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

export type CatalogFilter = "all" | "published" | "pending_approval" | "draft";

export type CatalogTypeFilter =
  | "all"
  | "short_course"
  | "course"
  | "certification_program"
  | "endorsement_program";

const TABS: { key: CatalogFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "pending_approval", label: "Pending" },
  { key: "draft", label: "Draft" },
];

export const CATALOG_TYPE_FILTERS: { key: CatalogTypeFilter; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "short_course", label: "Short Courses" },
  { key: "course", label: "Courses" },
  { key: "certification_program", label: "Certification Programs" },
  { key: "endorsement_program", label: "Specialty Endorsements" },
];

export function matchesCatalogTypeFilter(type: string, filter: CatalogTypeFilter): boolean {
  if (filter === "all") return true;
  return type === filter;
}

export function CatalogTabs({
  active,
  onChange,
  counts,
  panelId,
  typeFilter,
  onTypeFilterChange,
}: {
  active: CatalogFilter;
  onChange: (tab: CatalogFilter) => void;
  counts: Record<CatalogFilter, number>;
  panelId: string;
  typeFilter: CatalogTypeFilter;
  onTypeFilterChange: (filter: CatalogTypeFilter) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function focusTab(index: number) {
    const next = TABS[(index + TABS.length) % TABS.length];
    onChange(next.key);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#catalog-tab-${next.key}`)
      ?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((tab) => tab.key === active);
    if (current < 0) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(current + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(TABS.length - 1);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-5 sm:px-6"
      style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
    >
      <div
        ref={listRef}
        className="flex flex-wrap items-center gap-1"
        role="tablist"
        aria-label="Filter catalog by status"
        onKeyDown={onKeyDown}
      >
        {TABS.map((tab) => {
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              id={`catalog-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              className={cn(
                "relative -mb-px cursor-pointer border-none bg-transparent px-3 py-3 text-[13px] transition-colors",
                selected
                  ? "font-semibold text-ink"
                  : "font-medium text-[color:var(--text-tertiary)] hover:text-ink",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {tab.label}
                <span
                  className={cn(
                    "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    selected
                      ? "bg-[color:var(--accent-tint)] text-[color:var(--accent)]"
                      : "bg-surface text-[color:var(--text-tertiary)]",
                  )}
                >
                  {counts[tab.key]}
                </span>
              </span>
              {selected ? (
                <span
                  className="absolute right-2.5 bottom-0 left-2.5 h-[2px] rounded-t-[2px]"
                  style={{ background: "var(--accent)" }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="min-w-[11rem] pb-2 sm:pb-0">
        <FilterSelect
          label="Type"
          value={typeFilter}
          onChange={(value) => onTypeFilterChange(value as CatalogTypeFilter)}
          options={CATALOG_TYPE_FILTERS.map((option) => ({
            value: option.key,
            label: option.label,
          }))}
        />
      </div>
    </div>
  );
}

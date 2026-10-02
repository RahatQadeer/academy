"use client";

import { FilterSelect } from "@/academy/components/ui/FilterSelect";
import type { ExploreCatalogQuery, ExploreRecognitionFilter, ExploreSort } from "../types";
import { EXPLORE_CERTIFICATE_FILTER_OPTIONS, hasActiveFilters } from "../utils/query";

/** Combined sort + Free/Paid control. */
export type ExploreSortControl = ExploreSort | "free" | "paid";

const SORT_OPTIONS: { value: ExploreSortControl; label: string }[] = [
  { value: "sequence", label: "Sorting" },
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

function controlValue(query: ExploreCatalogQuery, sort: ExploreSort): ExploreSortControl {
  if (query.access === "free") return "free";
  if (query.access === "purchased") return "paid";
  if (sort === "asc" || sort === "desc") return sort;
  return "sequence";
}

export function ProgramFilters({
  query,
  sort,
  onChange,
  onSortChange,
  onClearAll,
}: {
  query: ExploreCatalogQuery;
  sort: ExploreSort;
  onChange: (next: Pick<ExploreCatalogQuery, "recognition" | "access">) => void;
  onSortChange: (sort: ExploreSort) => void;
  onClearAll?: () => void;
}) {
  const filtered = hasActiveFilters(query);

  function applyControl(value: string) {
    if (value === "free") {
      onChange({ recognition: query.recognition, access: "free" });
      onSortChange("sequence");
      return;
    }
    if (value === "paid") {
      onChange({ recognition: query.recognition, access: "purchased" });
      onSortChange("sequence");
      return;
    }
    if (value === "asc" || value === "desc") {
      onSortChange(value);
      onChange({ recognition: query.recognition, access: "" });
      return;
    }
    onSortChange("sequence");
    onChange({ recognition: query.recognition, access: "" });
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="min-w-[12rem] flex-1 sm:max-w-[17rem] sm:flex-none">
        <FilterSelect
          label="Certificate"
          hideLabel
          value={query.recognition || "all"}
          options={EXPLORE_CERTIFICATE_FILTER_OPTIONS}
          onChange={(value) =>
            onChange({
              recognition:
                value === "all" ? "" : (value as ExploreRecognitionFilter),
              access: query.access,
            })
          }
          tone="filter"
          size="sm"
        />
      </div>
      <div className="min-w-[8.5rem] flex-1 sm:max-w-[12rem] sm:flex-none">
        <FilterSelect
          label="Sort"
          hideLabel
          value={controlValue(query, sort)}
          options={SORT_OPTIONS}
          onChange={applyControl}
          tone="filter"
          size="sm"
        />
      </div>
      {filtered ? (
        <button
          type="button"
          onClick={() => {
            if (onClearAll) onClearAll();
            else {
              onChange({ recognition: "", access: "" });
              onSortChange("sequence");
            }
          }}
          className="shrink-0 rounded-[8px] border-0 px-2.5 py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-soft)]"
          style={{ color: "var(--accent)", background: "transparent", cursor: "pointer" }}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

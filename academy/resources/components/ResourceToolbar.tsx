"use client";

import { useRouter } from "next/navigation";
import type { ResourceSort, ResourcesQuery } from "../types";
import { resourcesHref } from "../utils/query";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

const fieldClass =
  "h-10 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow,background] placeholder:text-[rgba(55,53,47,0.35)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]";

export function ResourceToolbar({
  query,
  resourceTypes,
  resultCount,
}: {
  query: ResourcesQuery;
  resourceTypes: string[];
  resultCount?: number;
}) {
  const router = useRouter();
  const hasFilters = Boolean(query.search.trim() || query.type);

  function go(next: Partial<ResourcesQuery>) {
    router.push(resourcesHref({ ...query, ...next }));
  }

  return (
    <div className="space-y-3">
      <form
        className="rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--surface-soft)_65%,white)] p-3.5 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          go({ search: String(form.get("q") ?? "") });
        }}
      >
        <div className="grid gap-3 lg:grid-cols-4">
          <label className="block min-w-0 lg:col-span-2">
            <span
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Search
            </span>
            <input
              name="q"
              defaultValue={query.search}
              placeholder="Search files by title, type, or lesson"
              className={fieldClass}
            />
          </label>

          <FilterSelect
            label="Type"
            value={query.type}
            placeholder="All types"
            onChange={(value) => go({ type: value })}
            options={[
              { value: "", label: "All types" },
              ...resourceTypes.map((type) => ({ value: type, label: type })),
            ]}
          />

          <FilterSelect
            label="Sort"
            value={query.sort}
            onChange={(value) => go({ sort: value as ResourceSort })}
            options={[
              { value: "title", label: "Title A–Z" },
              { value: "type", label: "Type" },
              { value: "lesson", label: "Lesson" },
            ]}
          />
        </div>
      </form>

      {typeof resultCount === "number" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {resultCount === 0
              ? "No matching files"
              : `${resultCount.toLocaleString()} downloadable file${resultCount === 1 ? "" : "s"}`}
            {hasFilters ? " for your filters" : ""}
          </p>
          {hasFilters ? (
            <button
              type="button"
              className="border-0 bg-transparent p-0 text-[12.5px] font-medium text-accent"
              onClick={() => go({ search: "", type: "" })}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

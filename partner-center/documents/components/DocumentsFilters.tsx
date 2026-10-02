"use client";

import { Search } from "lucide-react";
import { FilterSelect } from "@/partner-center/components/FilterSelect";
import {
  type DocumentListFilters,
} from "@/partner-center/documents/types";

/**
 * SRS §17.11.2 — search and filter by label, status, program, and date.
 * Updates parent state + URL via replaceState as soon as a control changes.
 */
export function DocumentsFilters({
  filters,
  labels,
  onChange,
}: {
  filters: DocumentListFilters;
  labels: string[];
  onChange: (next: Partial<DocumentListFilters>) => void;
}) {
  return (
    <div className="mb-4 flex flex-nowrap items-center gap-2.5 overflow-x-auto overflow-y-hidden">
      <div className="min-w-[160px] max-w-[280px] flex-1 shrink">
        <label className="relative block">
          <span className="sr-only">Search documents</span>
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
            placeholder="Search documents…"
            className="w-full rounded-[10px] border bg-surface py-[9px] pl-9 pr-3 transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
            style={{
              borderColor: "var(--border-strong)",
              color: "var(--ink)",
            }}
          />
        </label>
      </div>

      <FilterSelect
        label="Status"
        value={filters.status}
        minWidth={128}
        onChange={(value) =>
          onChange({ status: value as DocumentListFilters["status"] })
        }
        options={[
          { value: "all", label: "Status" },
          { value: "current", label: "Current" },
          { value: "action_needed", label: "Action Needed" },
          { value: "completed", label: "Completed" },
          { value: "archived", label: "Archived" },
        ]}
      />

      {/*
        §17.11.2 Program filter — matches partner_document_meta.program
        (structured), not freeform labels.
      */}
      <FilterSelect
        label="Program"
        value={filters.program}
        minWidth={128}
        onChange={(value) =>
          onChange({ program: value as DocumentListFilters["program"] })
        }
        options={[
          { value: "all", label: "Program" },
          { value: "academy", label: "Academy" },
          { value: "platform", label: "Whitby" },
          { value: "enterprise", label: "Enterprise" },
        ]}
      />

      <FilterSelect
        label="Label"
        value={filters.label}
        minWidth={120}
        onChange={(value) => onChange({ label: value })}
        options={[
          { value: "", label: "Label" },
          ...labels.map((label) => ({ value: label, label })),
        ]}
      />

      <FilterSelect
        label="Date"
        value={filters.range}
        minWidth={128}
        onChange={(value) =>
          onChange({ range: value as DocumentListFilters["range"] })
        }
        options={[
          { value: "all", label: "Date" },
          { value: "30", label: "Last 30 days" },
          { value: "90", label: "Last 90 days" },
        ]}
      />
    </div>
  );
}

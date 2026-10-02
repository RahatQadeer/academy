import Link from "next/link";
import type { EarningsStatusFilter } from "@/partner-center/earnings/types";

const FILTERS: { id: EarningsStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "payable", label: "Payable" },
  { id: "paid", label: "Paid" },
  { id: "held", label: "Held" },
  { id: "reversed", label: "Reversed" },
];

function hrefFor(filter: EarningsStatusFilter) {
  if (filter === "all") return "/partner-center/earnings/all";
  return `/partner-center/earnings/all?status=${filter}`;
}

export function EarningsFilters({
  active,
}: {
  active: EarningsStatusFilter;
}) {
  return (
    <div
      className="mb-4 flex gap-5 overflow-x-auto overflow-y-hidden"
      style={{ borderBottom: "1px solid var(--border)" }}
      role="tablist"
    >
      {FILTERS.map((filter) => {
        const selected = filter.id === active;
        return (
          <Link
            key={filter.id}
            href={hrefFor(filter.id)}
            role="tab"
            aria-selected={selected}
            className="relative mb-[-1px] shrink-0 pb-3 text-[14px] font-medium no-underline"
            style={{
              color: selected ? "var(--ink)" : "var(--text-tertiary)",
              boxShadow: selected
                ? "inset 0 -2px 0 var(--ink)"
                : "inset 0 -2px 0 transparent",
            }}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}

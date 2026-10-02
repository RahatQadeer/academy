"use client";

import { useDeferredValue, useState } from "react";
import { PartnersFilters } from "@/super-admin/partner-center/partners/components/PartnersFilters";
import { PartnersTable } from "@/super-admin/partner-center/partners/components/PartnersTable";
import {
  applyPartnerFilters,
  DEFAULT_PARTNER_FILTERS,
  type PartnerFilterState,
} from "@/super-admin/partner-center/partners/lib/filter-partners";
import type { PartnerListItem } from "@/super-admin/partner-center/types";

export function PartnersView({ items }: { items: PartnerListItem[] }) {
  const [filters, setFilters] =
    useState<PartnerFilterState>(DEFAULT_PARTNER_FILTERS);
  const deferredSearch = useDeferredValue(filters.search);
  const filtered = applyPartnerFilters(items, {
    ...filters,
    search: deferredSearch,
  });

  if (items.length === 0) {
    return <PartnersTable items={items} />;
  }

  return (
    <>
      <PartnersFilters value={filters} onChange={setFilters} />
      {filtered.length === 0 ? (
        <div className="py-8 text-center">
          <p
            className="m-0 text-[14px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            No partners match
          </p>
          <p
            className="m-0 mt-1.5 text-[12.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Try clearing search or choosing a different status.
          </p>
          <button
            type="button"
            className="mt-4 text-[13px]"
            style={{ color: "var(--accent)" }}
            onClick={() => setFilters(DEFAULT_PARTNER_FILTERS)}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <PartnersTable items={filtered} />
      )}
    </>
  );
}

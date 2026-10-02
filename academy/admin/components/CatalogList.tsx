"use client";

import { useEffect, useId, useState } from "react";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";
import { CatalogHeader } from "./CatalogHeader";
import {
  CatalogTabs,
  matchesCatalogTypeFilter,
  type CatalogFilter,
  type CatalogTypeFilter,
} from "./CatalogTabs";
import { CatalogTable, type CatalogProgram } from "./CatalogTable";

const PAGE_SIZE = 10;

export function CatalogList({
  programs,
  allowCreate = true,
}: {
  programs: CatalogProgram[];
  allowCreate?: boolean;
}) {
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [typeFilter, setTypeFilter] = useState<CatalogTypeFilter>("all");
  const [page, setPage] = useState(1);
  const panelId = useId();

  const byType = programs.filter((p) => matchesCatalogTypeFilter(p.type, typeFilter));

  const counts: Record<CatalogFilter, number> = {
    all: byType.length,
    published: byType.filter((p) => p.status === "published").length,
    pending_approval: byType.filter((p) => p.status === "pending_approval").length,
    draft: byType.filter((p) => p.status === "draft").length,
  };

  const filtered =
    filter === "all" ? byType : byType.filter((p) => p.status === filter);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, typeFilter]);

  return (
    <div>
      <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
        <CatalogHeader
          count={programs.length}
          allowCreate={allowCreate}
          trailing={
            <PaginationBar
              compact
              page={currentPage}
              pageCount={pageCount}
              total={filtered.length}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              itemLabel="programs"
              label="Catalog pages"
              onPageChange={setPage}
            />
          }
        />
      </div>

      <CatalogTabs
        active={filter}
        onChange={setFilter}
        counts={counts}
        panelId={panelId}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`catalog-tab-${filter}`}
        tabIndex={-1}
      >
        <CatalogTable programs={paged} filter={filter} typeFilter={typeFilter} />
      </div>
    </div>
  );
}

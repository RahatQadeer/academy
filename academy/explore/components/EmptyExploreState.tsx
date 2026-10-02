import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";
import type { ExploreCatalogQuery } from "../types";
import { hasActiveFilters } from "../utils/query";

function CatalogIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="7" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="5" width="7" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4" y="13.5" width="7" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="13.5" width="7" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function EmptyExploreState({
  query,
  onClear,
}: {
  query: ExploreCatalogQuery;
  onClear?: () => void;
}) {
  const filtered = hasActiveFilters(query);

  return (
    <EmptyState
      icon={<CatalogIcon />}
      title={filtered ? "No matching programs" : "No published programs"}
      body={
        filtered
          ? "Try a different search or clear the filters to see the full catalog."
          : "Published Academy programs will appear here when they are available."
      }
      actions={
        filtered && onClear ? (
          <Button type="button" variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
}

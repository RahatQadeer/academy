import type { ReactNode } from "react";
import { LearnerHero } from "@/academy/components/learner/LearnerHero";
import type { ExploreCatalogQuery } from "../types";
import { hasActiveFilters } from "../utils/query";

export function ExploreHeader({
  resultCount,
  query,
  trailing,
}: {
  resultCount?: number;
  query?: ExploreCatalogQuery;
  trailing?: ReactNode;
}) {
  const filtered = query ? hasActiveFilters(query) : false;
  const countLabel =
    typeof resultCount === "number"
      ? `${resultCount.toLocaleString()} program${resultCount === 1 ? "" : "s"}`
      : null;

  const subtitle = filtered
    ? "Filtered from the live catalog."
    : "Certification path, endorsements, and courses — find your next step.";

  return (
    <LearnerHero
      eyebrow="Academy catalog"
      title="Explore"
      description={subtitle}
      trailing={
        trailing ??
        (countLabel ? (
          <div
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-line bg-surface/90 px-3.5 py-2 backdrop-blur-sm sm:self-auto"
            style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} aria-hidden />
            <span className="text-[12.5px] font-semibold tabular-nums text-ink">{countLabel}</span>
          </div>
        ) : undefined)
      }
    />
  );
}

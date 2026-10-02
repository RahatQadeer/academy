"use client";

import { useMemo, useState } from "react";
import { Button } from "@/base/components/Button";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { OpportunitiesEmptyState } from "@/partner-center/opportunities/components/OpportunitiesEmptyState";
import { OpportunitiesTable } from "@/partner-center/opportunities/components/OpportunitiesTable";
import {
  OpportunitiesTabs,
  opportunitiesTabHref,
} from "@/partner-center/opportunities/components/OpportunitiesTabs";
import type {
  OpportunityListData,
  OpportunityTab,
} from "@/partner-center/opportunities/types";
import { statusFromTab } from "@/partner-center/opportunities/types";

export function OpportunitiesView({ data }: { data: OpportunityListData }) {
  const [tab, setTab] = useState<OpportunityTab>(data.activeTab);

  const statusFilter =
    tab === "all" && data.filters.status !== "all"
      ? data.filters.status
      : statusFromTab(tab);

  const items = useMemo(() => {
    if (statusFilter === "all") return data.items;
    if (statusFilter === "accepted_in_progress") {
      return data.items.filter(
        (item) => item.status === "accepted" || item.status === "in_progress",
      );
    }
    return data.items.filter((item) => item.status === statusFilter);
  }, [data.items, statusFilter]);

  function selectTab(next: OpportunityTab) {
    setTab(next);
    window.history.replaceState(null, "", opportunitiesTabHref(next));
  }

  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title="Enterprise Opportunities"
        subtitle="Company-level opportunities, kept separate from ordinary tracked-link referrals."
        action={
          !data.isEmpty && data.canSubmit ? (
            <Button href="/partner-center/opportunities/new">
              Submit opportunity
            </Button>
          ) : undefined
        }
      />

      <OpportunitiesTabs active={tab} onChange={selectTab} />

      {data.isEmpty ? (
        <OpportunitiesEmptyState canSubmit={data.canSubmit} />
      ) : (
        <OpportunitiesTable
          items={items}
          productInterestOptions={data.productInterestOptions}
          emptyMessage="No opportunities match this filter."
        />
      )}
    </div>
  );
}

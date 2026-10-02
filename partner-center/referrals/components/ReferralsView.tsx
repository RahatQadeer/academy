"use client";

import { useState } from "react";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { buildReferralUrl } from "@/partner-center/lib/referral-url";
import { GetReferralLinkButton } from "@/partner-center/referrals/components/GetReferralLinkButton";
import { ReferralsEmptyState } from "@/partner-center/referrals/components/ReferralsEmptyState";
import { ReferralsFilters } from "@/partner-center/referrals/components/ReferralsFilters";
import { ReferralsTable } from "@/partner-center/referrals/components/ReferralsTable";
import {
  ReferralsTabs,
  referralsTabHref,
} from "@/partner-center/referrals/components/ReferralsTabs";
import { matchesReferralFilters } from "@/partner-center/referrals/lib/filter-referrals";
import type {
  ReferralListData,
  ReferralListFilters,
  ReferralStatus,
  ReferralTab,
} from "@/partner-center/referrals/types";

function referralEmptyMessage(
  statusFilter: ReferralStatus | "all",
  filters: ReferralListFilters,
  isEmpty: boolean,
): string {
  const hasSecondaryFilters =
    filters.program !== "all" ||
    filters.range !== "all" ||
    Boolean(filters.q);

  if (!isEmpty && hasSecondaryFilters) {
    return "No referrals match these filters.";
  }

  switch (statusFilter) {
    case "in_progress":
      return "No referrals in progress yet.";
    case "converted":
      return "No converted referrals yet.";
    case "not_converted":
      return "No referrals marked as not converted yet.";
    case "referred":
      return "No new referrals yet.";
    default:
      return "No referrals yet. Share your link to start tracking.";
  }
}

function statusFromTab(tab: ReferralTab): ReferralStatus | "all" {
  if (
    tab === "in_progress" ||
    tab === "converted" ||
    tab === "not_converted"
  ) {
    return tab;
  }
  return "all";
}

export function ReferralsView({ data }: { data: ReferralListData }) {
  const [tab, setTab] = useState<ReferralTab>(data.activeTab);
  const [filters, setFilters] = useState<ReferralListFilters>(data.filters);

  const statusFilter: ReferralStatus | "all" =
    tab === "all" && filters.status !== "all"
      ? filters.status
      : statusFromTab(tab);

  const activeFilters: ReferralListFilters = {
    ...filters,
    status: statusFilter,
  };

  const items = data.items.filter((item) =>
    matchesReferralFilters(item, activeFilters),
  );

  function updateFilters(next: Partial<ReferralListFilters>) {
    const merged = { ...filters, ...next, status: statusFilter };
    setFilters(merged);
    window.history.replaceState(
      null,
      "",
      referralsTabHref(statusFilter, merged),
    );
  }

  function selectTab(next: ReferralTab) {
    setTab(next);
    const nextStatus = statusFromTab(next);
    setFilters((prev) => ({ ...prev, status: nextStatus }));
    window.history.replaceState(
      null,
      "",
      referralsTabHref(nextStatus, filters),
    );
  }

  const referralUrl = data.referralCode
    ? buildReferralUrl(data.referralCode)
    : null;
  const hasLink = Boolean(referralUrl);
  const showGetEmptyState = data.isEmpty && !hasLink;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title="Referrals"
        subtitle="Academy and Whitby referrals, tracked from link to conversion."
        action={
          !showGetEmptyState ? (
            <GetReferralLinkButton
              label="Get link"
              copyLabel="Copy link"
              referralUrl={referralUrl}
            />
          ) : undefined
        }
      />

      <ReferralsTabs
        active={tab}
        filters={activeFilters}
        onChange={selectTab}
      />

      {showGetEmptyState ? (
        <ReferralsEmptyState />
      ) : (
        <>
          <ReferralsFilters filters={activeFilters} onChange={updateFilters} />
          {/* Own scrollport so the list scrolls — overflow-x on the table alone
              traps the wheel and blocks the shell from scrolling. */}
          <div className="min-h-0 flex-1 overflow-auto pb-2">
            <ReferralsTable
              items={items}
              emptyMessage={referralEmptyMessage(
                statusFilter,
                activeFilters,
                data.isEmpty,
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}

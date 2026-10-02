"use client";

import { useState } from "react";
import { HomeLoadWarnings } from "@/partner-center/home/components/HomeLoadWarnings";
import { HomeHeader } from "@/partner-center/home/components/HomeHeader";
import { HomeTabs, tabHref } from "@/partner-center/home/components/HomeTabs";
import { OverviewCards } from "@/partner-center/home/components/OverviewCards";
import { ActionNeededList } from "@/partner-center/home/components/ActionNeededList";
import { RecentActivityList } from "@/partner-center/home/components/RecentActivityList";
import { PayoutGateBanner } from "@/partner-center/home/components/PayoutGateBanner";
import type { HomeDashboard, HomeTab } from "@/partner-center/home/types";

export function HomeView({
  data,
  tab: initialTab,
}: {
  data: HomeDashboard;
  tab: HomeTab;
}) {
  const [tab, setTab] = useState<HomeTab>(initialTab);

  function selectTab(next: HomeTab) {
    setTab(next);
    window.history.replaceState(null, "", tabHref(next));
  }

  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <HomeHeader companyName={data.companyName} />

      <HomeTabs
        active={tab}
        actionCount={data.actions.length}
        onChange={selectTab}
      />

      <HomeLoadWarnings warnings={data.loadWarnings} />

      {tab === "overview" ? (
        <>
          {data.payoutGate !== "eligible" ? (
            <PayoutGateBanner gate={data.payoutGate} />
          ) : null}
          <OverviewCards
            referrals={data.referralCounts}
            opportunities={data.opportunityCounts}
            earnings={data.earnings}
            earningsTermsLine={data.earningsTermsLine}
            programs={data.programs}
          />
        </>
      ) : null}

      {tab === "action" ? <ActionNeededList items={data.actions} /> : null}

      {tab === "activity" ? (
        <RecentActivityList items={data.activity} />
      ) : null}
    </div>
  );
}

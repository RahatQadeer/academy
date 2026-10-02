"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { CompanyTeamTabs } from "@/partner-center/team/components/CompanyTeamTabs";
import { CompanyProfilePanel } from "@/partner-center/team/components/CompanyProfilePanel";
import { InviteMemberModal } from "@/partner-center/team/components/InviteMemberModal";
import { TeamMembersPanel } from "@/partner-center/team/components/TeamMembersPanel";
import type { TeamPageData, TeamTab } from "@/partner-center/team/types";

export function TeamView({ data, tab }: { data: TeamPageData; tab: TeamTab }) {
  const [inviting, setInviting] = useState(false);
  const individual = data.isIndividual;
  const activeTab = individual ? "profile" : tab;
  const pageTitle = individual ? "Partner details" : "Company & Team";

  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title={pageTitle}
        subtitle={data.companyName}
        action={
          !individual && activeTab === "team" && data.canManage ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => setInviting(true)}
            >
              Invite team member
            </Button>
          ) : undefined
        }
      />
      {!individual ? <CompanyTeamTabs active={activeTab} /> : null}
      {activeTab === "team" ? (
        <TeamMembersPanel data={data} />
      ) : (
        <CompanyProfilePanel data={data} />
      )}
      {inviting ? (
        <InviteMemberModal
          companyName={data.companyName}
          onClose={() => setInviting(false)}
        />
      ) : null}
    </div>
  );
}

import { CompanyDetailsCard } from "@/partner-center/team/components/CompanyDetailsCard";
import { PartnerStatusCard } from "@/partner-center/team/components/PartnerStatusCard";
import { PrimaryContactCard } from "@/partner-center/team/components/PrimaryContactCard";
import { LocationsSection } from "@/partner-center/team/components/LocationsSection";
import type { TeamPageData } from "@/partner-center/team/types";

export function CompanyProfilePanel({ data }: { data: TeamPageData }) {
  return (
    <div className={data.isIndividual ? "mt-2" : "mt-6"}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <CompanyDetailsCard data={data} />
        <PartnerStatusCard data={data} />
      </div>
      {!data.isIndividual ? (
        <PrimaryContactCard primaryContact={data.primaryContact} />
      ) : null}
      <LocationsSection data={data} />
    </div>
  );
}

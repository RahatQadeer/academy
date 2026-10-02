import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PartnerNotFound } from "@/partner-center/components/states/PartnerNotFound";
import { partnerCanMutateOpportunities } from "@/partner-center/opportunities/lib/can-mutate";
import { OpportunityDetailView } from "@/partner-center/opportunities/components/OpportunityDetailView";
import { loadOpportunityDetail } from "@/partner-center/opportunities/lib/load-opportunity-detail";

export default async function PartnerOpportunityDetailPage({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const { context } = await requirePartnerAppAccess();
  const data = await loadOpportunityDetail(context, opportunityId);
  if (!data) return <PartnerNotFound />;
  return (
    <OpportunityDetailView
      data={data}
      canEdit={partnerCanMutateOpportunities(context)}
    />
  );
}

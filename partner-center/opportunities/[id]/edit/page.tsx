import { notFound, redirect } from "next/navigation";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { partnerCanMutateOpportunities } from "@/partner-center/opportunities/lib/can-mutate";
import { loadOpportunityDetail } from "@/partner-center/opportunities/lib/load-opportunity-detail";
import { loadProductInterestOptions } from "@/partner-center/opportunities/lib/product-interest-options";
import { EditOpportunityForm } from "@/partner-center/opportunities/components/EditOpportunityForm";

export default async function PartnerEditOpportunityPage({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const { context } = await requirePartnerAppAccess();
  if (!partnerCanMutateOpportunities(context)) {
    redirect(`/partner-center/opportunities/${opportunityId}`);
  }

  const data = await loadOpportunityDetail(context, opportunityId);
  if (!data) notFound();
  if (!data.editable) {
    redirect(`/partner-center/opportunities/${opportunityId}`);
  }

  const productInterestOptions = await loadProductInterestOptions(null, {
    activeOnly: true,
    includeValues: data.productInterest ? [data.productInterest] : [],
  });

  return (
    <EditOpportunityForm
      data={data}
      productInterestOptions={productInterestOptions}
    />
  );
}

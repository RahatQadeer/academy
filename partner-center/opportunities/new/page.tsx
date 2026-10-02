import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PartnerAccessDenied } from "@/partner-center/components/states/PartnerAccessDenied";
import { partnerCanMutateOpportunities } from "@/partner-center/opportunities/lib/can-mutate";
import { SubmitOpportunityForm } from "@/partner-center/opportunities/components/SubmitOpportunityForm";
import { loadProductInterestOptions } from "@/partner-center/opportunities/lib/product-interest-options";

export default async function PartnerSubmitOpportunityPage() {
  const { context } = await requirePartnerAppAccess();
  if (!partnerCanMutateOpportunities(context)) {
    return (
      <PartnerAccessDenied description="Your access is read-only. Ask a Company Admin if you need to submit opportunities." />
    );
  }
  const productInterestOptions = await loadProductInterestOptions(null, {
    activeOnly: true,
  });
  return (
    <SubmitOpportunityForm productInterestOptions={productInterestOptions} />
  );
}

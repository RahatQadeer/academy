import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import {
  addressFromUnknown,
  parseApplicationData,
} from "@/partner-center/lib/application-map";
import { CompanyProfileForm } from "@/partner-center/onboarding/components/CompanyProfileForm";

function marketLabel(markets: unknown, fallback: string) {
  if (fallback.trim()) return fallback;
  return addressFromUnknown(markets);
}

export default async function PartnerCompanyProfilePage() {
  const { context } = await requirePartnerChecklistAccess();
  const application = parseApplicationData(context?.profile?.application_data);
  const company = context?.company;

  return (
    <CompanyProfileForm
      legalName={company?.name || application.legal_name}
      website={company?.website || application.website}
      address={application.address || addressFromUnknown(company?.addresses)}
      market={marketLabel(company?.markets, application.market)}
      audienceServed={company?.audience_served || application.audience_served}
    />
  );
}

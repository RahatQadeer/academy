import { parseApplicationData } from "@/partner-center/lib/application-map";
import { requirePartnerMoreInfoAccess } from "@/partner-center/lib/access";
import { DEFAULT_INFO_REQUEST_MESSAGE } from "@/partner-center/lib/review-state";
import { MoreInfoNeeded } from "@/partner-center/onboarding/components/MoreInfoNeeded";

export default async function PartnerMoreInfoPage() {
  const { context } = await requirePartnerMoreInfoAccess();
  const application = parseApplicationData(context?.profile?.application_data);
  const request = application.info_request;

  return (
    <MoreInfoNeeded
      companyName={context?.company?.name || application.legal_name || null}
      message={request?.message || DEFAULT_INFO_REQUEST_MESSAGE}
    />
  );
}

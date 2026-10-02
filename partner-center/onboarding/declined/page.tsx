import { parseApplicationData } from "@/partner-center/lib/application-map";
import { requirePartnerDeclinedAccess } from "@/partner-center/lib/access";
import { ApplicationDeclined } from "@/partner-center/onboarding/components/ApplicationDeclined";

export default async function PartnerDeclinedPage() {
  const { context } = await requirePartnerDeclinedAccess();
  const application = parseApplicationData(context?.profile?.application_data);

  return <ApplicationDeclined reason={application.decline_reason} />;
}

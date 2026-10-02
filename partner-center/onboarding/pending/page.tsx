import { requirePartnerPendingAccess } from "@/partner-center/lib/access";
import {
  applicationReference,
  parseApplicationData,
} from "@/partner-center/lib/application-map";
import { ApplicationStatus } from "@/partner-center/onboarding/components/ApplicationStatus";

export default async function PartnerPendingPage() {
  const { context } = await requirePartnerPendingAccess();
  const profile = context?.profile ?? null;
  const application = parseApplicationData(profile?.application_data);

  return (
    <ApplicationStatus
      status={profile?.status}
      reference={applicationReference(profile?.id)}
      companyName={context?.company?.name || application.legal_name || null}
    />
  );
}

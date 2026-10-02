import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { PartnerGuideScreen } from "@/partner-center/onboarding/components/ProgramsAndGuide";

export default async function PartnerGuidePage() {
  const { context } = await requirePartnerChecklistAccess();
  const application = parseApplicationData(context?.profile?.application_data);
  const companyName =
    context?.company?.name || application.legal_name || "your firm";

  return (
    <PartnerGuideScreen
      companyName={companyName}
      readOnly={Boolean(application.guide_acknowledged_at)}
    />
  );
}

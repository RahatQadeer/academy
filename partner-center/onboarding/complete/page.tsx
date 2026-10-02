import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { formatProgramList } from "@/partner-center/lib/review-state";
import { OnboardingComplete } from "@/partner-center/onboarding/components/OnboardingComplete";

export default async function PartnerOnboardingCompletePage() {
  const { context } = await requirePartnerChecklistAccess();
  const application = parseApplicationData(context?.profile?.application_data);
  const companyName =
    context?.company?.name || application.legal_name || "Your firm";

  return (
    <OnboardingComplete
      companyName={companyName}
      programSummary={formatProgramList(application.products_of_interest)}
    />
  );
}

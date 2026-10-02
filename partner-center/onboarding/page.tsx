import { emptyApplication, parseApplicationData } from "@/partner-center/lib/application-map";
import { requirePartnerOnboardingAccess } from "@/partner-center/lib/access";
import { ApplicationWizard } from "@/partner-center/onboarding/components/ApplicationWizard";

export default async function PartnerOnboardingPage() {
  const { user, context } = await requirePartnerOnboardingAccess();
  const initial = parseApplicationData(
    context?.profile?.application_data,
    user.email,
  );

  return (
    <ApplicationWizard
      accountEmail={user.email}
      initial={{
        ...emptyApplication(user.email),
        ...initial,
        email: user.email,
        submitted: false,
      }}
    />
  );
}

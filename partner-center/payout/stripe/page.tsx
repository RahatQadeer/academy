import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { StripeRedirectScreen } from "@/partner-center/onboarding/components/StripeRedirectScreen";

export default async function PartnerAppPayoutStripePage() {
  await requirePartnerAppAccess();
  return <StripeRedirectScreen variant="app" />;
}

import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import {
  PartnerTaxAccessDenied,
  requirePartnerTaxMutationAccess,
} from "@/partner-center/lib/tax-access";
import { StripeRedirectScreen } from "@/partner-center/onboarding/components/StripeRedirectScreen";

export default async function PartnerPayoutStripePage() {
  const privileged = await requirePartnerTaxMutationAccess();
  if ("denied" in privileged) {
    return <PartnerTaxAccessDenied />;
  }

  await requirePartnerChecklistAccess();
  return <StripeRedirectScreen />;
}

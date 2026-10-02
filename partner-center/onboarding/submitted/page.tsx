import { requirePartnerPendingAccess } from "@/partner-center/lib/access";
import { ApplicationSubmitted } from "@/partner-center/onboarding/components/ApplicationSubmitted";

export default async function PartnerSubmittedPage() {
  await requirePartnerPendingAccess();

  return <ApplicationSubmitted />;
}

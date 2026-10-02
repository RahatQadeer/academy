import { parseApplicationData } from "@/partner-center/lib/application-map";
import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import { AgreementSigned } from "@/partner-center/onboarding/components/AgreementSigned";

export default async function PartnerAgreementSignedPage() {
  const { context } = await requirePartnerChecklistAccess();
  const application = parseApplicationData(context?.profile?.application_data);

  return <AgreementSigned signedAt={application.agreement_signed_at} />;
}

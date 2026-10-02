import { requirePartnerApprovedAccess } from "@/partner-center/lib/access";
import {
  DEFAULT_PROGRAM_TERMS,
  loadProgramTerms,
} from "@/partner-center/lib/program-terms";
import { AgreementReview } from "@/partner-center/onboarding/components/AgreementReview";

export default async function PartnerAgreementPage() {
  const { context } = await requirePartnerApprovedAccess();
  const profileId = context?.profile?.id;
  const terms = profileId
    ? await loadProgramTerms(profileId)
    : DEFAULT_PROGRAM_TERMS;

  return <AgreementReview terms={terms} />;
}

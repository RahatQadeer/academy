import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { partnerHasActivePrograms } from "@/partner-center/lib/enable-programs";
import {
  DEFAULT_PROGRAM_TERMS,
  loadProgramTerms,
} from "@/partner-center/lib/program-terms";
import { ProgramsTermsScreen } from "@/partner-center/onboarding/components/ProgramsAndGuide";

export default async function PartnerProgramsPage() {
  const { context } = await requirePartnerChecklistAccess();
  const application = parseApplicationData(context?.profile?.application_data);
  const profileId = context?.profile?.id;
  const terms = profileId
    ? await loadProgramTerms(profileId)
    : DEFAULT_PROGRAM_TERMS;
  const companyName =
    context?.company?.name || application.legal_name || "your firm";

  let hasActivePrograms = false;
  if (profileId && isSupabaseConfigured()) {
    const supabase = await createClient();
    hasActivePrograms = await partnerHasActivePrograms(supabase, profileId);
  }

  return (
    <ProgramsTermsScreen
      companyName={companyName}
      terms={terms}
      programs={application.products_of_interest}
      readOnly={Boolean(application.programs_confirmed_at) && hasActivePrograms}
    />
  );
}

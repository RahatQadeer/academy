import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { isReferralChecklistUnlocked } from "@/partner-center/lib/checklist-state";
import { partnerHasActivePrograms } from "@/partner-center/lib/enable-programs";
import { getOrCreateReferralLink } from "@/partner-center/lib/referral-link-store";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { ReferralLinkSetup } from "@/partner-center/onboarding/components/ReferralLinkSetup";

export default async function PartnerReferralSetupPage() {
  const { context } = await requirePartnerChecklistAccess();
  const application = parseApplicationData(context?.profile?.application_data);
  const companyName =
    context?.company?.name || application.legal_name || "your firm";

  let hasReferralLink = false;
  let hasActivePrograms = false;
  const profileId = context?.profile?.id;

  if (profileId && isSupabaseConfigured()) {
    const supabase = await createClient();
    const [{ data }, activePrograms] = await Promise.all([
      supabase
        .from("partner_links_codes")
        .select("id")
        .eq("partner_profile_id", profileId)
        .eq("type", "referral_link")
        .limit(1)
        .maybeSingle(),
      partnerHasActivePrograms(supabase, profileId),
    ]);
    hasReferralLink = Boolean(data?.id);
    hasActivePrograms = activePrograms;
  }

  if (
    !isReferralChecklistUnlocked(context, {
      hasReferralLink,
      hasActivePrograms,
    })
  ) {
    redirect(PARTNER_PATHS.checklist);
  }

  let initialUrl: string | null = null;
  let loadError: string | null = null;

  if (profileId && isSupabaseConfigured()) {
    const supabase = await createClient();
    const writer = createAdminClient() ?? supabase;
    const result = await getOrCreateReferralLink(writer, profileId);
    if (result.url) {
      initialUrl = result.url;
    } else {
      loadError = result.error ?? "Could not create referral link.";
    }
  } else if (!isSupabaseConfigured()) {
    loadError = "Connect Supabase to generate a referral link.";
  }

  return (
    <ReferralLinkSetup
      companyName={companyName}
      initialUrl={initialUrl}
      loadError={loadError}
    />
  );
}

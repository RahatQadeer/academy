import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import { buildChecklistItems } from "@/partner-center/lib/checklist-state";
import { partnerHasActivePrograms } from "@/partner-center/lib/enable-programs";
import { OnboardingChecklist } from "@/partner-center/onboarding/components/OnboardingChecklist";

export default async function PartnerChecklistPage() {
  const { user, context } = await requirePartnerChecklistAccess();

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

  const { items, doneCount, total, firstOpenId, companyName } =
    buildChecklistItems(context, { hasReferralLink, hasActivePrograms });
  const avatarName =
    user.full_name ||
    [context?.contact?.first_name, context?.contact?.last_name]
      .filter(Boolean)
      .join(" ") ||
    parseApplicationData(context?.profile?.application_data).primary_contact_name ||
    "You";

  return (
    <OnboardingChecklist
      companyName={companyName}
      avatarName={avatarName}
      items={items}
      doneCount={doneCount}
      total={total}
      firstOpenId={firstOpenId}
    />
  );
}

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { loadReferralLink } from "@/partner-center/lib/referral-link-store";
import type { LinksPageData } from "@/partner-center/links/types";
import type { LoadResult } from "@/partner-center/lib/load-result";
import type { PartnerContext } from "@/partner-center/types/partner";

export async function loadLinks(
  context: PartnerContext | null,
): Promise<LoadResult<LinksPageData>> {
  const companyName = context?.company?.name?.trim() || null;
  const profileId = context?.profile?.id;
  if (!profileId || !isSupabaseConfigured()) {
    return {
      ok: true,
      data: { sharedReferralUrl: null, companyName },
    };
  }

  const supabase = await createClient();
  const link = await loadReferralLink(supabase, profileId);

  return {
    ok: true,
    data: {
      sharedReferralUrl: link?.url ?? null,
      companyName,
    },
  };
}

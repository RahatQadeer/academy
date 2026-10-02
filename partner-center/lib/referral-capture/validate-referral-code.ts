import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { DEFAULT_COOKIE_LIFE_DAYS } from "@/partner-center/lib/referral-capture/constants";
import type { ValidatedReferralCode } from "@/partner-center/lib/referral-capture/types";

type LinkCodeRow = {
  id: string;
  code: string;
  cookie_life_days: number | null;
  partner_profile_id: string;
  partner_profiles: { id: string; status: string } | { id: string; status: string }[];
};

function profileFromRow(row: LinkCodeRow) {
  const profile = row.partner_profiles;
  return Array.isArray(profile) ? profile[0] : profile;
}

export async function validateReferralCodeWithClient(
  supabase: SupabaseClient,
  rawCode: string,
): Promise<ValidatedReferralCode | null> {
  const code = rawCode.trim();
  if (!code) return null;

  const { data, error } = await supabase
    .from("partner_links_codes")
    .select(
      `
      id,
      code,
      cookie_life_days,
      partner_profile_id,
      partner_profiles!inner ( id, status )
    `,
    )
    .eq("code", code)
    .eq("type", "referral_link")
    .maybeSingle();

  if (error || !data) return null;

  const row = data as LinkCodeRow;
  const profile = profileFromRow(row);
  if (!profile || profile.status !== "active") return null;

  return {
    referralCodeId: row.id,
    partnerProfileId: row.partner_profile_id,
    code: row.code,
    cookieLifeDays: row.cookie_life_days ?? DEFAULT_COOKIE_LIFE_DAYS,
  };
}

export async function validateReferralCode(
  rawCode: string,
  supabase?: SupabaseClient,
): Promise<ValidatedReferralCode | null> {
  const client = supabase ?? createAdminClient();
  if (!client) return null;
  return validateReferralCodeWithClient(client, rawCode);
}

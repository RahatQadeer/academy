import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReferralUrl } from "@/partner-center/lib/referral-url";
import { partnerFacingError } from "@/partner-center/lib/user-facing-error";

export type ReferralLinkRecord = {
  code: string;
  url: string;
};

const REFERRAL_CODE_LENGTH = 7;
const REFERRAL_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** 7-character alphanumeric referral code (lowercase + digits). */
export function randomReferralCode() {
  const bytes = new Uint8Array(REFERRAL_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    code += REFERRAL_CODE_ALPHABET[bytes[i]! % REFERRAL_CODE_ALPHABET.length];
  }
  return code;
}

export async function loadReferralLink(
  supabase: SupabaseClient,
  partnerProfileId: string,
): Promise<ReferralLinkRecord | null> {
  const { data } = await supabase
    .from("partner_links_codes")
    .select("code")
    .eq("partner_profile_id", partnerProfileId)
    .eq("type", "referral_link")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.code) return null;
  return { code: data.code, url: buildReferralUrl(data.code) };
}

export async function getOrCreateReferralLink(
  supabase: SupabaseClient,
  partnerProfileId: string,
): Promise<{ error?: string; code?: string; url?: string }> {
  const existing = await loadReferralLink(supabase, partnerProfileId);
  if (existing) return existing;

  let cookieLifeDays = 90;
  try {
    const { loadPlatformAttributionConfig } = await import(
      "@/super-admin/partner-center/services/platform-attribution-config"
    );
    const config = await loadPlatformAttributionConfig(supabase);
    cookieLifeDays = config.defaultCookieLifeDays;
  } catch {
    // keep 90
  }

  let lastError = "Could not create referral link.";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomReferralCode();
    const { data, error } = await supabase
      .from("partner_links_codes")
      .insert({
        partner_profile_id: partnerProfileId,
        code,
        type: "referral_link",
        cookie_life_days: cookieLifeDays,
      })
      .select("code")
      .single();

    if (!error && data?.code) {
      return { code: data.code, url: buildReferralUrl(data.code) };
    }
    lastError = partnerFacingError(
      "Could not create referral link.",
      error?.message,
    );
    if (error?.code !== "23505") break;
  }

  return { error: lastError };
}

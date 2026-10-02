"use server";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getOrCreateReferralLink } from "@/partner-center/lib/referral-link-store";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";

export type EnsureReferralLinkResult = {
  error?: string;
  code?: string;
  url?: string;
};

export async function ensureReferralLink(): Promise<EnsureReferralLinkResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to generate a referral link." };
  }

  const session = await getSessionProfile();
  if (!session) return { error: "Sign in to continue." };

  const entitled = session.entitlements.some(
    (item) =>
      item.product === "partner_center" &&
      (item.status === "active" || item.status === "trial"),
  );
  if (!entitled) {
    return { error: "Partner Center access is not available for this account." };
  }

  const context = await resolvePartner(session.user, session.entitlements);
  const profile = context?.profile;
  if (!profile || profile.status !== "active") {
    return { error: "Activate your Partner Center before generating a link." };
  }

  const supabase = await createClient();
  return getOrCreateReferralLink(supabase, profile.id);
}

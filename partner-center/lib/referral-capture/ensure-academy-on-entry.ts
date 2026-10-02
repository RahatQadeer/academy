import { cookies } from "next/headers";
import { getSessionProfile } from "@/base/identity/session";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { ensureProgramReferralForUser } from "@/partner-center/lib/referral-capture/ensure-program-referral";
import { resolveReferralAttributionFromCookie } from "@/partner-center/lib/referral-capture/parse-referral-cookie";

/** Open Academy referral when a referred user enters Academy. Never throws. */
export async function ensureAcademyReferralOnEntry(): Promise<void> {
  try {
    const profile = await getSessionProfile();
    const user = profile?.user;
    if (!user?.id || !user.email) return;

    const supabase = createAdminClient();
    if (!supabase) return;

    const attribution = resolveReferralAttributionFromCookie(await cookies());

    await ensureProgramReferralForUser(supabase, {
      userId: user.id,
      email: user.email,
      fullName: user.full_name || user.preferred_name || undefined,
      program: "academy",
      referralCode: attribution?.code,
      capturedAt: attribution?.capturedAt,
    });
  } catch {
    // Attribution must never block Academy.
  }
}

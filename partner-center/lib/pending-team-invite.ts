import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { partnerTeamInvitePath } from "@/partner-center/lib/invite-url";

/**
 * Latest pending Company & Team invite for this email, if still within expiry.
 * Used to keep invitees on the invite accept path instead of Apply / onboarding.
 */
export async function findPendingPartnerTeamInviteToken(
  email: string | null | undefined,
): Promise<string | null> {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("invitations")
    .select("token, expires_at")
    .eq("context_type", "partner_team")
    .eq("status", "pending")
    .ilike("invitee_email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.token) return null;
  if (
    data.expires_at &&
    new Date(data.expires_at as string).getTime() < Date.now()
  ) {
    return null;
  }

  return data.token as string;
}

export async function pendingPartnerTeamInvitePath(
  email: string | null | undefined,
): Promise<string | null> {
  const token = await findPendingPartnerTeamInviteToken(email);
  return token ? partnerTeamInvitePath(token) : null;
}

"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { findInvitationByToken } from "@/base/auth/invitation";
import { acceptPartnerTeamInvite } from "@/partner-center/lib/accept-team-invite";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";

export type AcceptPartnerInviteResult = { error?: string; redirect?: string };

/**
 * Partner Center team invite accept — lives in partner-center so we do not
 * depend on app/auth/accept-invite changes for partner_team.
 */
export async function acceptPartnerTeamInviteAction(input: {
  token: string;
  password: string;
  fullName?: string | null;
}): Promise<AcceptPartnerInviteResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to accept invitations." };
  }

  const { token, password, fullName } = input;
  if (!token.trim() || !password) {
    return { error: "Invitation token and password are required." };
  }

  const invitation = await findInvitationByToken(token);
  if (!invitation || invitation.context_type !== "partner_team") {
    return { error: "This invitation is not valid." };
  }
  if (invitation.status !== "pending") {
    return { error: "This invitation is no longer active." };
  }
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return { error: "This invitation has expired." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!admin) {
    return {
      error:
        "Partner Center could not finish the invite. Ask whoever invited you to try again.",
    };
  }

  const { data: existing } = await supabase.auth.getUser();

  if (existing.user) {
    const { error } = await supabase.auth.updateUser({
      password,
      data: fullName ? { full_name: fullName } : undefined,
    });
    if (error) return { error: partnerFacingError("Could not accept the invite.", error.message) };
  } else {
    const { data: account } = await admin
      .from("users")
      .select("id")
      .ilike("email", invitation.invitee_email.trim())
      .maybeSingle();

    const { error } = account
      ? await admin.auth.admin.updateUserById(account.id as string, {
          password,
          email_confirm: true,
          user_metadata: fullName ? { full_name: fullName } : undefined,
        })
      : await admin.auth.admin.createUser({
          email: invitation.invitee_email,
          password,
          email_confirm: true,
          user_metadata: fullName ? { full_name: fullName } : {},
        });
    if (error) return { error: partnerFacingError("Could not accept the invite.", error.message) };

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invitation.invitee_email,
      password,
    });
    if (signInError) return { error: partnerFacingError("Could not accept the invite.", signInError.message) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "Your invitation is valid, but the account could not be signed in. Ask whoever invited you to send a new invitation.",
    };
  }

  if (fullName) {
    await admin.from("users").update({ full_name: fullName }).eq("id", user.id);
  }

  const result = await acceptPartnerTeamInvite({
    admin,
    invitation,
    user,
    fullName,
  });
  if (result.error) return { error: result.error };

  await admin
    .from("invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  return { redirect: "/partner-center" };
}

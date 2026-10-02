import "server-only";

import { siteUrl } from "@/base/auth/site";
import { createClient as createServerClient } from "@/base/lib/supabase/server";
import {
  createServiceClient,
  hashInviteToken,
  inviteExpiresAt,
  mintInviteToken,
  normalizeAdminEmail,
  type PartnerAdminRow,
} from "@/partner-center/admin/lib/constants";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type InvitePartnerAdminResult =
  | {
      ok: true;
      email: string;
      inviteUrl: string;
      emailSent: boolean;
      emailError?: string;
    }
  | { ok: false; error: string };

async function emailIsPartner(email: string): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  const normalized = normalizeAdminEmail(email);

  const { data: contacts } = await admin
    .from("contacts")
    .select("id")
    .ilike("email", normalized)
    .limit(20);

  const contactIds = (contacts ?? []).map((row) => row.id as string);
  if (contactIds.length === 0) return false;

  const [{ count: teamCount }, { count: primaryCount }] = await Promise.all([
    admin
      .from("partner_team_members")
      .select("id", { count: "exact", head: true })
      .in("contact_id", contactIds),
    admin
      .from("partner_profiles")
      .select("id", { count: "exact", head: true })
      .in("primary_contact_id", contactIds),
  ]);

  return (teamCount ?? 0) > 0 || (primaryCount ?? 0) > 0;
}

function absoluteInviteUrl(token: string) {
  // Same as Company & Team: siteUrl() is localhost in `next dev`.
  return `${siteUrl()}${PA_ADMIN.signup}?token=${encodeURIComponent(token)}`;
}

/** Supabase Accept-invite email — same pattern as Company & Team invites. */
function partnerAdminInviteEmailRedirect(token: string) {
  const next = `${PA_ADMIN.signup}?token=${encodeURIComponent(token)}`;
  return `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * After Supabase "Accept invite" (or any signed-in session), Partner Admins
 * must land in the admin shell — not `/switcher`. Activates an invited row
 * when the session email matches.
 *
 * Pass `onlyInvited: true` on the switcher so already-active Partner Admins
 * can still open Whitby / Academy from there; only stuck Accept-invite
 * sessions are pulled into the admin shell.
 */
export { resolvePartnerAdminPostAuthLanding } from "@/partner-center/admin/lib/post-auth-landing";

export async function invitePartnerAdmin(input: {
  email: string;
  invitedByEmail: string;
}): Promise<InvitePartnerAdminResult> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "Supabase admin is not configured." };

  const email = normalizeAdminEmail(input.email);
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (await emailIsPartner(email)) {
    return {
      ok: false,
      error: "That email already belongs to a partner account.",
    };
  }

  const { data: existing } = await admin
    .from("partner_admins")
    .select(
      "id, email, user_id, status, invite_token_hash, invite_expires_at, invited_by_email, invited_at, activated_at, revoked_at",
    )
    .eq("email", email)
    .maybeSingle();

  if (existing?.status === "active") {
    return { ok: false, error: "That person is already an active Partner Admin." };
  }

  const { token, hash } = mintInviteToken();
  const expires = inviteExpiresAt();
  const invitedBy = normalizeAdminEmail(input.invitedByEmail);

  const payload = {
    email,
    status: "invited" as const,
    invite_token_hash: hash,
    invite_expires_at: expires,
    invited_by_email: invitedBy,
    invited_at: new Date().toISOString(),
    activated_at: null,
    revoked_at: null,
    user_id: existing?.user_id ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await admin
      .from("partner_admins")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("partner_admins").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  await writePartnerAdminAudit(admin, {
    actorUserId: null,
    action: "partner_admin_invited",
    entityType: "partner_admin",
    entityId: email,
    newValue: { email, invited_by: invitedBy },
    reason: `invited_by:${invitedBy}`,
  });

  const inviteUrl = absoluteInviteUrl(token);
  // Same pattern as Company & Team: Accept invite → /auth/callback → admin signup.
  const acceptRedirect = partnerAdminInviteEmailRedirect(token);
  let emailSent = false;
  let emailError: string | undefined;

  try {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: acceptRedirect,
        data: { partner_admin_invite: true },
      },
    );
    if (inviteError) {
      // Existing Auth users cannot be invited again — still return copyable link.
      emailError = inviteError.message;
    } else {
      emailSent = true;
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : "Email send failed.";
  }

  // Prefer our custom invite link (password set on admin signup), not Supabase's.
  // Attempt a plain email via invite is best-effort; always expose copyable URL.
  return {
    ok: true,
    email,
    inviteUrl,
    emailSent,
    emailError: emailSent ? undefined : emailError ?? "Could not send email.",
  };
}

export async function revokePartnerAdmin(input: {
  email: string;
  revokedByEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "Supabase admin is not configured." };

  const email = normalizeAdminEmail(input.email);
  const { data: row } = await admin
    .from("partner_admins")
    .select(
      "id, email, user_id, status, invite_token_hash, invite_expires_at, invited_by_email, invited_at, activated_at, revoked_at",
    )
    .eq("email", email)
    .maybeSingle();

  if (!row) return { ok: false, error: "Partner Admin not found." };

  const { error } = await admin
    .from("partner_admins")
    .update({
      status: "revoked",
      invite_token_hash: null,
      invite_expires_at: null,
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) return { ok: false, error: error.message };

  if (row.user_id) {
    try {
      await admin.auth.admin.signOut(row.user_id, "global");
    } catch {
      // Role is already revoked; session kill is best-effort.
    }
  }

  await writePartnerAdminAudit(admin, {
    actorUserId: null,
    action: "partner_admin_revoked",
    entityType: "partner_admin",
    entityId: email,
    newValue: {
      email,
      revoked_by: normalizeAdminEmail(input.revokedByEmail),
    },
    reason: `revoked_by:${normalizeAdminEmail(input.revokedByEmail)}`,
  });

  return { ok: true };
}

export async function lookupInviteByToken(
  token: string,
): Promise<PartnerAdminRow | null> {
  const admin = createServiceClient();
  if (!admin || !token) return null;
  const hash = hashInviteToken(token);

  const { data } = await admin
    .from("partner_admins")
    .select(
      "id, email, user_id, status, invite_token_hash, invite_expires_at, invited_by_email, invited_at, activated_at, revoked_at",
    )
    .eq("invite_token_hash", hash)
    .eq("status", "invited")
    .maybeSingle();

  if (!data) return null;
  if (
    !data.invite_expires_at ||
    new Date(data.invite_expires_at).getTime() <= Date.now()
  ) {
    return null;
  }
  return data as PartnerAdminRow;
}

export async function claimInviteWithNewPassword(input: {
  token: string;
  password: string;
}): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "Supabase admin is not configured." };

  const row = await lookupInviteByToken(input.token);
  if (!row) return { ok: false, error: "invalid" };

  const hash = hashInviteToken(input.token);
  const supabase = await createServerClient();

  // Mirror Company & Team invite accept: if Supabase already created the Auth
  // user (Accept invite email) or a public.users row exists, set the password
  // on that account instead of creating a second one.
  const { data: sessionData } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const sessionUser = sessionData.user;
  const sessionEmail = sessionUser?.email
    ? normalizeAdminEmail(sessionUser.email)
    : "";
  const sessionMatches =
    Boolean(sessionUser?.id) &&
    Boolean(sessionEmail) &&
    sessionEmail === row.email;

  const { data: existingPublic } = await admin
    .from("users")
    .select("id, email")
    .eq("email", row.email)
    .maybeSingle();

  let userId: string;

  if (sessionMatches && sessionUser) {
    const { error } = await supabase!.auth.updateUser({
      password: input.password,
      data: { partner_admin: true },
    });
    if (error) return { ok: false, error: error.message };
    userId = sessionUser.id;
  } else if (existingPublic?.id) {
    const { error } = await admin.auth.admin.updateUserById(existingPublic.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: {
        partner_admin: true,
        full_name: row.email.split("@")[0],
      },
    });
    if (error) return { ok: false, error: error.message };
    userId = existingPublic.id;
  } else {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: row.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          partner_admin: true,
          full_name: row.email.split("@")[0],
        },
      });

    if (createError || !created.user) {
      return {
        ok: false,
        error: createError?.message ?? "Could not create account.",
      };
    }

    const { data: publicUser } = await admin
      .from("users")
      .select("id")
      .eq("id", created.user.id)
      .maybeSingle();

    userId = publicUser?.id ?? created.user.id;
  }

  const { error: claimError } = await admin.rpc("claim_partner_admin_invite", {
    p_email: row.email,
    p_token_hash: hash,
    p_user_id: userId,
  });

  if (claimError) {
    // Invite may already have been activated on callback — treat active row OK.
    const activated = await activateInvitedOnSignIn({
      email: row.email,
      userId,
    });
    if (!activated.ok) return { ok: false, error: "invalid" };
  }

  await admin
    .from("entitlements")
    .delete()
    .eq("user_id", userId)
    .eq("product", "partner_center");

  return { ok: true, email: row.email };
}

export async function activateInvitedOnSignIn(input: {
  email: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false }> {
  const admin = createServiceClient();
  if (!admin) return { ok: false };

  const { error } = await admin.rpc("activate_partner_admin_on_signin", {
    p_email: normalizeAdminEmail(input.email),
    p_user_id: input.userId,
  });

  if (error) return { ok: false };

  await admin
    .from("entitlements")
    .delete()
    .eq("user_id", input.userId)
    .eq("product", "partner_center");

  return { ok: true };
}

export async function listPartnerAdmins(): Promise<PartnerAdminRow[]> {
  const admin = createServiceClient();
  if (!admin) return [];
  const { data } = await admin
    .from("partner_admins")
    .select(
      "id, email, user_id, status, invite_token_hash, invite_expires_at, invited_by_email, invited_at, activated_at, revoked_at",
    )
    .order("invited_at", { ascending: false });
  return (data ?? []) as PartnerAdminRow[];
}

export async function signOutPartnerAdminSession() {
  const supabase = await createServerClient();
  if (supabase) await supabase.auth.signOut();
}

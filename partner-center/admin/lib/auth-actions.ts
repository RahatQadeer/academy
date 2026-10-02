"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import {
  PARTNER_ADMIN_GENERIC_ERROR,
  PARTNER_ADMIN_SIGNIN_GENERIC_ERROR,
  passwordMeetsPartnerAdminRules,
  partnerAdminPasswordProblem,
  sanitizePartnerAdminNext,
} from "@/partner-center/admin/lib/constants";
import {
  activateInvitedOnSignIn,
  claimInviteWithNewPassword,
  lookupInviteByToken,
} from "@/partner-center/admin/lib/invite";
import { createServiceClient, normalizeAdminEmail } from "@/partner-center/admin/lib/constants";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";
import { ensureBaseAccount } from "@/base/identity/bootstrap";

export type AdminAuthResult = { error?: string; ok?: boolean; redirectTo?: string };

export async function partnerAdminSignUpAction(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<AdminAuthResult> {
  const row = await lookupInviteByToken(input.token);
  if (!row) return { error: PARTNER_ADMIN_GENERIC_ERROR };

  if (input.password !== input.confirmPassword) {
    return { error: "Passwords do not match." };
  }
  const problem = partnerAdminPasswordProblem(input.password);
  if (problem) return { error: problem };
  if (!passwordMeetsPartnerAdminRules(input.password)) {
    return { error: partnerAdminPasswordProblem(input.password) ?? "Invalid password." };
  }

  const result = await claimInviteWithNewPassword({
    token: input.token,
    password: input.password,
  });

  if (!result.ok) {
    if (result.error === "invalid") {
      return { error: PARTNER_ADMIN_GENERIC_ERROR };
    }
    return { error: result.error };
  }

  // Same as Company & Team accept: land signed-in on the right home, not
  // partner onboarding and not a second sign-in screen.
  const supabase = await createClient();
  if (!supabase) {
    return { ok: true, redirectTo: PA_ADMIN.signin };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: result.email,
    password: input.password,
  });
  if (error || !data.user) {
    return { ok: true, redirectTo: PA_ADMIN.signin };
  }

  try {
    await ensureBaseAccount(supabase, data.user);
  } catch {
    // may already exist
  }

  await activateInvitedOnSignIn({
    email: result.email,
    userId: data.user.id,
  });

  return { ok: true, redirectTo: PA_ADMIN.root };
}

export async function partnerAdminSignInAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<AdminAuthResult> {
  const supabase = await createClient();
  if (!supabase) return { error: "Auth is not configured." };

  const email = normalizeAdminEmail(input.email);
  const next = sanitizePartnerAdminNext(input.next);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error || !data.user) {
    return { error: PARTNER_ADMIN_SIGNIN_GENERIC_ERROR };
  }

  try {
    await ensureBaseAccount(supabase, data.user);
  } catch {
    // may already exist
  }

  const admin = createServiceClient();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: PARTNER_ADMIN_SIGNIN_GENERIC_ERROR };
  }

  const { data: role } = await admin
    .from("partner_admins")
    .select("id, status, invite_expires_at")
    .eq("email", email)
    .maybeSingle();

  if (!role) {
    await supabase.auth.signOut();
    return { error: PARTNER_ADMIN_SIGNIN_GENERIC_ERROR };
  }

  if (role.status === "invited") {
    const activated = await activateInvitedOnSignIn({
      email,
      userId: data.user.id,
    });
    if (!activated.ok) {
      await supabase.auth.signOut();
      return { error: PARTNER_ADMIN_SIGNIN_GENERIC_ERROR };
    }
  } else if (role.status !== "active") {
    await supabase.auth.signOut();
    return { error: PARTNER_ADMIN_SIGNIN_GENERIC_ERROR };
  }

  return { ok: true, redirectTo: next };
}

export async function partnerAdminSignOutAction() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect(PA_ADMIN.signin);
}

export async function partnerAdminForgotPasswordAction(input: {
  email: string;
}): Promise<AdminAuthResult> {
  const admin = createServiceClient();
  if (!admin) return { error: "Auth is not configured." };

  const email = normalizeAdminEmail(input.email);
  const { data: role } = await admin
    .from("partner_admins")
    .select("id, status")
    .eq("email", email)
    .in("status", ["invited", "active"])
    .maybeSingle();

  // Always look successful to avoid account enumeration.
  if (!role) {
    return { ok: true };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  const base = site || (vercel ? `https://${vercel}` : "http://localhost:3000");
  const redirectTo = `${base}${PA_ADMIN.resetPassword}`;

  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function partnerAdminResetPasswordAction(input: {
  password: string;
  confirmPassword: string;
}): Promise<AdminAuthResult> {
  if (input.password !== input.confirmPassword) {
    return { error: "Passwords do not match." };
  }
  const problem = partnerAdminPasswordProblem(input.password);
  if (problem) return { error: problem };

  const supabase = await createClient();
  if (!supabase) return { error: "Auth is not configured." };

  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  return { ok: true, redirectTo: PA_ADMIN.signin };
}

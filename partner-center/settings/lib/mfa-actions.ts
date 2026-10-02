"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";

type ActionResult = { ok: true } | { error: string };
type StartResult = { ok: true } | { error: string };

function revalidateSecurity() {
  revalidatePath(PARTNER_PATHS.settingsSecurity);
  revalidatePath("/[product]/[[...slug]]", "page");
}

function friendlyMfaError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("mfa") &&
    (lower.includes("disabled") ||
      lower.includes("not enabled") ||
      lower.includes("not been enabled") ||
      lower.includes("feature"))
  ) {
    return "Two-factor authentication is not enabled on this project yet. Ask your platform admin to turn on MFA (TOTP) in Supabase Auth.";
  }
  return message;
}

/** Clear half-finished enrollments so a new TOTP enroll can start cleanly. */
export async function preparePartnerMfaEnrollment(): Promise<StartResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase and enable MFA (TOTP) in the Auth dashboard." };
  }

  await requirePartnerAppAccess();
  const supabase = await createClient();
  const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { error: friendlyMfaError(listError.message) };

  for (const factor of existing?.all ?? []) {
    if (factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  return { ok: true };
}

export async function confirmPartnerMfaEnrollment(input: {
  factorId: string;
  code: string;
}): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase and enable MFA (TOTP) in the Auth dashboard." };
  }

  await requirePartnerAppAccess();

  const factorId = input.factorId.trim();
  const code = input.code.replace(/\D/g, "");
  if (!factorId) return { error: "Setup was interrupted. Start again." };
  if (code.length !== 6) {
    return { error: "Enter the six digits from your authenticator app." };
  }

  const supabase = await createClient();

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError || !challenge) {
    return {
      error: friendlyMfaError(
        challengeError?.message ?? "Could not check that code.",
      ),
    };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) return { error: friendlyMfaError(error.message) };

  // Drop any other verified factors so reconfigure replaces the previous one.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.id !== factorId && factor.status === "verified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  revalidateSecurity();
  return { ok: true };
}

export async function disablePartnerMfa(factorId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to change two-factor authentication." };
  }

  await requirePartnerAppAccess();
  const id = factorId.trim();
  if (!id) return { error: "No authenticator is set up." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
  if (error) return { error: friendlyMfaError(error.message) };

  revalidateSecurity();
  return { ok: true };
}

/** Ends other refresh sessions; this browser stays signed in. */
export async function signOutPartnerOtherSessions(): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to manage sessions." };
  }

  const access = await requirePartnerAppAccess();
  if (access.user.id === "preview") {
    return { error: "Connect Supabase to manage sessions." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      error:
        "Service role key is not configured. Add SUPABASE_SERVICE_ROLE_KEY to sign out other sessions.",
    };
  }

  const { error } = await admin.auth.admin.signOut(access.user.id, "others");
  if (error) return { error: error.message };

  revalidateSecurity();
  return { ok: true };
}

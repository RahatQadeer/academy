"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";

type ActionResult = { ok: true } | { error: string };

function revalidateSecurity() {
  revalidatePath(PARTNER_PATHS.settingsSecurity);
  revalidatePath("/[product]/[[...slug]]", "page");
}

export async function revokePartnerAuthSession(
  sessionId: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to manage sessions." };
  }

  await requirePartnerAppAccess();
  const id = sessionId.trim();
  if (!id) return { error: "Missing session." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_my_auth_session", {
    p_session_id: id,
  });

  if (error) return { error: partnerFacingError("Could not update your session.", error.message) };
  if (data !== true) return { error: "That session could not be signed out." };

  revalidateSecurity();
  return { ok: true };
}

export async function revokeOtherPartnerAuthSessions(): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to manage sessions." };
  }

  await requirePartnerAppAccess();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_other_auth_sessions");
  if (error) return { error: partnerFacingError("Could not update your session.", error.message) };

  revalidateSecurity();
  return { ok: true };
}

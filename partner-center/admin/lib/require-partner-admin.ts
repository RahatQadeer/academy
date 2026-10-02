import "server-only";

import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import {
  createServiceClient,
  normalizeAdminEmail,
  type PartnerAdminRow,
} from "@/partner-center/admin/lib/constants";

export type PartnerAdminSession = {
  userId: string;
  email: string;
  row: PartnerAdminRow;
};

async function loadActivePartnerAdmin(
  userId: string,
  email: string,
): Promise<PartnerAdminRow | null> {
  const admin = createServiceClient();
  if (!admin) return null;

  const normalized = normalizeAdminEmail(email);
  const { data } = await admin
    .from("partner_admins")
    .select(
      "id, email, user_id, status, invite_token_hash, invite_expires_at, invited_by_email, invited_at, activated_at, revoked_at",
    )
    .eq("email", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return null;
  if (data.user_id && data.user_id !== userId) return null;
  return data as PartnerAdminRow;
}

export async function getActivePartnerAdmin(): Promise<PartnerAdminSession | null> {
  if (!isSupabaseConfigured()) return null;
  const session = await getSessionProfile();
  if (!session?.user?.email) return null;

  const row = await loadActivePartnerAdmin(session.user.id, session.user.email);
  if (!row) return null;

  return {
    userId: session.user.id,
    email: normalizeAdminEmail(session.user.email),
    row,
  };
}

export async function isActivePartnerAdmin(): Promise<boolean> {
  return Boolean(await getActivePartnerAdmin());
}

/**
 * Require an active Partner Admin role. Signs out + redirects on failure.
 */
export async function requirePartnerAdmin(): Promise<PartnerAdminSession> {
  const session = await getActivePartnerAdmin();
  if (session) return session;

  const supabase = await createServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/partner-center/admin/signin?error=denied");
}

export async function hasInvitedOrActivePartnerAdminEmail(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  const admin = createServiceClient();
  if (!admin) return false;

  const { data } = await admin
    .from("partner_admins")
    .select("id, status")
    .eq("email", normalizeAdminEmail(email))
    .in("status", ["invited", "active"])
    .maybeSingle();

  return Boolean(data);
}

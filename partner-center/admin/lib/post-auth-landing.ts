import { createClient } from "@supabase/supabase-js";
import { normalizeAdminEmail } from "@/partner-center/admin/lib/shared";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

/**
 * Edge-safe service client for Partner Admin post-auth routing.
 * Do not import `@/partner-center/admin/lib/constants` here — that pulls Node crypto
 * into middleware via `resolvePostAuthLanding`.
 */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function activateInvitedOnSignIn(input: {
  email: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false }> {
  const admin = serviceClient();
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

/** After sign-in, send active/invited Partner Admins to Partner Admin home. */
export async function resolvePartnerAdminPostAuthLanding(input: {
  userId: string;
  email?: string | null;
  onlyInvited?: boolean;
}): Promise<string | null> {
  const email = normalizeAdminEmail(input.email);
  if (!email || !input.userId) return null;

  const admin = serviceClient();
  if (!admin) return null;

  const { data: role } = await admin
    .from("partner_admins")
    .select("id, status, invite_expires_at")
    .eq("email", email)
    .in("status", ["invited", "active"])
    .maybeSingle();

  if (!role) return null;

  if (role.status === "active") {
    if (input.onlyInvited) return null;
  } else if (role.status === "invited") {
    const activated = await activateInvitedOnSignIn({
      email,
      userId: input.userId,
    });
    if (!activated.ok) return null;
  } else {
    return null;
  }

  await admin
    .from("entitlements")
    .delete()
    .eq("user_id", input.userId)
    .eq("product", "partner_center");

  return PA_ADMIN.root;
}

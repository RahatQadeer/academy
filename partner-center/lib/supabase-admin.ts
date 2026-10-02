import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for Partner Center server actions only.
 * Bypasses RLS, so it is used only after the caller is verified as the
 * signed-in, entitled applicant — needed because partner_profiles insert
 * is rejected by is_partner_contact even when contact/user emails match.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

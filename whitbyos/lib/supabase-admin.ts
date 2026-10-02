import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Server use only.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` has no NEXT_PUBLIC_ prefix, so Next never puts it
 * in the browser bundle — imported from a client component this would simply
 * return null rather than leak anything.
 *
 * The key bypasses row-level security entirely, so it is used for exactly one
 * thing: sending invitation emails through Supabase Auth's admin API, which the
 * anon key cannot do. Every other query in Whitby goes through the normal
 * client, so RLS still applies.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

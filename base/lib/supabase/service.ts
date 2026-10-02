import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A client that runs as the service role, bypassing RLS.
 *
 * Only for work the signed-in user cannot do under their own policies and
 * should not be able to: reading the OAuth grant behind a connected
 * integration, and writing back the rows a provider sync pulls in. It never
 * reaches the browser — every caller is a route handler or a server module.
 *
 * Returns null rather than throwing when the key is absent, so a deployment
 * without it degrades to "nothing is connected" instead of a crash.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

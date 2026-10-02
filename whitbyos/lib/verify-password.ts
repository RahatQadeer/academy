import { createClient } from "@supabase/supabase-js";

/**
 * Is this the password the account actually has?
 *
 * Supabase has no "check this password" call, so the only honest way to ask is
 * to try signing in with it. That is done on a client of its own — anon key,
 * `persistSession: false` — so the attempt issues a session that is thrown
 * away instead of writing new auth cookies over the session the person is
 * already using. Getting the current password right should not sign you in
 * again, and getting it wrong should not sign you out.
 *
 * Attempts are rate-limited by Supabase itself, which is the right place for
 * it: this endpoint is the same one the sign-in page uses.
 */
export async function passwordIsCurrent(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !email || !password) return false;

  const probe = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (!error) {
    /*
     * Local scope, and this matters.
     *
     * `signOut()` defaults to global, which revokes every refresh token the
     * user has — so checking your own password correctly would have signed
     * you out of the session you were doing it from, and out of every other
     * device you own. "local" ends only the session this probe just made.
     */
    await probe.auth.signOut({ scope: "local" });
    return true;
  }

  return false;
}

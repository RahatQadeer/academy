import { createClient as createPlainClient } from "@supabase/supabase-js";

/**
 * A sign-in link for someone who already has an account, landing on whatever
 * page the invitation lives at.
 *
 * Supabase will not "invite" an address that already has a login, and it is
 * right not to: there is no account to create. That case is not an edge here,
 * it is the norm for a *resend* — Whitby creates the auth account at the moment
 * it first invites, through `inviteUserByEmail`, so by the time anyone presses
 * Resend the address always exists. What they need is a way in, not a way to
 * sign up.
 *
 * Deliberately not the cookie-bound server client: this only sends mail and
 * returns no session, and running it through the request's own client would put
 * an unrelated account's auth flow next to the sender's cookies.
 * `shouldCreateUser: false` keeps it to addresses that really do exist.
 */
export async function sendSignInLink(email: string, link: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  const plain = createPlainClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await plain.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: link },
  });

  return !error;
}

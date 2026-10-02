import "server-only";

import { createClient } from "@/base/lib/supabase/server";

/**
 * Whether this person has actually been let into a Client Portal.
 *
 * The entitlement cannot answer this. It was handed out at signup for a long
 * time, so every professional on this deployment holds `client_portal:trial`
 * without being anybody's client — and those rows do not disappear now that
 * signup has stopped granting it.
 *
 * `client_portal_identities` is the fact underneath: `accept-invite` writes a
 * row there when somebody follows a professional's invitation, and nothing
 * else writes one. A professional who is also somebody's client has a row and
 * gets in; a professional who is not, does not.
 *
 * Lives here rather than in `entitlements.ts` because that module is imported
 * by client components, and this reads cookies — putting it there pulled
 * `next/headers` into a browser bundle and broke the page.
 */
export async function hasPortalInvitation(userId: string | null | undefined) {
  if (!userId) return false;

  const supabase = await createClient();

  const { data } = await supabase
    .from("client_portal_identities")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}

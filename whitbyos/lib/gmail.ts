import { createServiceClient } from "@/base/lib/supabase/service";
import { normalizeEmail } from "@/base/lib/email";

/**
 * The Gmail grant — SRS §11.1.
 *
 * Connecting Gmail is the ordinary consent round trip, so it goes through
 * `oauth-connect.ts` with every other provider and there is nothing about it
 * here. What is here is the half that only a mailbox needs: a token that stays
 * usable, a place to remember how far the sync got, and giving the grant back.
 *
 * The scope is `gmail.readonly`. Whitby reads incoming mail from people the
 * professional has named and never sends, so asking for anything more would
 * make the consent screen claim more than the product does.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const GMAIL_PROVIDER = "gmail";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

/**
 * Re-exported so everything on the Gmail path lowercases an address the same
 * way. The stored source list is keyed on the address, so "J@x.com" arriving
 * where "j@x.com" was saved has to be the same permission, not a second one.
 */
export { normalizeEmail };

export function gmailConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export type GmailGrant = {
  accessToken: string;
  accountEmail: string | null;
  /** Gmail's history id, or null on a mailbox that has never synced. */
  cursor: string | null;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

/**
 * Marks the connection as needing the professional, rather than retrying.
 *
 * §11.1.7 has this state and Screen 16 draws it. A grant Google refuses is not
 * a transient failure — it is almost always the person having revoked it from
 * their Google account — so a silent retry would leave the screen saying
 * "Connected" about a mailbox nothing can open.
 */
async function needsAttention(workspaceId: string, message: string) {
  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase
    .from("whitbyos_integrations")
    .update({ status: "needs_attention", error_state: message })
    .eq("workspace_id", workspaceId)
    .eq("provider", GMAIL_PROVIDER);
}

/** A usable access token, refreshed if it is within a minute of expiring. */
export async function gmailGrant(workspaceId: string): Promise<GmailGrant | null> {
  if (!gmailConfigured()) return null;

  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("whitbyos_integration_credentials")
    .select("access_token, refresh_token, expires_at, account_email, sync_cursor")
    .eq("workspace_id", workspaceId)
    .eq("provider", GMAIL_PROVIDER)
    .maybeSingle();

  if (!data) return null;

  const accountEmail = (data.account_email as string | null) ?? null;
  const cursor = (data.sync_cursor as string | null) ?? null;
  const expiresAt = data.expires_at ? new Date(data.expires_at as string).getTime() : 0;

  if (data.access_token && expiresAt > Date.now() + 60_000) {
    return { accessToken: data.access_token as string, accountEmail, cursor };
  }

  if (!data.refresh_token) {
    await needsAttention(workspaceId, "Google needs you to connect Gmail again.");
    return null;
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: data.refresh_token as string,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }).toString(),
    cache: "no-store",
  });

  const token = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!token.access_token) {
    await needsAttention(
      workspaceId,
      token.error_description || "Google needs you to connect Gmail again.",
    );
    return null;
  }

  await supabase
    .from("whitbyos_integration_credentials")
    .update({
      access_token: token.access_token,
      expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("provider", GMAIL_PROVIDER);

  return { accessToken: token.access_token, accountEmail, cursor };
}

/** How far the last sync got, so the next one asks only for what came after. */
export async function saveGmailCursor(workspaceId: string, cursor: string | null) {
  if (!cursor) return;

  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase
    .from("whitbyos_integration_credentials")
    .update({ sync_cursor: cursor, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("provider", GMAIL_PROVIDER);
}

/** The sync worked: say so on the row Screen 16 reads. */
export async function markGmailSynced(workspaceId: string) {
  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase
    .from("whitbyos_integrations")
    .update({
      status: "connected",
      last_sync_at: new Date().toISOString(),
      error_state: null,
    })
    .eq("workspace_id", workspaceId)
    .eq("provider", GMAIL_PROVIDER);
}

export { needsAttention as markGmailNeedsAttention };

/**
 * Screen 16.2's Disconnect, on Google's side as well as ours.
 *
 * The stored grant is deleted and the token handed back to Google to revoke.
 * Marking the integration disconnected while keeping a live token that still
 * reads someone's mailbox would make the word on the screen untrue.
 *
 * What was already read stays. `whitbyos_gmail_extracts` hangs off the source
 * list, not off the grant, so disconnecting stops the reading without erasing
 * the professional's notes — which is what Disconnect promises on 16.2, and
 * removing a source is how the other half is asked for.
 */
export async function revokeGmailGrant(workspaceId: string) {
  const supabase = createServiceClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("whitbyos_integration_credentials")
    .select("refresh_token, access_token")
    .eq("workspace_id", workspaceId)
    .eq("provider", GMAIL_PROVIDER)
    .maybeSingle();

  const token = (data?.refresh_token as string | null) || (data?.access_token as string | null);

  if (token) {
    // Best effort: a grant the person already revoked from their Google
    // account answers 400, and that is the state we wanted anyway.
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      cache: "no-store",
    }).catch(() => undefined);
  }

  await supabase
    .from("whitbyos_integration_credentials")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("provider", GMAIL_PROVIDER);
}

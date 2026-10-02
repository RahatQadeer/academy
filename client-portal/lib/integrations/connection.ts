import { siteUrl } from "@/base/auth/site";
import { createServiceClient } from "@/base/lib/supabase/service";
import type { IntegrationKey } from "@/client-portal/types";
import { oauthConfigured, oauthProvider, type OAuthProvider } from "./providers";

/**
 * A client's connection, from consent to revocation — `whitbyos/lib/oauth-connect.ts`
 * and the grant halves of `whitbyos/lib/gmail.ts` and `google-calendar.ts`,
 * keyed on the contact instead of the workspace.
 *
 * Everything here runs on the service role. The tables it writes have row-level
 * security and no policy (client-portal/018), so the only thing standing
 * between one client and another's grant is the `contactId` every function
 * takes — which callers take from `getPortalContext()` and nowhere else.
 */

export const OAUTH_STATE_COOKIE = "pa_portal_oauth_state";

export function redirectUriFor(key: string) {
  return `${siteUrl()}/api/client-portal/integrations/${key}/callback`;
}

export function consentUrl(provider: OAuthProvider, state: string) {
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set("client_id", process.env[provider.clientIdVar] ?? "");
  url.searchParams.set("redirect_uri", redirectUriFor(provider.key));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes);
  url.searchParams.set("state", state);
  for (const [name, value] of Object.entries(provider.authorizeParams ?? {})) {
    url.searchParams.set(name, value);
  }
  return url.toString();
}

/** The email inside a Google or Microsoft id_token, which is not verified here. */
function emailFromIdToken(idToken: unknown) {
  if (typeof idToken !== "string") return null;
  const [, payload] = idToken.split(".");
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
      preferred_username?: string;
    };
    return claims.email ?? claims.preferred_username ?? null;
  } catch {
    return null;
  }
}

type TokenBody = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function postToken(provider: OAuthProvider, body: Record<string, string>) {
  const clientId = process.env[provider.clientIdVar] ?? "";
  const secret = process.env[provider.clientSecretVar] ?? "";

  const response = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ ...body, client_id: clientId, client_secret: secret }).toString(),
    cache: "no-store",
  });

  return { ok: response.ok, token: (await response.json().catch(() => ({}))) as TokenBody };
}

export type ConnectOutcome = { ok: true; account: string | null } | { ok: false; error: string };

/** The callback's half: code in, grant stored, row marked connected. */
export async function completeConnection(input: {
  key: string;
  code: string;
  contactId: string;
  workspaceId: string | null;
  clientId: string | null;
}): Promise<ConnectOutcome> {
  const provider = oauthProvider(input.key);
  if (!provider) return { ok: false, error: "That service can't be connected here." };
  if (!oauthConfigured(provider)) {
    return { ok: false, error: `${provider.label} isn't set up on this site yet.` };
  }

  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "The server is missing its credentials." };

  const { ok, token } = await postToken(provider, {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: redirectUriFor(provider.key),
  });

  if (!ok || !token.access_token) {
    return {
      ok: false,
      error: token.error_description || token.error || `${provider.label} refused the connection.`,
    };
  }

  const account = emailFromIdToken(token.id_token);
  const now = new Date().toISOString();
  const scope = token.scope ?? provider.scopes;

  // A reconnect with no new refresh token keeps the one it had — Microsoft and
  // Google both omit it on some re-consents, and overwriting it with null would
  // quietly give the connection an hour to live.
  const { data: existing } = await supabase
    .from("client_portal_integration_credentials")
    .select("refresh_token")
    .eq("contact_id", input.contactId)
    .eq("provider", provider.key)
    .maybeSingle();

  const { error: credentialError } = await supabase
    .from("client_portal_integration_credentials")
    .upsert(
      {
        contact_id: input.contactId,
        provider: provider.key,
        account_email: account,
        calendar_id: provider.key === "google_calendar" ? "primary" : null,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? (existing?.refresh_token as string | null) ?? null,
        expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
        scope,
        // A different account is a different mailbox; where the last one's
        // sync got to means nothing in it.
        sync_cursor: null,
        updated_at: now,
      },
      { onConflict: "contact_id,provider" },
    );

  if (credentialError) return { ok: false, error: credentialError.message };

  const { error: integrationError } = await supabase.from("client_portal_integrations").upsert(
    {
      contact_id: input.contactId,
      workspace_id: input.workspaceId,
      client_id: input.clientId,
      provider: provider.key,
      status: "connected",
      connected_account: account,
      scopes: scope,
      error_state: null,
      updated_at: now,
    },
    { onConflict: "contact_id,provider" },
  );

  if (integrationError) return { ok: false, error: integrationError.message };

  return { ok: true, account };
}

export type Grant = {
  accessToken: string;
  accountEmail: string | null;
  calendarId: string;
  cursor: string | null;
};

/**
 * Marks the connection as needing the client, rather than retrying.
 *
 * A grant the provider refuses is almost always one the person revoked from
 * their own account, so a silent retry would leave the screen saying
 * "Connected" about something nothing can open.
 */
export async function markNeedsAttention(contactId: string, key: IntegrationKey, message: string) {
  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase
    .from("client_portal_integrations")
    .update({ status: "needs_attention", error_state: message, updated_at: new Date().toISOString() })
    .eq("contact_id", contactId)
    .eq("provider", key);
}

/** The sync worked: say so on the row Integrations reads. */
export async function markSynced(contactId: string, key: IntegrationKey) {
  const supabase = createServiceClient();
  if (!supabase) return;

  const now = new Date().toISOString();
  await supabase
    .from("client_portal_integrations")
    .update({ status: "connected", last_sync_at: now, error_state: null, updated_at: now })
    .eq("contact_id", contactId)
    .eq("provider", key);
}

/** A usable access token, refreshed when it is within a minute of expiring. */
export async function grantFor(contactId: string, key: IntegrationKey): Promise<Grant | null> {
  const provider = oauthProvider(key);
  if (!provider || !oauthConfigured(provider)) return null;

  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("client_portal_integration_credentials")
    .select("access_token, refresh_token, expires_at, account_email, calendar_id, sync_cursor")
    .eq("contact_id", contactId)
    .eq("provider", key)
    .maybeSingle();

  if (!data) return null;

  const base = {
    accountEmail: (data.account_email as string | null) ?? null,
    calendarId: (data.calendar_id as string | null) || "primary",
    cursor: (data.sync_cursor as string | null) ?? null,
  };

  const expiresAt = data.expires_at ? new Date(data.expires_at as string).getTime() : 0;
  if (data.access_token && expiresAt > Date.now() + 60_000) {
    return { ...base, accessToken: data.access_token as string };
  }

  const reconnect = `${provider.label} needs you to connect it again.`;

  if (!data.refresh_token) {
    await markNeedsAttention(contactId, key, reconnect);
    return null;
  }

  const { token } = await postToken(provider, {
    grant_type: "refresh_token",
    refresh_token: data.refresh_token as string,
  });

  if (!token.access_token) {
    await markNeedsAttention(contactId, key, token.error_description || reconnect);
    return null;
  }

  await supabase
    .from("client_portal_integration_credentials")
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? data.refresh_token,
      expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("contact_id", contactId)
    .eq("provider", key);

  return { ...base, accessToken: token.access_token };
}

/** Where the next Gmail sync should start from. */
export async function saveCursor(contactId: string, key: IntegrationKey, cursor: string | null) {
  if (!cursor) return;
  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase
    .from("client_portal_integration_credentials")
    .update({ sync_cursor: cursor, updated_at: new Date().toISOString() })
    .eq("contact_id", contactId)
    .eq("provider", key);
}

/**
 * Disconnect, on the provider's side as well as ours.
 *
 * The grant goes first: marking the row disconnected while a live token still
 * reads someone's mailbox would make the word on the screen untrue. Google has
 * a revocation endpoint and is told; Microsoft has none for a delegated token,
 * so its grant is deleted and expires on its own.
 *
 * The row is kept and marked rather than deleted, as Whitby keeps it — so what
 * was connected, as whom, survives being turned off. What was already read
 * stays too: an extract hangs off the person chosen, not off the grant.
 */
export async function disconnect(contactId: string, key: IntegrationKey) {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false as const, error: "The server is missing its credentials." };

  const provider = oauthProvider(key);

  const { data } = await supabase
    .from("client_portal_integration_credentials")
    .select("refresh_token, access_token")
    .eq("contact_id", contactId)
    .eq("provider", key)
    .maybeSingle();

  const token = (data?.refresh_token as string | null) || (data?.access_token as string | null);

  if (token && provider?.revokeUrl) {
    // Best effort: a grant already revoked from the account answers 400, which
    // is the state wanted anyway.
    await fetch(provider.revokeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      cache: "no-store",
    }).catch(() => undefined);
  }

  await supabase
    .from("client_portal_integration_credentials")
    .delete()
    .eq("contact_id", contactId)
    .eq("provider", key);

  // A calendar's synced events are a copy of something the portal can no
  // longer see. Left behind, they would sit on the Calendar going stale with
  // nothing to say they had stopped being true.
  if (key === "google_calendar" || key === "outlook_calendar") {
    await supabase
      .from("client_portal_calendar_events")
      .delete()
      .eq("contact_id", contactId)
      .eq("provider", key);
  }

  const { error } = await supabase
    .from("client_portal_integrations")
    .update({
      status: "disconnected",
      connected_account: null,
      error_state: null,
      updated_at: new Date().toISOString(),
    })
    .eq("contact_id", contactId)
    .eq("provider", key);

  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

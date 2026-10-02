import { createServiceClient } from "@/base/lib/supabase/service";
import { siteUrl } from "@/base/auth/site";
import { oauthProvider, oauthConfigured, type OAuthProvider } from "@/whitbyos/lib/oauth-providers";

/**
 * The consent round trip, for any of screen 16's apps.
 *
 * One implementation rather than eight: the differences between Slack and
 * Intuit are two URLs and a scope string, which live in the provider table.
 * What happens either side of them is identical, and writing it eight times
 * would mean fixing the same bug eight times.
 */

export type ConnectOutcome = { ok: true; account: string | null } | { ok: false; error: string };

export const OAUTH_STATE_COOKIE = "pa_oauth_state";

export function redirectUriFor(key: string) {
  return `${siteUrl()}/api/whitbyos/integrations/${key}/callback`;
}

export function consentUrl(provider: OAuthProvider, state: string) {
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set("client_id", process.env[provider.clientIdVar] ?? "");
  url.searchParams.set("redirect_uri", redirectUriFor(provider.key));
  if (!provider.omitResponseType) url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    provider.scopeSeparator === ","
      ? provider.scopes.split(/\s+/).filter(Boolean).join(",")
      : provider.scopes,
  );
  url.searchParams.set("state", state);
  for (const [name, value] of Object.entries(provider.authorizeParams ?? {})) {
    url.searchParams.set(name, value);
  }
  return url.toString();
}

/** Reads "team.id" out of a token response without assuming the shape. */
function pluck(body: Record<string, unknown>, path: string | undefined) {
  if (!path) return null;
  let value: unknown = body;
  for (const step of path.split(".")) {
    if (!value || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[step];
  }
  return typeof value === "string" ? value : null;
}

/** The email inside a Google or Microsoft id_token, which is not signed here. */
function emailFromIdToken(idToken: unknown) {
  if (typeof idToken !== "string") return null;
  const [, payload] = idToken.split(".");
  if (!payload) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { email?: string; preferred_username?: string };
    return decoded.email ?? decoded.preferred_username ?? null;
  } catch {
    return null;
  }
}

export async function completeConnection(
  key: string,
  workspaceId: string,
  code: string,
): Promise<ConnectOutcome> {
  const provider = oauthProvider(key);
  if (!provider) return { ok: false, error: "That integration is not one Whitby supports." };
  if (!oauthConfigured(provider)) {
    return { ok: false, error: `${provider.label} is not configured on this deployment yet.` };
  }

  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "Server credentials are missing." };

  // Basic auth as well as the body: DocuSign and Intuit want the header,
  // Google and Slack want the body, and sending both offends none of them.
  const secret = process.env[provider.clientSecretVar] ?? "";
  const clientId = process.env[provider.clientIdVar] ?? "";

  const response = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUriFor(provider.key),
      client_id: clientId,
      client_secret: secret,
    }).toString(),
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  // Slack answers 200 with ok:false, which is a failure wearing a success.
  const failed =
    !response.ok || body.ok === false || (!body.access_token && !body.authed_user);

  if (failed) {
    const said =
      (body.error_description as string) ||
      (body.error as string) ||
      `${provider.label} refused the connection.`;
    return { ok: false, error: said };
  }

  const accessToken = (body.access_token as string) ?? null;
  const refreshToken = (body.refresh_token as string) ?? null;
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;

  const account =
    pluck(body, provider.account?.email) ??
    emailFromIdToken(body.id_token) ??
    pluck(body, provider.account?.id);

  const { error: credentialError } = await supabase
    .from("whitbyos_integration_credentials")
    .upsert(
      {
        workspace_id: workspaceId,
        provider: provider.key,
        account_email: account,
        external_account_id: pluck(body, provider.account?.id),
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        scope: (body.scope as string) ?? provider.scopes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,provider" },
    );

  if (credentialError) return { ok: false, error: credentialError.message };

  const { error: integrationError } = await supabase
    .from("whitbyos_integrations")
    .upsert(
      {
        workspace_id: workspaceId,
        provider: provider.key,
        status: "connected",
        connected_account: account,
        scopes: (body.scope as string) ?? provider.scopes,
        error_state: null,
      },
      { onConflict: "workspace_id,provider" },
    );

  if (integrationError) return { ok: false, error: integrationError.message };

  return { ok: true, account };
}

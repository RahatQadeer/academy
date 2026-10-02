import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INTUIT_SCOPES,
  intuitClientId,
  intuitClientSecret,
  intuitConfigured,
  intuitTokenUrl,
} from "@/partner-center/lib/quickbooks/config";

export type PartnerQbCredential = {
  id: string;
  status: "connected" | "needs_attention" | "disconnected";
  realmId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  scopes: string | null;
  connectedAccount: string | null;
  lastSyncAt: string | null;
  errorState: string | null;
};

export type QbCredentialPublicStatus = {
  status: PartnerQbCredential["status"];
  connectedAccount: string | null;
  realmId: string | null;
  lastSyncAt: string | null;
  errorState: string | null;
  scopes: string | null;
  configured: boolean;
};

function mapRow(row: Record<string, unknown>): PartnerQbCredential {
  return {
    id: row.id as string,
    status: row.status as PartnerQbCredential["status"],
    realmId: (row.realm_id as string | null) ?? null,
    accessToken: (row.access_token as string | null) ?? null,
    refreshToken: (row.refresh_token as string | null) ?? null,
    tokenExpiresAt: (row.token_expires_at as string | null) ?? null,
    scopes: (row.scopes as string | null) ?? null,
    connectedAccount: (row.connected_account as string | null) ?? null,
    lastSyncAt: (row.last_sync_at as string | null) ?? null,
    errorState: (row.error_state as string | null) ?? null,
  };
}

export async function loadQuickBooksCredential(
  admin: SupabaseClient,
): Promise<PartnerQbCredential | null> {
  const { data } = await admin
    .from("partner_integration_credentials")
    .select(
      "id, status, realm_id, access_token, refresh_token, token_expires_at, scopes, connected_account, last_sync_at, error_state",
    )
    .eq("provider", "quickbooks")
    .maybeSingle();

  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function loadQuickBooksCredentialStatus(
  admin: SupabaseClient,
): Promise<QbCredentialPublicStatus> {
  const row = await loadQuickBooksCredential(admin);
  return {
    status: row?.status ?? "disconnected",
    connectedAccount: row?.connectedAccount ?? null,
    realmId: row?.realmId ?? null,
    lastSyncAt: row?.lastSyncAt ?? null,
    errorState: row?.errorState ?? null,
    scopes: row?.scopes ?? null,
    configured: intuitConfigured(),
  };
}

export async function disconnectQuickBooks(
  admin: SupabaseClient,
  updatedByUserId?: string | null,
): Promise<{ error?: string }> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("partner_integration_credentials")
    .update({
      status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      realm_id: null,
      connected_account: null,
      scopes: null,
      error_state: null,
      updated_by_user_id: updatedByUserId ?? null,
      updated_at: now,
    })
    .eq("provider", "quickbooks");

  if (error) return { error: error.message };
  return {};
}

async function refreshAccessToken(
  admin: SupabaseClient,
  credential: PartnerQbCredential,
): Promise<PartnerQbCredential | null> {
  if (!credential.refreshToken || !intuitConfigured()) return null;

  const clientId = intuitClientId();
  const secret = intuitClientSecret();
  const response = await fetch(intuitTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
    }).toString(),
  });

  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok || !body.access_token) {
    await admin
      .from("partner_integration_credentials")
      .update({
        status: "needs_attention",
        error_state:
          (body.error_description as string) ||
          (body.error as string) ||
          "Token refresh failed.",
        updated_at: new Date().toISOString(),
      })
      .eq("provider", "quickbooks");
    return null;
  }

  const expiresIn =
    typeof body.expires_in === "number" ? body.expires_in : 3600;
  const tokenExpiresAt = new Date(
    Date.now() + expiresIn * 1000,
  ).toISOString();
  const refreshToken =
    (body.refresh_token as string | undefined) ?? credential.refreshToken;

  const { data, error } = await admin
    .from("partner_integration_credentials")
    .update({
      access_token: body.access_token as string,
      refresh_token: refreshToken,
      token_expires_at: tokenExpiresAt,
      scopes: (body.scope as string | undefined) ?? credential.scopes ?? INTUIT_SCOPES,
      status: "connected",
      error_state: null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "quickbooks")
    .select(
      "id, status, realm_id, access_token, refresh_token, token_expires_at, scopes, connected_account, last_sync_at, error_state",
    )
    .single();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** Returns a usable access token, refreshing when within 2 minutes of expiry. */
export async function getValidQuickBooksAccessToken(
  admin: SupabaseClient,
): Promise<{
  accessToken: string;
  realmId: string;
  credential: PartnerQbCredential;
} | null> {
  let credential = await loadQuickBooksCredential(admin);
  if (!credential?.accessToken || !credential.realmId) return null;
  if (credential.status === "disconnected") return null;

  const expiresAt = credential.tokenExpiresAt
    ? Date.parse(credential.tokenExpiresAt)
    : 0;
  const needsRefresh =
    !Number.isFinite(expiresAt) || expiresAt - Date.now() < 2 * 60 * 1000;

  if (needsRefresh) {
    const refreshed = await refreshAccessToken(admin, credential);
    if (!refreshed?.accessToken || !refreshed.realmId) return null;
    credential = refreshed;
  }

  return {
    accessToken: credential.accessToken!,
    realmId: credential.realmId!,
    credential,
  };
}

export async function saveQuickBooksOAuthTokens(
  admin: SupabaseClient,
  input: {
    realmId: string;
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
    scopes?: string | null;
    connectedAccount?: string | null;
    updatedByUserId?: string | null;
  },
): Promise<{ error?: string }> {
  const tokenExpiresAt = new Date(
    Date.now() + input.expiresIn * 1000,
  ).toISOString();
  const now = new Date().toISOString();

  const { error } = await admin.from("partner_integration_credentials").upsert(
    {
      provider: "quickbooks",
      status: "connected",
      realm_id: input.realmId,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      token_expires_at: tokenExpiresAt,
      scopes: input.scopes ?? INTUIT_SCOPES,
      connected_account: input.connectedAccount ?? null,
      error_state: null,
      updated_by_user_id: input.updatedByUserId ?? null,
      updated_at: now,
      last_sync_at: now,
    },
    { onConflict: "provider" },
  );

  if (error) return { error: error.message };
  return {};
}

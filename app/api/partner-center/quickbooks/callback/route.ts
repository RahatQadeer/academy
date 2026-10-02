import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { getStaffSession } from "@/super-admin/lib/staff-session";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/base/lib/supabase/admin";
import {
  INTUIT_SCOPES,
  QB_OAUTH_STATE_COOKIE,
  intuitClientId,
  intuitClientSecret,
  intuitConfigured,
  intuitTokenUrl,
} from "@/partner-center/lib/quickbooks/config";
import { fetchQbCompanyDisplayName } from "@/partner-center/lib/quickbooks/api";
import { saveQuickBooksOAuthTokens } from "@/partner-center/lib/quickbooks/credentials";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function to(params: Record<string, string>) {
  const url = new URL(PC_ADMIN.programConfig, siteUrl());
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  return NextResponse.redirect(url);
}

function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  const [, payload] = idToken.split(".");
  if (!payload) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ) as { email?: string };
    return decoded.email ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const jar = await cookies();
  const expected = jar.get(QB_OAUTH_STATE_COOKIE)?.value ?? "";

  const clear = (response: NextResponse) => {
    response.cookies.set(QB_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  };

  if (!intuitConfigured()) {
    return clear(to({ qb_error: "QuickBooks is not configured." }));
  }
  if (!isSupabaseAdminConfigured()) {
    return clear(to({ qb_error: "Supabase admin is not configured." }));
  }

  const refused = query.get("error_description") || query.get("error");
  if (refused) return clear(to({ qb_error: refused }));

  const state = query.get("state");
  if (!state || !expected || state !== expected) {
    return clear(to({ qb_error: "That connection did not start here. Try again." }));
  }

  const code = query.get("code");
  const realmId = query.get("realmId");
  if (!code) return clear(to({ qb_error: "Intuit sent no authorization code." }));
  if (!realmId) return clear(to({ qb_error: "Intuit did not return a realmId." }));

  const staff = await getStaffSession();
  if (!staff?.email) {
    return clear(to({ qb_error: "Sign in as Super Admin to connect QuickBooks." }));
  }

  const clientId = intuitClientId();
  const secret = intuitClientSecret();
  const redirectUri = `${siteUrl()}/api/partner-center/quickbooks/callback`;

  const tokenResponse = await fetch(intuitTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const body = (await tokenResponse.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!tokenResponse.ok || !body.access_token) {
    const said =
      (body.error_description as string) ||
      (body.error as string) ||
      "Intuit refused the connection.";
    return clear(to({ qb_error: said }));
  }

  const accessToken = body.access_token as string;
  // Prefer CompanyInfo name — we only request accounting scope (openid/email
  // broke Intuit connect). Fall back to id_token email when present.
  const companyName = await fetchQbCompanyDisplayName(accessToken, realmId);
  const connectedAccount =
    companyName || emailFromIdToken(body.id_token) || null;

  const admin = createAdminClient();
  const saved = await saveQuickBooksOAuthTokens(admin, {
    realmId,
    accessToken,
    refreshToken: (body.refresh_token as string | undefined) ?? null,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : 3600,
    scopes: (body.scope as string | undefined) ?? INTUIT_SCOPES,
    connectedAccount,
    updatedByUserId: null,
  });

  if (saved.error) {
    return clear(to({ qb_error: saved.error }));
  }

  return clear(to({ qb_connected: "1" }));
}

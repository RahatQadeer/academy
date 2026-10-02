import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { getStaffSession } from "@/super-admin/lib/staff-session";
import {
  INTUIT_SCOPES,
  QB_OAUTH_STATE_COOKIE,
  intuitAuthorizeUrl,
  intuitClientId,
  intuitConfigured,
} from "@/partner-center/lib/quickbooks/config";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function back(error: string) {
  const url = new URL(PC_ADMIN.programConfig, siteUrl());
  url.searchParams.set("qb_error", error);
  return NextResponse.redirect(url);
}

/**
 * Staff-only OAuth start. Lives under `/api/super-admin/*` so product auth
 * middleware never sends Super Admin (staff cookie only) to `/login`.
 * Callback stays at `/api/partner-center/quickbooks/callback` (registered with Intuit).
 */
export async function GET() {
  if (!intuitConfigured()) {
    return back("QuickBooks is not configured on this deployment yet.");
  }

  const staff = await getStaffSession();
  if (!staff?.email) {
    return NextResponse.redirect(new URL("/super-admin/signin", siteUrl()));
  }

  const state = crypto.randomUUID();
  const redirectUri = `${siteUrl()}/api/partner-center/quickbooks/callback`;
  const url = new URL(intuitAuthorizeUrl());
  url.searchParams.set("client_id", intuitClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INTUIT_SCOPES);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set(QB_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
  return response;
}

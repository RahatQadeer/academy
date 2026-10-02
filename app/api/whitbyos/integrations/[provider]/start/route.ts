import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { OAUTH_STATE_COOKIE, consentUrl } from "@/whitbyos/lib/oauth-connect";
import { oauthConfigured, oauthProvider } from "@/whitbyos/lib/oauth-providers";

export const dynamic = "force-dynamic";

const LIST = "/whitbyos/integrations";

function back(error: string) {
  const url = new URL(LIST, siteUrl());
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/**
 * Screen 16's Connect, for every app except Google Calendar.
 *
 * Google Calendar keeps its own route because it does far more than connect.
 * This one is the consent round trip and nothing else, which is all the other
 * eight need to reach "Connected".
 *
 * The state parameter is generated here and kept in a short-lived httpOnly
 * cookie, so a callback that did not begin with this browser's own click is
 * refused rather than connecting somebody's account on a forged request.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: key } = await params;
  const provider = oauthProvider(key);

  if (!provider) return back("That integration is not one Whitby supports.");
  if (!oauthConfigured(provider)) {
    return back(`${provider.label} is not configured on this deployment yet.`);
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return back("Create your workspace before connecting anything.");

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(consentUrl(provider, state));

  response.cookies.set(OAUTH_STATE_COOKIE, `${state}|${key}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  });

  return response;
}

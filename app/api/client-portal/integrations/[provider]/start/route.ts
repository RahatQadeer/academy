import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { OAUTH_STATE_COOKIE, consentUrl } from "@/client-portal/lib/integrations/connection";
import { oauthConfigured, oauthProvider } from "@/client-portal/lib/integrations/providers";

export const dynamic = "force-dynamic";

const LIST = "/client-portal/integrations";

function back(message: string) {
  const url = new URL(LIST, siteUrl());
  url.searchParams.set("toast", message);
  return NextResponse.redirect(url);
}

/**
 * Connect, on the portal's Integrations — Whitby's
 * `/api/whitbyos/integrations/[provider]/start`, for a client.
 *
 * The state is generated here and kept in a short-lived httpOnly cookie with
 * the provider and the contact it was started for, so a callback that did not
 * begin with this browser's own click — or that comes back into a different
 * login — is refused rather than connecting somebody's mailbox to the wrong
 * person.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: key } = await params;
  const provider = oauthProvider(key);

  if (!provider) return back("That service can't be connected here.");
  if (!oauthConfigured(provider)) return back(`${provider.label} isn't set up on this site yet.`);

  const ctx = await getPortalContext();
  if (ctx.mode !== "live" || !ctx.contactId) {
    return back("Connecting needs a signed-in client account. This is a sample account.");
  }
  if (!ctx.areas.integrations) return back("Integrations is not part of your access.");

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(consentUrl(provider, state));

  response.cookies.set(OAUTH_STATE_COOKIE, `${state}|${key}|${ctx.contactId}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  });

  return response;
}

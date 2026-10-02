import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import {
  OAUTH_STATE_COOKIE,
  completeConnection,
} from "@/client-portal/lib/integrations/connection";
import { oauthProvider } from "@/client-portal/lib/integrations/providers";
import { syncGoogleCalendar } from "@/client-portal/lib/integrations/google-calendar";

export const dynamic = "force-dynamic";

const LIST = "/client-portal/integrations";

function to(params: Record<string, string>) {
  const url = new URL(LIST, siteUrl());
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = NextResponse.redirect(url);
  // Cleared whatever happens: a state used once must not be usable again.
  response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

/** Where the provider sends a client back, having asked them. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: key } = await params;
  const query = new URL(request.url).searchParams;
  const stored = (await cookies()).get(OAUTH_STATE_COOKIE)?.value ?? "";
  const [expected, startedFor, startedBy] = stored.split("|");

  const provider = oauthProvider(key);
  if (!provider) return to({ toast: "That service can't be connected here." });

  const refused = query.get("error");
  if (refused) {
    return to({
      toast:
        refused === "access_denied"
          ? `${provider.label} was not connected.`
          : query.get("error_description") || refused,
    });
  }

  const state = query.get("state");
  if (!state || !expected || state !== expected || startedFor !== key) {
    return to({ toast: "That connection link had expired. Try connecting again." });
  }

  const code = query.get("code");
  if (!code) return to({ toast: `${provider.label} sent nothing back.` });

  const ctx = await getPortalContext();
  if (ctx.mode !== "live" || !ctx.contactId || ctx.contactId !== startedBy) {
    return to({ toast: "You were signed out while connecting. Sign in and try again." });
  }

  const result = await completeConnection({
    key,
    code,
    contactId: ctx.contactId,
    workspaceId: ctx.workspaceId,
    clientId: ctx.clientId,
  });

  if (!result.ok) return to({ toast: result.error });

  // A calendar has something to show straight away; read it after the
  // redirect so the client lands on Integrations without waiting on Google.
  if (key === "google_calendar") {
    const contactId = ctx.contactId;
    after(() => syncGoogleCalendar(contactId, ctx.timezone).then(() => undefined));
  }

  // Gmail reads nothing until somebody is chosen, so connecting it opens the
  // choice at once rather than leaving a connected mailbox doing nothing.
  return key === "gmail"
    ? to({ manage: "gmail", toast: "Gmail is connected. Choose whose mail may be read." })
    : to({ toast: `${provider.label} is connected.` });
}

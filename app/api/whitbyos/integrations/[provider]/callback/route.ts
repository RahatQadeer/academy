import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { OAUTH_STATE_COOKIE, completeConnection } from "@/whitbyos/lib/oauth-connect";
import { oauthProvider } from "@/whitbyos/lib/oauth-providers";

export const dynamic = "force-dynamic";

const LIST = "/whitbyos/integrations";

function to(params: Record<string, string>) {
  const url = new URL(LIST, siteUrl());
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return NextResponse.redirect(url);
}

/** Where the provider sends somebody back, having asked them. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: key } = await params;
  const query = new URL(request.url).searchParams;
  const jar = await cookies();
  const stored = jar.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const [expected, startedFor] = stored.split("|");

  // Cleared whatever happens: a state that has been used once must not be
  // usable again.
  const clear = (response: NextResponse) => {
    response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  };

  const provider = oauthProvider(key);
  if (!provider) return clear(to({ error: "That integration is not one Whitby supports." }));

  // The provider's own refusal, which is a sentence worth repeating rather
  // than replacing with one of ours.
  const refused = query.get("error_description") || query.get("error");
  if (refused) return clear(to({ error: refused }));

  const state = query.get("state");
  if (!state || !expected || state !== expected || startedFor !== key) {
    return clear(to({ error: "That connection did not start here. Try again." }));
  }

  const code = query.get("code");
  if (!code) return clear(to({ error: `${provider.label} sent nothing back.` }));

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return clear(to({ error: "No workspace found." }));

  const result = await completeConnection(key, workspaceId, code);
  if (!result.ok) return clear(to({ error: result.error }));

  return clear(to({ connected: key }));
}

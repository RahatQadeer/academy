import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import {
  GOOGLE_OAUTH_COOKIE,
  completeGoogleConnection,
} from "@/whitbyos/lib/google-calendar";

export const dynamic = "force-dynamic";

const CALENDAR = "/whitbyos/calendar";

function finish(next: string, params: Record<string, string>) {
  const url = new URL(next, siteUrl());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

/**
 * Where Google sends the professional back to.
 *
 * The grant is stored against the workspace they were in when they left, not
 * against the account — one person can coordinate for two family offices, and
 * connecting a calendar in one has no business appearing in the other.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const stored = (await cookies()).get(GOOGLE_OAUTH_COOKIE)?.value ?? "";
  const [expectedState, storedNext] = stored.split("|");
  const next = storedNext && storedNext.startsWith("/whitbyos/") ? storedNext : CALENDAR;

  const denied = params.get("error");
  if (denied) {
    return finish(next, {
      error: denied === "access_denied" ? "Google Calendar was not connected." : denied,
    });
  }

  const code = params.get("code");
  const state = params.get("state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return finish(next, { error: "That connection link had expired. Try connecting again." });
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return finish(next, { error: "No workspace to connect the calendar to." });

  const result = await completeGoogleConnection(workspaceId, code);
  if (!result.ok) return finish(next, { error: result.error });

  return finish(next, { connected: "google_calendar" });
}

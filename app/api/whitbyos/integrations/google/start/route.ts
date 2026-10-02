import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import {
  GOOGLE_OAUTH_COOKIE,
  googleConfigured,
  googleConsentUrl,
} from "@/whitbyos/lib/google-calendar";

export const dynamic = "force-dynamic";

const CALENDAR = "/whitbyos/calendar";

/** Anything that could come back from this must be a path inside Whitby. */
function safeNext(value: string | null) {
  return value && value.startsWith("/whitbyos/") ? value : CALENDAR;
}

function back(next: string, error: string) {
  const url = new URL(next, siteUrl());
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/**
 * Screen 16's Connect, and the "Connect" beside Google Calendar on Screen 8.
 *
 * The state parameter is generated here and kept in a short-lived httpOnly
 * cookie, so a callback that did not begin with this browser's own click is
 * refused rather than connecting somebody's calendar on a forged request.
 */
export async function GET(request: Request) {
  const next = safeNext(new URL(request.url).searchParams.get("next"));

  if (!googleConfigured()) {
    return back(next, "Google Calendar isn't set up on this deployment yet.");
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return back(next, "Create your workspace before connecting a calendar.");

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(googleConsentUrl(state));

  response.cookies.set(GOOGLE_OAUTH_COOKIE, `${state}|${next}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  });

  return response;
}

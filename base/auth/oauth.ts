import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { isPartnerNext, partnerSignInHref } from "@/base/auth/query";
import { whitbyEntryPath } from "@/base/switcher/products";

/**
 * Starting a hosted sign-in, for whichever provider the button belongs to.
 *
 * Google is the only one. The screens used to offer Microsoft beside it and
 * this file carried an `azure` branch for it, which no button reached and no
 * credentials existed for — pressing it went to the provider, failed there,
 * and came back as a sentence. Both are gone.
 *
 * A provider Supabase has no credentials for still comes back as an error
 * redirected on to the sign-in screen, rather than left as a broken page at
 * the provider.
 */
export type OAuthProvider = "google";

const LABEL: Record<OAuthProvider, string> = {
  google: "Google",
};

function loginDest(nextPath: string) {
  return new URL(isPartnerNext(nextPath) ? partnerSignInHref() : "/login", siteUrl());
}

export async function startOAuth(provider: OAuthProvider, nextPath: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Onboarding is where the callback sends people who need it, so asking to
  // return there would fight the redirect that follows sign-in.
  const next = nextPath.startsWith("/onboarding")
    ? "/switcher"
    : whitbyEntryPath(nextPath || "/switcher");

  if (!url || !key) {
    const dest = loginDest(nextPath);
    dest.searchParams.set("error", "Supabase is not connected yet.");
    return NextResponse.redirect(dest);
  }

  const cookieStore = await cookies();
  const staged: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          staged.push({ name, value, options });
          try {
            cookieStore.set(name, value, options as never);
          } catch {
            // Route handlers still receive cookies via the staged list.
          }
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      // Always offer the chooser: somebody signed into a personal Google
      // account should not be silently signed in with it.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    const dest = loginDest(next);
    dest.searchParams.set(
      "error",
      error?.message || `${LABEL[provider]} sign-in is not enabled on this project yet.`,
    );
    return NextResponse.redirect(dest);
  }

  const response = NextResponse.redirect(data.url);
  for (const cookie of staged) {
    response.cookies.set(cookie.name, cookie.value, cookie.options as never);
  }
  return response;
}

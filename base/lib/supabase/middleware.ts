import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolvePostAuthLanding } from "@/base/auth/landing";
import { postAuthPath, productionHost } from "@/base/auth/site";
import { isAcademyNext } from "@/base/auth/query";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/check-email",
  "/confirmed",
  "/forgot-password",
  "/reset-password",
  "/password-updated",
  "/invite",
  "/auth",
  // Screens 0 and 0.1 — someone trying Whitby before they have an account.
  "/whitby-os",
  // Public Academy certificate verification (Certificate ID / shared link).
  "/academy/verify",
  // Brent marketing landing — module detail + platform overview.
  "/modules",
  "/platform",
];

/** Reachable while signed in but not yet through the second factor. */
const HALF_SIGNED_IN = ["/verify", "/auth", "/login", "/password-updated"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // A preview deployment is a .vercel.app host that is deliberately not
  // production, and sending it to production is sending it away from the only
  // build that has the branch on it — which is the whole reason it exists.
  const canonical = productionHost();
  if (
    process.env.VERCEL_ENV !== "preview" &&
    hostname.endsWith(".vercel.app") &&
    hostname !== canonical
  ) {
    const dest = request.nextUrl.clone();
    dest.hostname = canonical;
    dest.protocol = "https:";
    dest.port = "";
    return NextResponse.redirect(dest, request.method === "GET" ? 308 : 307);
  }

  if (pathname.startsWith("/auth/") && pathname !== "/auth/callback") {
    return NextResponse.next({ request });
  }

  // Staff QuickBooks OAuth (callback + legacy start). Gated by getStaffSession
  // in the route — must not require a product Supabase user.
  if (pathname.startsWith("/api/partner-center/quickbooks/")) {
    return NextResponse.next({ request });
  }

  // A `code` on a page means Supabase landed someone there mid-auth, and the
  // exchange has to happen at /auth/callback. A `code` on an API route means
  // nothing of the sort: a route handler that starts its own OAuth round-trip
  // gets its provider's code back the same way, and it is the only thing that
  // knows what to do with it. Pulling that to /auth/callback hands a Google
  // authorization code to Supabase, which fails as "PKCE code verifier not
  // found in storage" — the app is looking for a flow it never began.
  if (
    !pathname.startsWith("/api/") &&
    pathname !== "/auth/callback" &&
    // The reset form holds a recovery token deliberately: it is spent when the
    // new password is sent, not when the page is opened, so a mail scanner
    // fetching the link cannot burn it. Sweeping it back to the callback here
    // sent the page to the callback, which sent it back to the page.
    pathname !== "/reset-password" &&
    (request.nextUrl.searchParams.has("code") || request.nextUrl.searchParams.has("token_hash"))
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/auth/callback";
    if (!dest.searchParams.get("next")) {
      dest.searchParams.set(
        "next",
        postAuthPath(dest.searchParams.get("type"), pathname),
      );
    }
    return NextResponse.redirect(dest);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pa-pathname", pathname);

  if (!url || !key) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as never),
        );
      },
    },
  });

  /**
   * A redirect that keeps the session Supabase just renewed.
   *
   * `getUser()` below refreshes an expired access token, and the project
   * rotates refresh tokens: the old one is spent the moment a new pair is
   * issued, with ten seconds' grace and no more. Supabase hands that pair
   * back through `setAll`, which writes it onto `supabaseResponse` — and a
   * `NextResponse.redirect` is a different response, carrying none of it.
   *
   * So a request that both refreshed and redirected left the browser holding
   * a refresh token that had already been spent. Nothing looked wrong until
   * the next one, which had nothing valid to refresh with and went to
   * /login. The session is configured never to expire — no timebox, no
   * inactivity timeout — so every automatic sign-out is a refresh that was
   * thrown away, and this was a way to throw one away.
   */
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    if (isAcademyNext(pathname)) {
      redirectUrl.searchParams.set("brand", "academy");
    }
    return redirectTo(redirectUrl);
  }

  // Somebody with an authenticator gets a session as soon as their password is
  // right — Supabase issues one at assurance level 1 and upgrades it when the
  // code is accepted. That first session can already read their data, so the
  // redirect after login is not what protects anything. This is.
  if (user && !HALF_SIGNED_IN.some((path) => pathname.startsWith(path))) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
      const dest = request.nextUrl.clone();
      dest.pathname = "/verify";
      dest.search = "";
      dest.searchParams.set("next", pathname);
      return redirectTo(dest);
    }
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const next = request.nextUrl.searchParams.get("next");
    const brand = request.nextUrl.searchParams.get("brand");
    const requestedNext = next || (brand === "academy" ? "/academy" : "/switcher");
    const landing = await resolvePostAuthLanding(supabase, user.id, requestedNext);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.search = "";
    redirectUrl.pathname = landing;
    return redirectTo(redirectUrl);
  }

  return supabaseResponse;
}

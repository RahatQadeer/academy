import { NextResponse, NextRequest } from "next/server";
import { updateSession } from "@/base/lib/supabase/middleware";
import { isPartnerAuthPath } from "@/partner-center/lib/auth-routes";
import { applyReferralCaptureToResponse } from "@/partner-center/lib/referral-capture/middleware";
import { gateSuperAdmin } from "@/super-admin/lib/gate-middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  const forwarded = new NextRequest(request, { headers });

  // Stripe posts to the billing webhooks with a signature, not a session.
  // Sending them to /login turns every delivery into a redirect Stripe reads
  // as a failure, and it retries for days.
  if (pathname.startsWith("/api/") && pathname.endsWith("/webhook")) {
    return NextResponse.next({ request: forwarded });
  }

  // Super Admin staff login/logout — cookie session, not product Auth.
  if (pathname.startsWith("/api/super-admin/")) {
    return NextResponse.next({ request: forwarded });
  }

  // QuickBooks OAuth start/callback are staff-gated inside the route handlers
  // (getStaffSession). Product Supabase auth must not send them to /login —
  // Super Admin often has only the staff cookie, not a product user session.
  if (pathname.startsWith("/api/partner-center/quickbooks/")) {
    return NextResponse.next({ request: forwarded });
  }

  // Scheduled work has no session behind it. Every route under here carries a
  // shared secret of its own and refuses without one.
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next({ request: forwarded });
  }

  // Partner Center serves its own branded auth screens, so they must stay
  // reachable while signed out like the shared /login and /signup routes.
  if (isPartnerAuthPath(pathname)) {
    return NextResponse.next({ request: forwarded });
  }

  // Super Admin: dedicated staff gate (signin public; rest allowlisted).
  if (pathname.startsWith("/super-admin")) {
    return gateSuperAdmin(forwarded);
  }

  const response = await updateSession(forwarded);

  // Shared auth sends signed-out visitors to /login. Partner Center keeps them
  // on its own sign-in screen, which posts to the same /auth routes.
  // Partner Admin unsigned visits go to the admin sign-in, not partner sign-in.
  if (pathname.startsWith("/partner-center")) {
    const location = response.headers.get("location");
    if (location) {
      const destination = new URL(location, request.nextUrl.origin);
      if (destination.pathname === "/login") {
        const signIn = request.nextUrl.clone();
        signIn.pathname = pathname.startsWith("/partner-center/admin")
          ? "/partner-center/admin/signin"
          : "/partner-center/signin";
        signIn.search = "";
        const redirect = NextResponse.redirect(signIn);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
    }
  }

  let finalResponse = response;
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref) {
    finalResponse = await applyReferralCaptureToResponse(request, finalResponse, ref);
  }
  return finalResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/google|auth/login|auth/signup|auth/forgot-password|auth/reset-password|auth/sign-out|auth/accept-invite|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import {
  readStaffSessionCookie,
  staffCookieOptions,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_COOKIE_FALLBACK,
  verifyStaffSessionValue,
} from "@/super-admin/lib/staff-session-cookie";

function isPublicStaffPath(pathname: string) {
  return pathname === "/super-admin/signin";
}

function clearStaffCookies(response: NextResponse) {
  const cleared = { ...staffCookieOptions(0), maxAge: 0 };
  response.cookies.set(STAFF_SESSION_COOKIE, "", cleared);
  response.cookies.set(STAFF_SESSION_COOKIE_FALLBACK, "", cleared);
}

/**
 * Early gate for Super Admin pages.
 * Public: /super-admin/signin only.
 * Everything else requires a valid staff cookie; otherwise redirect to sign-in.
 * Sign-in never redirects back to the hub (avoids redirect loops).
 */
export async function gateSuperAdmin(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicStaffPath(pathname)) {
    return NextResponse.next();
  }

  const token = readStaffSessionCookie((name) => request.cookies.get(name)?.value);
  const staff = await verifyStaffSessionValue(token);

  if (staff) {
    return NextResponse.next();
  }

  const dest = request.nextUrl.clone();
  dest.pathname = "/super-admin/signin";
  dest.search = "";
  const response = NextResponse.redirect(dest);
  if (token) clearStaffCookies(response);
  return response;
}

import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/http";
import {
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_COOKIE_FALLBACK,
  staffCookieOptions,
} from "@/super-admin/lib/staff-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.redirect(
    new URL("/super-admin/signin", siteUrl()),
    { status: 302 },
  );
  const clear = { ...staffCookieOptions(0), maxAge: 0 };
  response.cookies.set(STAFF_SESSION_COOKIE, "", clear);
  response.cookies.set(STAFF_SESSION_COOKIE_FALLBACK, "", clear);
  return response;
}

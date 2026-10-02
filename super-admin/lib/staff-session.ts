import "server-only";

import { cookies } from "next/headers";
import {
  readStaffSessionCookie,
  verifyStaffSessionValue,
} from "@/super-admin/lib/staff-session-cookie";

export {
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_COOKIE_FALLBACK,
  STAFF_SESSION_MAX_AGE_SEC,
  createStaffSessionValue,
  verifyStaffSessionValue,
  staffCookieOptions,
  staffSessionCookieName,
  readStaffSessionCookie,
} from "@/super-admin/lib/staff-session-cookie";

/** Current Super Admin staff session from the request cookies (RSC / route handlers). */
export async function getStaffSession(): Promise<{ email: string } | null> {
  const jar = await cookies();
  const token = readStaffSessionCookie((name) => jar.get(name)?.value);
  const payload = await verifyStaffSessionValue(token);
  if (!payload) return null;
  return { email: payload.email };
}

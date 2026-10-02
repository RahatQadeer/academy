import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { normalizeEmail } from "@/base/lib/email";
import {
  createStaffSessionValue,
  staffCookieOptions,
  staffSessionCookieName,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_COOKIE_FALLBACK,
} from "@/super-admin/lib/staff-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GENERIC_FAIL = "Invalid email or password.";
const LOCKED =
  "Too many failed sign-in attempts. Try again in 15 minutes.";

function clientKey(request: Request, email: string) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = (forwarded?.split(",")[0] || request.headers.get("x-real-ip") || "unknown")
    .trim()
    .slice(0, 128);
  return `ip:${ip}|email:${email}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured for Super Admin." },
      { status: 503 },
    );
  }

  if (
    !process.env.SUPER_ADMIN_SESSION_SECRET ||
    process.env.SUPER_ADMIN_SESSION_SECRET.trim().length < 32
  ) {
    return NextResponse.json(
      {
        error:
          "SUPER_ADMIN_SESSION_SECRET is not configured (min 32 characters).",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const attemptKey = clientKey(request, email);

  const { data: locked } = await admin.rpc("super_admin_login_locked", {
    p_key: attemptKey,
  });

  if (locked === true) {
    await sleep(400);
    return NextResponse.json({ error: LOCKED }, { status: 429 });
  }

  const started = Date.now();
  const { data, error } = await admin.rpc("verify_super_admin", {
    p_email: email,
    p_password: password,
  });

  const ok = !error && data === true;

  await admin.rpc("record_super_admin_login_attempt", {
    p_key: attemptKey,
    p_success: ok,
  });

  // Constant-ish response time to reduce timing oracles.
  const elapsed = Date.now() - started;
  if (elapsed < 400) await sleep(400 - elapsed);

  if (!ok) {
    return NextResponse.json({ error: GENERIC_FAIL }, { status: 401 });
  }

  const token = await createStaffSessionValue(email);
  const response = NextResponse.json({ redirect: "/super-admin" });
  const cookieName = staffSessionCookieName();
  response.cookies.set(cookieName, token, staffCookieOptions());
  // Clear the other name so only one session cookie remains.
  const other =
    cookieName === STAFF_SESSION_COOKIE
      ? STAFF_SESSION_COOKIE_FALLBACK
      : STAFF_SESSION_COOKIE;
  response.cookies.set(other, "", { ...staffCookieOptions(0), maxAge: 0 });
  return response;
}

import { NextResponse } from "next/server";
import { runCredentialRenewalReminders } from "@/academy/lib/credentialRenewalReminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.ACADEMY_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Daily cron: send / record 90 / 60 / 30 day credential renewal reminders.
 * Secure with ACADEMY_CRON_SECRET (or CRON_SECRET). Optional RESEND_API_KEY for email.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = await runCredentialRenewalReminders();
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}

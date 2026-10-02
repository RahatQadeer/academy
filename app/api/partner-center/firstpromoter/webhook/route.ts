import { NextResponse } from "next/server";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { handleFirstPromoterWebhook } from "@/partner-center/lib/firstpromoter/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifySecret(request: Request): boolean {
  const configured = process.env.FIRSTPROMOTER_WEBHOOK_SECRET?.trim();
  if (!configured) {
    // If no secret configured, accept when FirstPromoter API key is present
    // and Authorization / X-FP-Secret matches API key (dev convenience).
    const apiKey = process.env.FIRSTPROMOTER_API_KEY?.trim();
    if (!apiKey) return false;
    const auth = request.headers.get("authorization") ?? "";
    const header = request.headers.get("x-fp-secret") ?? "";
    return (
      auth === `Bearer ${apiKey}` || header === apiKey
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  const header = request.headers.get("x-fp-secret") ?? "";
  return (
    auth === `Bearer ${configured}` ||
    header === configured
  );
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin is not configured." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = await handleFirstPromoterWebhook(supabase, body);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}

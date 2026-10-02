import { NextResponse } from "next/server";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { verifyPartnerApiSecret } from "@/partner-center/lib/api-auth";
import { promoteEarningsToPayable } from "@/partner-center/lib/attribution";
import { runStripePayoutForPartner } from "@/partner-center/lib/payouts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyPartnerApiSecret(request, "PARTNER_PAYOUT_SECRET")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin is not configured." },
      { status: 503 },
    );
  }

  let body: { partnerProfileId?: string } = {};
  try {
    body = (await request.json()) as { partnerProfileId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const partnerProfileId = body.partnerProfileId?.trim();
  if (!partnerProfileId) {
    return NextResponse.json(
      { error: "partnerProfileId is required." },
      { status: 400 },
    );
  }

  await promoteEarningsToPayable(supabase, partnerProfileId);
  const result = await runStripePayoutForPartner(supabase, partnerProfileId);

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { verifyPartnerApiSecret } from "@/partner-center/lib/api-auth";
import { closeExpiredReferrals } from "@/partner-center/lib/attribution/close-expired-referrals";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Bulk-close open referrals past their attribution window.
 * Auth: Bearer PARTNER_ATTRIBUTION_SECRET (or PARTNER_PAYOUT_SECRET fallback unused —
 * uses attribution secret only).
 */
export async function POST(request: Request) {
  if (!verifyPartnerApiSecret(request, "PARTNER_ATTRIBUTION_SECRET")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin is not configured." },
      { status: 503 },
    );
  }

  let partnerProfileId: string | undefined;
  let limit = 500;
  try {
    const body = (await request.json()) as {
      partnerProfileId?: string;
      limit?: number;
    };
    partnerProfileId = body.partnerProfileId?.trim() || undefined;
    if (
      typeof body.limit === "number" &&
      Number.isFinite(body.limit) &&
      body.limit > 0
    ) {
      limit = Math.min(Math.floor(body.limit), 2000);
    }
  } catch {
    // Empty body is fine for full bulk expire.
  }

  const result = await closeExpiredReferrals(supabase, {
    partnerProfileId,
    limit,
  });

  return NextResponse.json({
    ok: true,
    scanned: result.scanned,
    closed: result.closedIds.length,
    closedIds: result.closedIds,
  });
}

import { NextResponse } from "next/server";
import { promoteEarningsToPayable } from "@/partner-center/lib/attribution/promote-payable";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_LIMIT = 500;

/**
 * Advance held → pending → approved → payable for partners with open earnings
 * (§17.1.12 waiting period, §17.7.6–7 payment terms). Assumed ops default —
 * SRS does not name a cron.
 *
 * Vercel Cron: Authorization Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not set." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase admin is not configured." },
      { status: 503 },
    );
  }

  const { data: rows, error } = await supabase
    .from("partner_earnings")
    .select("partner_profile_id")
    .in("status", ["held", "pending", "approved"])
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const profileIds = [
    ...new Set(
      (rows ?? [])
        .map((row) => row.partner_profile_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let promotedPartners = 0;
  let promotedEarnings = 0;
  let releasedFromHold = 0;
  let approvedFromPending = 0;
  const failures: { partnerProfileId: string; error: string }[] = [];

  for (const partnerProfileId of profileIds) {
    try {
      const result = await promoteEarningsToPayable(supabase, partnerProfileId);
      promotedPartners += 1;
      promotedEarnings += result.promotedCount;
      releasedFromHold += result.releasedFromHoldCount ?? 0;
      approvedFromPending += result.approvedFromPendingCount ?? 0;
    } catch (caught) {
      failures.push({
        partnerProfileId,
        error: caught instanceof Error ? caught.message : "Promote failed.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scannedPartners: profileIds.length,
    promotedPartners,
    promotedEarnings,
    releasedFromHold,
    approvedFromPending,
    failures,
  });
}

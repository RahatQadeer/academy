import { NextResponse } from "next/server";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { verifyPartnerApiSecret } from "@/partner-center/lib/api-auth";
import {
  promoteEarningsToPayable,
  recordQualifyingAction,
  type QualifyingActionInput,
} from "@/partner-center/lib/attribution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseBody(body: unknown): QualifyingActionInput | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const referredUserId =
    typeof raw.referredUserId === "string" ? raw.referredUserId.trim() : "";
  const product =
    raw.product === "whitbyos" || raw.product === "platform"
      ? "whitbyos"
      : raw.product === "academy"
        ? "academy"
        : null;
  const qualifyingAction =
    typeof raw.qualifyingAction === "string" ? raw.qualifyingAction.trim() : "";
  const eventSource =
    raw.eventSource === "stripe" ||
    raw.eventSource === "quickbooks" ||
    raw.eventSource === "manual"
      ? raw.eventSource
      : null;

  if (!referredUserId || !product || !qualifyingAction || !eventSource) {
    return null;
  }

  return {
    referredUserId,
    product,
    qualifyingAction,
    commissionable: raw.commissionable !== false,
    eventSource,
    externalPaymentId:
      typeof raw.externalPaymentId === "string"
        ? raw.externalPaymentId.trim()
        : undefined,
    eventTimestamp:
      typeof raw.eventTimestamp === "string"
        ? raw.eventTimestamp.trim()
        : undefined,
    productId:
      typeof raw.productId === "string" ? raw.productId.trim() : undefined,
    amountCollectedCents:
      typeof raw.amountCollectedCents === "number"
        ? raw.amountCollectedCents
        : undefined,
  };
}

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = parseBody(body);
  if (!input) {
    return NextResponse.json(
      {
        error:
          "Required: referredUserId, product (academy|whitbyos), qualifyingAction, eventSource.",
      },
      { status: 400 },
    );
  }

  const result = await recordQualifyingAction(supabase, input);

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  if (result.referralId) {
    const { data: profile } = await supabase
      .from("partner_referrals")
      .select("partner_profile_id")
      .eq("id", result.referralId)
      .maybeSingle();
    if (profile?.partner_profile_id) {
      await promoteEarningsToPayable(
        supabase,
        profile.partner_profile_id as string,
      );
    }
  }

  return NextResponse.json(result);
}

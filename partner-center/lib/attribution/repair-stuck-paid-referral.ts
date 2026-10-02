import type { SupabaseClient } from "@supabase/supabase-js";
import { createEarningFromEvent } from "@/partner-center/lib/attribution/create-earning";
import { recordQualifyingAction } from "@/partner-center/lib/attribution/record-qualifying-action";
import type { QualifyingActionResult } from "@/partner-center/lib/attribution/types";
import { commissionProgramForReferral } from "@/partner-center/lib/referral-capture/infer-program";

/**
 * Re-run conversion for an open referral that already has a
 * first_paid_subscription attribution event but never flipped to Converted.
 * If already converted with no earning, creates the missing earning.
 */
export async function repairStuckPaidReferral(
  supabase: SupabaseClient,
  referralId: string,
): Promise<QualifyingActionResult> {
  const { data: referral, error: referralError } = await supabase
    .from("partner_referrals")
    .select("id, status, referred_user_id, program, partner_profile_id")
    .eq("id", referralId)
    .maybeSingle();

  if (referralError || !referral?.id) {
    return {
      ok: false,
      error: referralError?.message ?? "Referral not found.",
    };
  }

  const { data: event, error: eventError } = await supabase
    .from("partner_attribution_events")
    .select(
      "id, external_payment_id, amount_collected_cents, event_timestamp, product",
    )
    .eq("referral_id", referralId)
    .eq("qualifying_action", "first_paid_subscription")
    .order("event_timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventError || !event?.id) {
    return {
      ok: false,
      error:
        eventError?.message ??
        "No first_paid_subscription attribution event found for this referral.",
      referralId: referral.id,
    };
  }

  if (referral.status === "converted") {
    const { data: existingEarning } = await supabase
      .from("partner_earnings")
      .select("id")
      .eq("attribution_event_id", event.id)
      .maybeSingle();

    if (existingEarning?.id) {
      return {
        ok: true,
        skipped: true,
        reason: "Referral is already converted.",
        referralId: referral.id,
        eventId: event.id,
        earningId: existingEarning.id as string,
        referralStatus: "converted",
      };
    }

    const program =
      commissionProgramForReferral(String(referral.program)) ?? "platform";
    const earning = await createEarningFromEvent(supabase, event.id, {
      amountCollectedCents:
        typeof event.amount_collected_cents === "number"
          ? event.amount_collected_cents
          : undefined,
      program,
    });

    if (!earning.ok && !earning.skipped) {
      return {
        ok: true,
        referralId: referral.id,
        eventId: event.id,
        referralStatus: "converted",
        earningError: earning.error ?? "Could not create earning.",
        reason: "Converted already; earning create failed.",
      };
    }

    return {
      ok: true,
      referralId: referral.id,
      eventId: event.id,
      earningId: earning.earningId,
      referralStatus: "converted",
      reason: "Created missing earning for already-converted referral.",
    };
  }

  if (referral.status !== "referred" && referral.status !== "in_progress") {
    return {
      ok: false,
      error: `Referral status "${referral.status}" cannot be repaired to converted.`,
      referralId: referral.id,
      referralStatus: referral.status,
    };
  }

  const referredUserId = referral.referred_user_id as string | null;
  if (!referredUserId) {
    return {
      ok: false,
      error: "Referral has no referred_user_id.",
      referralId: referral.id,
    };
  }

  const product =
    referral.program === "academy" ? "academy" : ("whitbyos" as const);

  return recordQualifyingAction(supabase, {
    referredUserId,
    product,
    qualifyingAction: "first_paid_subscription",
    commissionable: true,
    eventSource: "stripe",
    externalPaymentId:
      (event.external_payment_id as string | null) ?? undefined,
    amountCollectedCents:
      typeof event.amount_collected_cents === "number"
        ? event.amount_collected_cents
        : undefined,
    eventTimestamp: (event.event_timestamp as string | null) ?? undefined,
    productId:
      typeof event.product === "string" && event.product.startsWith("price_")
        ? event.product
        : undefined,
  });
}

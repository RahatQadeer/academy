import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  applyStripeEarningReversal,
  type StripeEarningReversalResult,
} from "@/partner-center/lib/attribution/apply-stripe-earning-reversal";
import {
  handleChargeSucceeded,
  type StripeChargeSucceededResult,
} from "@/partner-center/lib/attribution/stripe-charge-succeeded";

export type StripeRefundEventResult = StripeEarningReversalResult;
export type StripeCollectionEventResult =
  | StripeRefundEventResult
  | StripeChargeSucceededResult;

function paymentRefFromCharge(charge: Stripe.Charge): string {
  const pi = charge.payment_intent;
  if (typeof pi === "string" && pi) return pi;
  if (pi && typeof pi === "object" && "id" in pi) return pi.id;
  return charge.id;
}

export async function handleChargeRefunded(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<StripeRefundEventResult> {
  const charge = event.data.object as Stripe.Charge;
  const refundCents = charge.amount_refunded ?? 0;
  if (refundCents <= 0) {
    return { ok: true, skipped: true, reason: "No refunded amount on charge." };
  }

  return applyStripeEarningReversal(supabase, {
    paymentRef: paymentRefFromCharge(charge),
    type: "refund",
    refundCents,
    originalCollectedCents: charge.amount,
    externalRef: event.id,
    reason: `Stripe charge.refunded (${charge.id})`,
  });
}

export async function handleDisputeClosed(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<StripeRefundEventResult> {
  const dispute = event.data.object as Stripe.Dispute;
  if (dispute.status !== "lost") {
    return {
      ok: true,
      skipped: true,
      reason: `Dispute status is ${dispute.status}, not lost.`,
    };
  }

  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) {
    return { ok: false, error: "Dispute has no linked charge." };
  }

  const refundCents = dispute.amount ?? 0;
  if (refundCents <= 0) {
    return { ok: true, skipped: true, reason: "Dispute amount is zero." };
  }

  return applyStripeEarningReversal(supabase, {
    paymentRef: chargeId,
    type: "chargeback",
    refundCents,
    externalRef: event.id,
    reason: `Stripe charge.dispute.closed lost (${dispute.id})`,
  });
}

export async function handleStripeCollectionEvent(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<StripeCollectionEventResult> {
  if (event.type === "charge.succeeded") {
    return handleChargeSucceeded(supabase, event);
  }
  if (event.type === "charge.refunded") {
    return handleChargeRefunded(supabase, event);
  }
  if (event.type === "charge.dispute.closed") {
    return handleDisputeClosed(supabase, event);
  }
  return { ok: true, skipped: true, reason: `Unhandled event type: ${event.type}` };
}

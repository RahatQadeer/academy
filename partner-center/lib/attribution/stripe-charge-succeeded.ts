import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { recordOpportunityPayment } from "@/partner-center/lib/attribution/record-opportunity-payment";
import { resolveOpportunityForPayment } from "@/partner-center/lib/attribution/resolve-opportunity-for-payment";

export type StripeChargeSucceededResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  eventId?: string;
  earningId?: string;
  opportunityId?: string;
};

function paymentRefFromCharge(charge: Stripe.Charge): string {
  const pi = charge.payment_intent;
  if (typeof pi === "string" && pi) return pi;
  if (pi && typeof pi === "object" && "id" in pi) return pi.id;
  return charge.id;
}

function billingEmailFromCharge(charge: Stripe.Charge): string | null {
  return charge.billing_details?.email?.trim().toLowerCase() ?? null;
}

function opportunityIdFromMetadata(charge: Stripe.Charge): string | null {
  const raw =
    charge.metadata?.partner_opportunity_id ??
    charge.metadata?.partnerOpportunityId ??
    null;
  return raw?.trim() || null;
}

export async function handleChargeSucceeded(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<StripeChargeSucceededResult> {
  const charge = event.data.object as Stripe.Charge;
  const amountCollectedCents = charge.amount ?? 0;
  if (amountCollectedCents <= 0) {
    return {
      ok: true,
      skipped: true,
      reason: "Charge amount is zero.",
    };
  }

  const eventTime = new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const resolved = await resolveOpportunityForPayment(supabase, {
    opportunityId: opportunityIdFromMetadata(charge),
    billingEmail: billingEmailFromCharge(charge),
    eventTime,
  });

  if (!resolved) {
    return {
      ok: true,
      skipped: true,
      reason: "No eligible opportunity matched for this payment.",
    };
  }

  const result = await recordOpportunityPayment(supabase, {
    opportunityId: resolved.opportunityId,
    externalPaymentId: paymentRefFromCharge(charge),
    amountCollectedCents,
    eventSource: "stripe",
    eventTimestamp: eventTime.toISOString(),
  });

  return {
    ...result,
    opportunityId: resolved.opportunityId,
  };
}

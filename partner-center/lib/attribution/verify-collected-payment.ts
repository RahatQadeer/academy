import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dollarsToCents,
  fetchQbPayment,
} from "@/partner-center/lib/quickbooks/api";
import { getValidQuickBooksAccessToken } from "@/partner-center/lib/quickbooks/credentials";
import {
  getStripe,
  stripeConfigured,
  stripeErrorMessage,
} from "@/partner-center/lib/stripe";

export type VerifiedCollectedPayment = {
  externalPaymentId: string;
  amountCollectedCents: number;
  eventTimestamp: string;
};

export type VerifyCollectedPaymentResult =
  | { ok: true; payment: VerifiedCollectedPayment }
  | { ok: false; error: string };

function qbPaymentTimestamp(input: {
  TxnDate?: string;
  MetaData?: { CreateTime?: string };
}): string {
  if (input.TxnDate) {
    const parsed = Date.parse(`${input.TxnDate}T12:00:00.000Z`);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  if (input.MetaData?.CreateTime) {
    const parsed = Date.parse(input.MetaData.CreateTime);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

async function verifyStripePayment(
  rawId: string,
): Promise<VerifyCollectedPaymentResult> {
  if (!stripeConfigured()) {
    return { ok: false, error: "Stripe is not configured." };
  }

  const trimmed = rawId.trim();
  if (!trimmed.startsWith("pi_") && !trimmed.startsWith("ch_")) {
    return {
      ok: false,
      error: "Stripe payment id must be a PaymentIntent (pi_…) or Charge (ch_…).",
    };
  }

  try {
    const stripe = getStripe();

    if (trimmed.startsWith("pi_")) {
      const pi = await stripe.paymentIntents.retrieve(trimmed);
      const amountCollectedCents = pi.amount_received || pi.amount || 0;
      if (pi.status !== "succeeded" || amountCollectedCents <= 0) {
        return {
          ok: false,
          error: "Stripe PaymentIntent is not a collected (succeeded) payment.",
        };
      }
      return {
        ok: true,
        payment: {
          externalPaymentId: pi.id,
          amountCollectedCents,
          eventTimestamp: new Date(pi.created * 1000).toISOString(),
        },
      };
    }

    const charge = await stripe.charges.retrieve(trimmed);
    if (!charge.paid || (charge.amount ?? 0) <= 0) {
      return {
        ok: false,
        error: "Stripe Charge is not a collected (paid) payment.",
      };
    }

    const pi = charge.payment_intent;
    const externalPaymentId =
      typeof pi === "string" && pi
        ? pi
        : pi && typeof pi === "object" && "id" in pi
          ? pi.id
          : charge.id;

    return {
      ok: true,
      payment: {
        externalPaymentId,
        amountCollectedCents: charge.amount,
        eventTimestamp: new Date(charge.created * 1000).toISOString(),
      },
    };
  } catch (caught) {
    return {
      ok: false,
      error: stripeErrorMessage(
        caught,
        "Could not load that Stripe payment. Check the id and try again.",
      ),
    };
  }
}

async function verifyQuickBooksPayment(
  supabase: SupabaseClient,
  rawId: string,
): Promise<VerifyCollectedPaymentResult> {
  const trimmed = rawId.trim();
  if (!trimmed) {
    return { ok: false, error: "QuickBooks payment id is required." };
  }

  const paymentId = trimmed.startsWith("qbo_payment_")
    ? trimmed.slice("qbo_payment_".length)
    : trimmed;

  if (!paymentId) {
    return { ok: false, error: "QuickBooks payment id is required." };
  }

  const auth = await getValidQuickBooksAccessToken(supabase);
  if (!auth) {
    return {
      ok: false,
      error: "QuickBooks is not connected or tokens could not be refreshed.",
    };
  }

  const paymentResult = await fetchQbPayment(
    auth.accessToken,
    auth.realmId,
    paymentId,
  );
  if (paymentResult.error || !paymentResult.payment) {
    return {
      ok: false,
      error: paymentResult.error ?? "Could not load QuickBooks payment.",
    };
  }

  const payment = paymentResult.payment;
  const amountCollectedCents = dollarsToCents(payment.TotalAmt);
  if (amountCollectedCents <= 0) {
    return {
      ok: false,
      error: "QuickBooks payment has no collected amount.",
    };
  }

  return {
    ok: true,
    payment: {
      externalPaymentId: `qbo_payment_${payment.Id}`,
      amountCollectedCents,
      eventTimestamp: qbPaymentTimestamp(payment),
    },
  };
}

/** Look up a real Stripe or QuickBooks collection before manual attribution. */
export async function verifyCollectedPayment(
  supabase: SupabaseClient,
  input: {
    eventSource: "stripe" | "quickbooks";
    paymentId: string;
  },
): Promise<VerifyCollectedPaymentResult> {
  const paymentId = input.paymentId.trim();
  if (!paymentId) {
    return {
      ok: false,
      error:
        input.eventSource === "quickbooks"
          ? "QuickBooks payment id is required."
          : "Stripe payment id is required.",
    };
  }

  if (input.eventSource === "quickbooks") {
    return verifyQuickBooksPayment(supabase, paymentId);
  }
  return verifyStripePayment(paymentId);
}

import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getStripe,
  getStripeWebhookSecret,
  isStripeWebhookConfigured,
} from "@/academy/lib/stripe/server";
import {
  attachStripePaymentIntent,
  fulfillCheckoutByStripeSessionId,
} from "@/academy/enrollment/services/fulfillCheckoutById";

export const runtime = "nodejs";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (session.metadata?.academy_kind === "credential_renewal") {
    const { fulfillRenewalPaymentByStripeSessionId } = await import(
      "@/academy/credentials/services/startRenewalPayment"
    );
    const result = await fulfillRenewalPaymentByStripeSessionId(session.id);
    if (!result.ok && result.reason !== "not_found") {
      console.error("[academy checkout webhook] renewal fulfill failed", result.reason, session.id);
    }
    return;
  }

  const checkoutId = session.metadata?.academy_checkout_id ?? session.client_reference_id ?? null;
  if (checkoutId) {
    await attachStripePaymentIntent(checkoutId, paymentIntentId);
  }

  const result = await fulfillCheckoutByStripeSessionId(session.id);
  if (!result.ok && result.reason !== "not_found") {
    console.error("[academy checkout webhook] fulfill failed", result.reason, session.id);
  }
}

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
    return NextResponse.json({ ok: false, message: "Stripe webhook secret is not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, message: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe signature.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }
  } catch (error) {
    console.error("[academy checkout webhook] handler error", error);
    return NextResponse.json({ ok: false, message: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

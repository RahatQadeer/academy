import { NextResponse } from "next/server";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/base/lib/supabase/admin";
import { handleStripeCollectionEvent } from "@/partner-center/lib/attribution/stripe-refund-events";
import { getStripe, stripeConfigured } from "@/partner-center/lib/stripe";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function collectionsWebhookSecret(): string | null {
  return (
    process.env.STRIPE_COLLECTIONS_WEBHOOK_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    null
  );
}

async function claimEvent(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<"claimed" | "duplicate" | { error: string }> {
  const { error } = await supabase.from("partner_stripe_webhook_events").insert({
    id: eventId,
  });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  return { error: error.message };
}

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 },
    );
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Supabase admin is not configured." },
      { status: 503 },
    );
  }

  const secret = collectionsWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "STRIPE_COLLECTIONS_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET is not set.",
      },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (
    event.type !== "charge.succeeded" &&
    event.type !== "charge.refunded" &&
    event.type !== "charge.dispute.closed"
  ) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const supabase = createAdminClient();
  const claim = await claimEvent(supabase, event.id);
  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (typeof claim === "object") {
    return NextResponse.json({ error: claim.error }, { status: 500 });
  }

  try {
    const result = await handleStripeCollectionEvent(supabase, event);
    if (!result.ok && !result.skipped) {
      await supabase
        .from("partner_stripe_webhook_events")
        .delete()
        .eq("id", event.id);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ received: true, result });
  } catch (caught) {
    await supabase
      .from("partner_stripe_webhook_events")
      .delete()
      .eq("id", event.id);
    const message =
      caught instanceof Error ? caught.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

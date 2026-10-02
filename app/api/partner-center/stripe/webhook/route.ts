import { NextResponse } from "next/server";
import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/base/lib/supabase/admin";
import { getStripe, stripeConfigured } from "@/partner-center/lib/stripe";
import { syncPartnerStripeByAccountId } from "@/partner-center/lib/stripe-connect";
import { handleTransferReversed } from "@/partner-center/lib/payouts";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set." },
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

  const supabase = createAdminClient();
  const claim = await claimEvent(supabase, event.id);
  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (typeof claim === "object") {
    return NextResponse.json({ error: claim.error }, { status: 500 });
  }

  try {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const result = await syncPartnerStripeByAccountId({
        supabase,
        accountId: account.id,
      });
      if (result.error) {
        await supabase
          .from("partner_stripe_webhook_events")
          .delete()
          .eq("id", event.id);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
    } else if (event.type === "account.application.deauthorized") {
      const accountId =
        typeof event.account === "string" ? event.account : null;
      if (accountId) {
        const result = await syncPartnerStripeByAccountId({
          supabase,
          accountId,
          deauthorized: true,
        });
        if (result.error) {
          await supabase
            .from("partner_stripe_webhook_events")
            .delete()
            .eq("id", event.id);
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
      }
    } else if (
      event.type === "transfer.reversed" ||
      event.type === "transfer.updated"
    ) {
      const transfer = event.data.object as Stripe.Transfer;
      if (transfer.reversed) {
        await handleTransferReversed(supabase, transfer);
      }
    }
  } catch (caught) {
    // Allow Stripe to retry: remove claim so the next delivery can reprocess.
    await supabase
      .from("partner_stripe_webhook_events")
      .delete()
      .eq("id", event.id);
    const message =
      caught instanceof Error ? caught.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

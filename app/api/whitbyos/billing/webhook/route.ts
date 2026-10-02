import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/base/lib/supabase/service";
import {
  getStripe,
  stripeConfigured,
  webhookConfigured,
  webhookSecrets,
} from "@/whitbyos/lib/stripe/server";
import { applySubscription, attachCustomer } from "@/whitbyos/lib/stripe/subscription";
import { markInvoicePaidFromSession } from "@/whitbyos/lib/stripe/invoice-payment";
import { reportAiUsageInBackground } from "@/whitbyos/lib/ai/usage";
import {
  notifyPartnerPlatformInvoicePaid,
  notifyPartnerPlatformSubscriptionActivated,
  notifyPartnerPlatformTrialStarted,
} from "@/whitbyos/lib/stripe/notifyPartnerAttribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whitby's billing webhook.
 *
 * Its own endpoint and its own secret, not Academy's and not Partner's: they
 * share a Stripe account but nothing else, and one endpoint guessing which
 * product an event belongs to is how the wrong subscription gets cancelled.
 *
 * Every event is recorded before it is acted on, keyed on Stripe's own id.
 * Stripe retries until it is acknowledged and can deliver the same event
 * twice, so a redelivery collides on the primary key and returns without
 * doing the work again.
 */

/** The events the Dashboard is subscribed to, and what each one means here. */
const HANDLED = new Set([
  "checkout.session.completed",
  // A client paying an invoice by a method that settles later. Checkout
  // completes immediately and the money arrives afterwards, so the invoice is
  // marked paid here rather than on completion.
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function POST(request: Request) {
  if (!stripeConfigured() || !webhookConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Whitby billing is not configured on this deployment." },
      { status: 501 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, message: "Missing Stripe signature." }, { status: 400 });
  }

  // The raw body, before anything parses it: the signature is over the bytes.
  const payload = await request.text();

  // Against each configured secret in turn. Two endpoints in the dashboard can
  // point at this one URL — the plan subscriptions one and the client-portal
  // invoice one — and an event is signed by whichever of them sent it.
  let event: Stripe.Event | null = null;
  let refused = "Signature check failed.";
  for (const secret of webhookSecrets()) {
    try {
      event = getStripe().webhooks.constructEvent(payload, signature, secret);
      break;
    } catch (caught) {
      refused = caught instanceof Error ? caught.message : refused;
    }
  }

  if (!event) {
    return NextResponse.json({ ok: false, message: refused }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    // 500 rather than 200: Stripe should retry a failure that is ours.
    return NextResponse.json({ ok: false, message: "Server credentials missing." }, { status: 500 });
  }

  // Claim the event. A duplicate delivery loses this race and stops here.
  const { error: claimError } = await supabase
    .from("whitbyos_billing_events")
    .insert({ id: event.id, type: event.type, payload: event.data.object as never });

  if (claimError) {
    // 23505 is the primary key: this event has been seen, which is a success.
    if (claimError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ ok: false, message: claimError.message }, { status: 500 });
  }

  if (!HANDLED.has(event.type)) {
    await supabase
      .from("whitbyos_billing_events")
      .update({ handled_at: new Date().toISOString() })
      .eq("id", event.id);
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  let outcome: { ok: boolean; error?: string; workspaceId?: string } = { ok: true };

  try {
    switch (event.type) {
      // Two different things arrive as a completed checkout, and the metadata
      // is what tells them apart: a professional buying a plan (mode
      // "subscription", carrying a workspace) and a client paying an invoice
      // (mode "payment", carrying an invoice). Handing an invoice payment to
      // `attachCustomer` would write the payer's Stripe customer onto the
      // workspace and overwrite the professional's own.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        outcome = session.metadata?.invoice_id
          ? await markInvoicePaidFromSession(session)
          : await attachCustomer(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        outcome = await applySubscription(subscription);
        if (
          event.type === "customer.subscription.created" ||
          event.type === "customer.subscription.updated"
        ) {
          if (subscription.status === "trialing") {
            await notifyPartnerPlatformTrialStarted(supabase, subscription);
          }
          // End-trial / first paid period: Convert even if invoice.paid was missed.
          if (subscription.status === "active") {
            await notifyPartnerPlatformSubscriptionActivated(
              supabase,
              subscription,
            );
          }
        }
        break;
      }

      // An invoice does not change the plan; the subscription event beside it
      // does. What it changes is whether the account is in good standing, and
      // Stripe already says that through subscription.status, so these are
      // recorded and left alone.
      case "invoice.paid": {
        await notifyPartnerPlatformInvoicePaid(
          supabase,
          event.data.object as Stripe.Invoice,
        );

        // A second chance for AI usage that failed to report while it was
        // being generated. Usage is offered to Stripe as it happens; this
        // catches a workspace whose last attempt errored and which has not
        // generated anything since, so a pending report is not left waiting
        // on the next time somebody happens to use Whitby.
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

        if (customerId) {
          const { data: owner } = await supabase
            .from("workspaces")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (owner?.id) reportAiUsageInBackground(owner.id as string);
        }

        outcome = { ok: true };
        break;
      }
      case "invoice.payment_failed":
        outcome = { ok: true };
        break;
    }
  } catch (caught) {
    outcome = { ok: false, error: caught instanceof Error ? caught.message : "Handler failed." };
  }

  await supabase
    .from("whitbyos_billing_events")
    .update({
      handled_at: outcome.ok ? new Date().toISOString() : null,
      workspace_id: outcome.workspaceId ?? null,
      error: outcome.ok ? null : (outcome.error ?? "Unknown failure."),
    })
    .eq("id", event.id);

  if (!outcome.ok) {
    // Left unhandled and reported as a failure, so Stripe retries and the row
    // carries the reason rather than the event being quietly lost.
    return NextResponse.json({ ok: false, message: outcome.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

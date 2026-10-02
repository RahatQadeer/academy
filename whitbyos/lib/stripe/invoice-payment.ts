import "server-only";
import type Stripe from "stripe";
import { createClient } from "@/base/lib/supabase/server";
import { createServiceClient } from "@/base/lib/supabase/service";
import { siteUrl } from "@/base/auth/site";
import { getStripe, stripeConfigured } from "@/whitbyos/lib/stripe/server";

/**
 * Paying an invoice — SRS 13.10.2 and 17.7.9.
 *
 * 059 gave an invoice `paid_at` and `paid_note`, both written by hand by the
 * professional recording a wire or a cheque. This is the other way it can
 * arrive: the client presses Pay in the portal, Stripe collects, and the
 * webhook writes the same two columns. One invoice, one paid state, two ways
 * of reaching it — which is why nothing here invents a status of its own.
 *
 * WHOSE STRIPE ACCOUNT THIS IS.
 * The platform's. A workspace has a `stripe_customer_id` because it *buys*
 * Whitby; it has no Connect account, so there is nowhere else for a client's
 * payment to land today. 17.7.9 already treats Stripe as the collection source
 * of truth for the platform, so this is consistent rather than a new model —
 * but it does mean the money reaches Right Tail and not the professional
 * directly, and settling that is a business decision, not a code change.
 *
 * CARD DETAILS NEVER REACH WHITBY. Checkout is hosted by Stripe; this only
 * ever holds an id.
 */

/** Statuses PostgREST would have hidden anyway, said again so the reason is ours. */
export type InvoicePaymentOutcome =
  | { ok: true; url: string }
  | { ok: false; error: string };

const PORTAL_BILLING = "/client-portal/billing";

/**
 * Send a client to Stripe for one invoice.
 *
 * Read with the caller's own client, so the `_client` policy from 059 — this
 * person's own account, and sent invoices only — decides what can be paid.
 * The service role is never used on this path: it would read an invoice the
 * caller has no right to and turn a permission check into a payment page.
 */
export async function startInvoicePayment(
  invoiceId: string,
  payerEmail: string | null,
): Promise<InvoicePaymentOutcome> {
  if (!stripeConfigured()) {
    return { ok: false, error: "Card payment is not set up on this deployment yet." };
  }

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("whitbyos_invoices")
    .select(
      "id, number, description, amount_cents, currency, sent_at, paid_at, client_id, workspace_id, stripe_session_id",
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!invoice) return { ok: false, error: "That invoice is not one you can pay." };

  // Each of these is also true of what the policy would return, but a client
  // reading "not one you can pay" for an invoice they can see on the same
  // screen is worse than being told which of the three it is.
  if (!invoice.sent_at) return { ok: false, error: "That invoice has not been issued yet." };
  if (invoice.paid_at) return { ok: false, error: "That invoice is already paid." };

  const amount = Number(invoice.amount_cents ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "That invoice has nothing to pay." };
  }

  const origin = siteUrl();
  const number = String(invoice.number);
  const stripe = getStripe();

  // A session this invoice already has, if it is still payable. Somebody who
  // opens Stripe, thinks better of it and comes back an hour later gets the
  // page they left rather than a second one — and the invoice does not collect
  // a trail of abandoned sessions, only one of which the dashboard would show
  // against it.
  const existing = invoice.stripe_session_id as string | null;
  if (existing) {
    try {
      const found = await stripe.checkout.sessions.retrieve(existing);
      if (found.status === "open" && found.url) return { ok: true, url: found.url };
    } catch {
      // Expired and swept, or from another account after a key change. Falls
      // through and makes a new one, which is the right answer either way.
    }
  }

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              // Stripe wants the currency in lower case; the column holds it
              // the way an invoice prints it.
              currency: String(invoice.currency ?? "USD").toLowerCase(),
              unit_amount: amount,
              product_data: {
                name: `Invoice ${number}`,
                // The description is what the invoice is for, and it is the
                // only line the payer sees on Stripe's page.
                ...(invoice.description ? { description: String(invoice.description) } : {}),
              },
            },
          },
        ],
        // Prefilled, not asked for: the receipt should reach the person who
        // paid, and they are already signed in.
        ...(payerEmail ? { customer_email: payerEmail } : {}),
        // What the webhook matches on. `client_reference_id` as well, because
        // it is visible in the Stripe dashboard's own session list.
        client_reference_id: String(invoice.id),
        metadata: {
          invoice_id: String(invoice.id),
          invoice_number: number,
          client_id: String(invoice.client_id),
          workspace_id: String(invoice.workspace_id),
        },
        payment_intent_data: {
          description: `Invoice ${number}`,
          metadata: {
            invoice_id: String(invoice.id),
            invoice_number: number,
            workspace_id: String(invoice.workspace_id),
          },
        },
        // Through a route rather than straight back to the screen: the client
        // must not land on an invoice still marked due because the webhook is
        // a second behind, or because this deployment has no public URL for
        // Stripe to reach. `{CHECKOUT_SESSION_ID}` is Stripe's own template.
        success_url: `${origin}/api/whitbyos/billing/invoice-return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${PORTAL_BILLING}?toast=${encodeURIComponent(
          `Payment cancelled. ${number} has not been charged.`,
        )}`,
      },
      // Double-click protection only. Bucketed by the hour rather than pinned
      // to the invoice forever: a key Stripe remembers for 24 hours would keep
      // handing back a session long after it stopped being payable, and the
      // reuse check above is what handles the deliberate second attempt.
      {
        idempotencyKey: `invoice-${invoice.id}-${new Date().toISOString().slice(0, 13)}`,
      },
    );

    if (!session.url) return { ok: false, error: "Stripe returned no payment page." };

    // Recorded before the client is sent anywhere, so a payment can be traced
    // back to its invoice even if they close the tab on Stripe's page.
    await supabase
      .from("whitbyos_invoices")
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", invoice.id);

    return { ok: true, url: session.url };
  } catch (caught) {
    return {
      ok: false,
      error: caught instanceof Error ? caught.message : "Stripe refused the payment.",
    };
  }
}

/**
 * The webhook's half: Stripe says it collected, so the invoice is paid.
 *
 * Guarded on `paid_at is null` in the UPDATE itself rather than by reading
 * first and writing after. Two deliveries of the same payment arriving at once
 * would both pass a read-then-write check and the second would overwrite the
 * first's timestamp; as one conditional statement, the second matches no row.
 *
 * An unpaid session is not a failure. Checkout can complete with a payment
 * that is still processing — some methods settle later — and the invoice stays
 * unpaid until `checkout.session.async_payment_succeeded` says otherwise.
 */
export async function markInvoicePaidFromSession(
  session: Stripe.Checkout.Session,
): Promise<{ ok: boolean; error?: string; workspaceId?: string }> {
  const invoiceId = session.metadata?.invoice_id ?? null;
  if (!invoiceId) return { ok: true };

  const workspaceId = session.metadata?.workspace_id ?? undefined;

  if (session.payment_status !== "paid") {
    // Nothing to record yet, and nothing wrong either.
    return { ok: true, workspaceId };
  }

  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "Server credentials are missing." };

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const { error } = await supabase
    .from("whitbyos_invoices")
    .update({
      paid_at: new Date().toISOString(),
      // The same column the professional writes by hand, saying how it
      // arrived. "Stripe" is the word 17.7.9 uses for this lineage.
      paid_note: "Paid by card through Stripe",
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .is("paid_at", null);

  if (error) return { ok: false, error: error.message };

  return { ok: true, workspaceId };
}

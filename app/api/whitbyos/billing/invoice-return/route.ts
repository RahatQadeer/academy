import { NextResponse } from "next/server";
import { getStripe, stripeConfigured } from "@/whitbyos/lib/stripe/server";
import { markInvoicePaidFromSession } from "@/whitbyos/lib/stripe/invoice-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BILLING = "/client-portal/billing";

/**
 * Where Stripe sends a client back to after paying an invoice.
 *
 * The webhook is the authority — it is the only thing that hears about a
 * payment the client never came back from, or one that settles hours later.
 * This exists because a redirect is what the *person* experiences: they press
 * Pay, they pay, and they must not land on a screen still saying the invoice
 * is due because a webhook is a second behind, or because this deployment has
 * no public URL for Stripe to reach at all.
 *
 * So it asks Stripe directly what happened to their session and records it.
 * Marking paid is one conditional UPDATE guarded on `paid_at is null`, so
 * whichever of the two arrives second changes nothing — there is no race to
 * lose and no double-write to reconcile.
 *
 * Nothing here trusts the query string beyond the session id: what the invoice
 * is, and whether it was actually paid, both come from the session Stripe
 * hands back, never from the URL.
 */
export async function GET(request: Request) {
  const back = (message: string) =>
    NextResponse.redirect(
      new URL(`${BILLING}?toast=${encodeURIComponent(message)}`, request.url),
    );

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !stripeConfigured()) {
    return NextResponse.redirect(new URL(BILLING, request.url));
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const number = session.metadata?.invoice_number ?? "";

    if (session.payment_status !== "paid") {
      return back(
        number
          ? `Payment for ${number} has not completed. Nothing has been charged.`
          : "That payment has not completed. Nothing has been charged.",
      );
    }

    const recorded = await markInvoicePaidFromSession(session);
    if (!recorded.ok) {
      // The money is Stripe's to confirm and it says it took it, so the client
      // is told the truth about their payment. The webhook retries the write.
      return back(
        `Payment received${number ? ` for ${number}` : ""}. It may take a moment to show as paid.`,
      );
    }

    return back(`Payment received${number ? ` for ${number}` : ""}. Thank you.`);
  } catch {
    return back("We could not confirm that payment. Check with your team before paying again.");
  }
}

"use server";

import { redirect } from "next/navigation";
import { startInvoicePayment } from "@/whitbyos/lib/stripe/invoice-payment";
import { requireWrite, toastUrl } from "./guard";

const BILLING_PATH = "/client-portal/billing";

/**
 * Pay an invoice — SRS 13.10.2's "applicable payment actions".
 *
 * This used to refuse on the grounds that there was no invoice table and no
 * payment adapter. Both have since landed: `whitbyos_invoices` in whitbyos/059,
 * and Stripe Checkout behind `startInvoicePayment`. Nothing is forked to get
 * here — the client pays the professional's own invoice row, and the webhook
 * writes the same `paid_at` the professional writes by hand.
 *
 * A write, not a read, so a view-only member is stopped. Seeing what is owed
 * and spending money against it are not the same permission, and `requireWrite`
 * is where that distinction already lives.
 */
export async function payInvoice(formData: FormData) {
  const invoiceId = formData.get("invoiceId");
  const path =
    typeof invoiceId === "string" && invoiceId
      ? `${BILLING_PATH}?invoice=${invoiceId}`
      : BILLING_PATH;

  const guard = await requireWrite("billing");
  if ("reason" in guard) redirect(toastUrl(path, guard.reason));

  if (typeof invoiceId !== "string" || !invoiceId) {
    redirect(toastUrl(BILLING_PATH, "There was no invoice to pay."));
  }

  const outcome = await startInvoicePayment(invoiceId, guard.ctx.email ?? null);

  if (!outcome.ok) redirect(toastUrl(path, outcome.error));

  // Off-origin, so this leaves the app rather than routing within it.
  redirect(outcome.url);
}

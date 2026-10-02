import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import { atNoon } from "@/whitbyos/lib/invoices";
import { invoiceStage } from "@/whitbyos/lib/invoice-vocab";
import type { BillingSummary, InvoiceStatus, PortalInvoice } from "@/client-portal/types";

/**
 * Invoices are real now.
 *
 * This module used to say there was no invoice table anywhere in the shared
 * schema, which was true: billing was fixtures behind an honest banner, waiting
 * on either a `whitbyos_invoices` table or a QuickBooks adapter. The table
 * landed in `whitbyos/migrations/059`, so these two functions read it, which is
 * exactly the change this file always said would be the only one needed.
 *
 * The stage a client sees — paid, overdue, due, scheduled — is derived by
 * `invoiceStage`, the same function the professional's screens call, so the two
 * sides cannot come to disagree about what an invoice is. `whitbyos_invoices`
 * stores the facts it is derived from and no status column beside them.
 *
 * Composing and editing an invoice still happens on the professional side (SRS
 * 13.10.3), so this module only reads. What the client can now do is pay one:
 * `payInvoice` opens Stripe Checkout, and `paid_at` comes back through the
 * webhook — the same column the professional writes when a wire arrives.
 */

const COLUMNS =
  "id, number, description, amount_cents, currency, issued_at, due_at, sent_at, paid_at, request:whitbyos_requests!request_id (title)";

const NOTHING: BillingSummary = {
  outstandingCents: 0,
  paidThisYearCents: 0,
  nextDueAt: null,
  currency: "USD",
};

/**
 * The rows this login is allowed to see, or null when it is not allowed any.
 *
 * Two gates, deliberately. `permissions.billing` is checked here as well as by
 * the route, because a member without Billing must not reach an invoice through
 * any path — and the `_client` RLS policy, which scopes to this person's own
 * accounts and to sent invoices only, is the floor rather than the whole story.
 */
async function readInvoices(): Promise<{
  rows: Record<string, unknown>[];
  demo: boolean;
} | null> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return { rows: [], demo: true };
  if (!ctx.areas.billing) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_invoices")
    .select(COLUMNS)
    .eq("client_id", ctx.clientId)
    // A draft is unreachable under the client policy anyway. Said again here so
    // the screen does not depend on a policy staying the way it is.
    .not("sent_at", "is", null)
    .order("issued_at", { ascending: false });

  return { rows: (data ?? []) as unknown as Record<string, unknown>[], demo: false };
}

function toPortalInvoice(row: Record<string, unknown>): PortalInvoice {
  const request = Array.isArray(row.request) ? row.request[0] : row.request;

  return {
    id: row.id as string,
    number: row.number as string,
    description: (row.description as string | null) ?? null,
    amountCents: Number(row.amount_cents ?? 0),
    // `invoiceStage` also has "draft", which this can never be: nothing without
    // a `sent_at` reaches a client.
    status: invoiceStage({
      sentAt: (row.sent_at as string | null) ?? null,
      paidAt: (row.paid_at as string | null) ?? null,
      issuedAt: row.issued_at as string,
      dueAt: row.due_at as string,
    }) as InvoiceStatus,
    issuedAt: atNoon(row.issued_at as string),
    dueAt: atNoon(row.due_at as string),
    paidAt: (row.paid_at as string | null) ?? null,
    requestTitle: (request as { title?: string } | null)?.title ?? null,
  };
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const read = await readInvoices();
  if (!read) return NOTHING;
  if (read.demo) return fixtures.BILLING_SUMMARY;

  const invoices = read.rows.map(toPortalInvoice);
  const unpaid = invoices.filter(
    (invoice) => invoice.status === "due" || invoice.status === "overdue",
  );

  const year = new Date().getUTCFullYear();

  // The soonest thing actually owed. A scheduled invoice is not yet owed, and a
  // date already past is not "next", so both are out of this.
  const nextDueAt = unpaid
    .map((invoice) => invoice.dueAt)
    .filter((due) => new Date(due).getTime() >= Date.now())
    .sort()[0] ?? null;

  return {
    outstandingCents: unpaid.reduce((sum, invoice) => sum + invoice.amountCents, 0),
    paidThisYearCents: invoices
      .filter(
        (invoice) =>
          invoice.paidAt && new Date(invoice.paidAt).getUTCFullYear() === year,
      )
      .reduce((sum, invoice) => sum + invoice.amountCents, 0),
    nextDueAt,
    // The account's own currency, taken from its invoices rather than assumed.
    currency: (read.rows[0]?.currency as string) ?? "USD",
  };
}

/*
 * Cached for the length of one request.
 *
 * Home composes Recent Activity from every area's reader while Action Needed
 * composes from three of the same ones, so an uncached read meant the same
 * rows fetched twice on one render. `cache()` is per-request, which is exactly
 * the lifetime wanted: within a render everybody sees one answer, and the next
 * request reads the table again.
 */
export const listInvoices = cache(async (): Promise<PortalInvoice[]> => {
  const read = await readInvoices();
  if (!read) return [];
  if (read.demo) return fixtures.INVOICES;

  return read.rows.map(toPortalInvoice);
});

/** True when the schema can actually back this screen. Drives the honest banner. */
export const BILLING_HAS_LIVE_SOURCE = true;

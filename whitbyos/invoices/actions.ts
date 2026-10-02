"use server";

import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import type { DialogResult } from "@/whitbyos/components/DialogForm";
import { readOnlyDialogResult } from "@/whitbyos/lib/read-only";
import { notifyClientContacts } from "@/whitbyos/lib/notify";

const LIST = "/whitbyos/settings/invoices";

/** Where to land after acting on an invoice, keeping the screen you were on. */
function backTo(formData: FormData): string {
  const back = String(formData.get("back") ?? "").trim();
  return back.startsWith("/whitbyos/") ? back : LIST;
}

/**
 * The client this invoice is for, checked against the current workspace.
 *
 * A client id arriving on a form is a client id somebody typed. The `_staff`
 * policy would stop a write to another workspace anyway, but it would stop it
 * as a database error rather than a sentence, and the caller can say something
 * useful only if it asks first.
 */
async function clientInWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  clientId: string,
) {
  const { data } = await supabase
    .from("whitbyos_clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data;
}

type ParsedLine = { description: string; quantity: number; unitAmountCents: number };

/**
 * The lines off the compose form.
 *
 * The three fields arrive as parallel arrays, so they are read by index rather
 * than zipped by name. A row with no description is a blank the professional
 * left behind and is dropped; a row with a description and no amount is kept,
 * because a zero-rate line is a legitimate thing to put on an invoice.
 *
 * Money is parsed from what a person types — "1,250.00", "$1,250" — into whole
 * cents. Never a float in the database, and never a float in the arithmetic
 * either: the string is split at the point rather than multiplied by 100, which
 * is where 19.99 becomes 1998.9999999999998.
 */
function readLines(formData: FormData): { lines: ParsedLine[]; error: string | null } {
  const descriptions = formData.getAll("line_description").map(String);
  const quantities = formData.getAll("line_quantity").map(String);
  const rates = formData.getAll("line_rate").map(String);

  const lines: ParsedLine[] = [];

  for (let i = 0; i < descriptions.length; i += 1) {
    const description = descriptions[i]?.trim() ?? "";
    if (!description) continue;

    const quantity = Number(quantities[i] ?? "1");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { lines: [], error: `"${description}" needs a quantity above zero.` };
    }

    const cents = toCents(rates[i] ?? "");
    if (cents === null) {
      return { lines: [], error: `"${description}" needs a rate, as a number.` };
    }

    lines.push({ description, quantity, unitAmountCents: cents });
  }

  if (lines.length === 0) {
    return { lines: [], error: "An invoice needs at least one line." };
  }

  return { lines, error: null };
}

/** "1,250.5" → 125050. Null when it is not a number at all. */
function toCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

async function writeLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
  lines: ParsedLine[],
) {
  // Replaced wholesale rather than diffed. Only a draft can be edited, so
  // nothing downstream is holding a reference to a line id, and a diff would
  // be more code for an invariant nothing depends on.
  await supabase.from("whitbyos_invoice_lines").delete().eq("invoice_id", invoiceId);

  return supabase.from("whitbyos_invoice_lines").insert(
    lines.map((line, position) => ({
      invoice_id: invoiceId,
      position,
      description: line.description,
      quantity: line.quantity,
      unit_amount_cents: line.unitAmountCents,
    })),
  );
}

/**
 * Compose an invoice. It is a draft, and a draft is invisible to the client:
 * `sent_at` is null, and the client-side policy tests exactly that.
 *
 * The number comes from `whitbyos_next_invoice_number()`, which claims it with
 * an upsert rather than counting existing rows, so two invoices raised in the
 * same instant get two numbers.
 */
export async function createInvoice(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const clientId = String(formData.get("client_id") ?? "").trim();
  const back = backTo(formData);

  if (!clientId) return { ok: false, error: "Choose which client this is for." };

  const dueAt = String(formData.get("due_at") ?? "").trim();
  if (!dueAt) return { ok: false, error: "An invoice needs a due date." };

  const issuedAt = String(formData.get("issued_at") ?? "").trim();
  if (issuedAt && dueAt < issuedAt) {
    return { ok: false, error: "The due date cannot be before the invoice date." };
  }

  const { lines, error: lineError } = readLines(formData);
  if (lineError) return { ok: false, error: lineError };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true, to: "/login" };

  const client = await clientInWorkspace(supabase, workspaceId, clientId);
  if (!client) return { ok: false, error: "That client is not in this workspace." };

  const { data: number, error: numberError } = await supabase.rpc(
    "whitbyos_next_invoice_number",
    { p_workspace_id: workspaceId },
  );

  if (numberError || !number) {
    return { ok: false, error: numberError?.message ?? "Could not allocate a number." };
  }

  const requestId = String(formData.get("request_id") ?? "").trim();

  const { data: invoice, error } = await supabase
    .from("whitbyos_invoices")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      request_id: requestId || null,
      number,
      description: String(formData.get("description") ?? "").trim() || null,
      currency: String(formData.get("currency") ?? "USD").trim() || "USD",
      ...(issuedAt ? { issued_at: issuedAt } : {}),
      due_at: dueAt,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !invoice) {
    return { ok: false, error: error?.message ?? "Could not create the invoice." };
  }

  const written = await writeLines(supabase, invoice.id as string, lines);
  if (written.error) {
    // The invoice would otherwise sit there with a number, no lines and a total
    // of zero, which is worse than never having been created.
    await supabase.from("whitbyos_invoices").delete().eq("id", invoice.id);
    return { ok: false, error: written.error.message };
  }

  return { ok: true, to: `${back}?drafted=${encodeURIComponent(String(number))}` };
}

/** Edit a draft. Refused once sent: an invoice the client has is a record. */
export async function updateInvoice(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  const back = backTo(formData);
  if (!invoiceId) return { ok: false, error: "Nothing to edit." };

  const dueAt = String(formData.get("due_at") ?? "").trim();
  if (!dueAt) return { ok: false, error: "An invoice needs a due date." };

  const issuedAt = String(formData.get("issued_at") ?? "").trim();
  if (issuedAt && dueAt < issuedAt) {
    return { ok: false, error: "The due date cannot be before the invoice date." };
  }

  const { lines, error: lineError } = readLines(formData);
  if (lineError) return { ok: false, error: lineError };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("whitbyos_invoices")
    .select("id, number, sent_at")
    .eq("id", invoiceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "That invoice is not in this workspace." };
  if (existing.sent_at) {
    return {
      ok: false,
      error: "This invoice has been sent, so it can no longer be changed.",
    };
  }

  const requestId = String(formData.get("request_id") ?? "").trim();

  const { error } = await supabase
    .from("whitbyos_invoices")
    .update({
      request_id: requestId || null,
      description: String(formData.get("description") ?? "").trim() || null,
      currency: String(formData.get("currency") ?? "USD").trim() || "USD",
      ...(issuedAt ? { issued_at: issuedAt } : {}),
      due_at: dueAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (error) return { ok: false, error: error.message };

  const written = await writeLines(supabase, invoiceId, lines);
  if (written.error) return { ok: false, error: written.error.message };

  return { ok: true, to: `${back}?saved=${encodeURIComponent(String(existing.number))}` };
}

/**
 * Send it. This is the act that makes an invoice visible to the client, and it
 * is deliberately its own action with its own confirmation rather than a flag
 * on the compose form.
 *
 * Idempotent on `sent_at`: pressing Send twice does not re-send, re-notify or
 * move the date the client was asked on.
 */
export async function sendInvoice(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  const back = backTo(formData);
  if (!invoiceId) return { ok: false, error: "Nothing to send." };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("whitbyos_invoices")
    .select("id, number, client_id, amount_cents, sent_at")
    .eq("id", invoiceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!invoice) return { ok: false, error: "That invoice is not in this workspace." };
  if (invoice.sent_at) {
    return { ok: false, error: "This invoice has already been sent." };
  }

  const { count } = await supabase
    .from("whitbyos_invoice_lines")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId);

  if (!count) {
    return { ok: false, error: "This invoice has no lines, so there is nothing to send." };
  }

  const sentAt = new Date().toISOString();

  const { error } = await supabase
    .from("whitbyos_invoices")
    .update({ sent_at: sentAt, updated_at: sentAt })
    .eq("id", invoiceId)
    // Refuses a second send that arrived while the first was in flight.
    .is("sent_at", null);

  if (error) return { ok: false, error: error.message };

  const told = await notifyClient({
    workspaceId,
    clientId: invoice.client_id as string,
    invoiceId,
    number: invoice.number as string,
  });

  if (told > 0) {
    await supabase
      .from("whitbyos_invoices")
      .update({ notified_at: sentAt })
      .eq("id", invoiceId);
  }

  const query = new URLSearchParams({ sent: String(invoice.number), told: String(told) });
  return { ok: true, to: `${back}?${query.toString()}` };
}

/**
 * Tell the people on the account, if they asked to be told.
 *
 * `client_portal_notification_prefs` is the portal's own table and
 * `invoice_payment_event` is one of the nine events it already offers, so
 * nothing new is invented here. Rows in it are sparse and an absent row means
 * on, which is the rule the portal's own reader follows.
 *
 * What this does NOT do is send an email. There is no transactional mail path
 * anywhere in this repo — the only outbound mail is Supabase's auth links — so
 * the notice is written to `whitbyos_notifications`, addressed to the contact,
 * which that table has carried a column and a portal-readable policy for since
 * whitbyos/052, and which the portal's bell now reads. Returns how many people
 * were told.
 *
 * It goes through `notifyClientContacts` rather than reading the preferences
 * itself. Read from this session they always came back empty — the table is
 * readable only by the contact it belongs to — so a client who had switched
 * invoices off was told anyway. The shared helper also keeps this notice to the
 * people granted Billing, as every other portal notice is kept to its area.
 */
async function notifyClient(input: {
  workspaceId: string;
  clientId: string;
  invoiceId: string;
  number: string;
}): Promise<number> {
  return notifyClientContacts({
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    event: "invoice_payment_event",
    area: "billing",
    kind: "invoice_sent",
    title: `Invoice ${input.number}`,
    body: "A new invoice is on your Billing screen.",
    href: "/client-portal/billing",
    entityType: "invoice",
    entityId: input.invoiceId,
  });
}

/**
 * Record that it was paid. Not a charge: nothing here takes money. This is the
 * professional writing down what arrived by wire, cheque or cash, which is
 * what makes `paid` and `paidAt` real on both sides.
 *
 * The other way an invoice becomes paid is the client paying by card in the
 * portal, which lands in the same two columns through
 * `markInvoicePaidFromSession`. Both refuse an invoice that is already paid,
 * so whichever happens first is the one that stands.
 */
export async function markInvoicePaid(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  const back = backTo(formData);
  if (!invoiceId) return { ok: false, error: "Nothing to record." };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("whitbyos_invoices")
    .select("id, number, sent_at, paid_at")
    .eq("id", invoiceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!invoice) return { ok: false, error: "That invoice is not in this workspace." };
  if (!invoice.sent_at) {
    return { ok: false, error: "This invoice has not been sent yet." };
  }
  if (invoice.paid_at) {
    return { ok: false, error: "This invoice is already marked paid." };
  }

  // A date, not an instant: payment is recorded on the day it landed, which is
  // often not the day somebody got round to writing it down.
  const day = String(formData.get("paid_on") ?? "").trim();
  const paidAt = day ? `${day}T12:00:00.000Z` : new Date().toISOString();

  if (Number.isNaN(new Date(paidAt).getTime())) {
    return { ok: false, error: "That is not a date." };
  }

  const { error } = await supabase
    .from("whitbyos_invoices")
    .update({
      paid_at: paidAt,
      paid_note: String(formData.get("paid_note") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (error) return { ok: false, error: error.message };

  // `paid_ok` rather than `paid`: `?paid=<id>` is what opens this dialog, and
  // answering it with `?paid=<number>` would reopen it on a number that is not
  // an id.
  return { ok: true, to: `${back}?paid_ok=${encodeURIComponent(String(invoice.number))}` };
}

/** A draft nobody sent. Refused once sent, where the record has to stand. */
export async function deleteDraftInvoice(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  const back = backTo(formData);
  if (!invoiceId) return { ok: false, error: "Nothing to delete." };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("whitbyos_invoices")
    .select("id, number, sent_at")
    .eq("id", invoiceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!invoice) return { ok: false, error: "That invoice is not in this workspace." };
  if (invoice.sent_at) {
    return {
      ok: false,
      error: "This invoice has been sent, so it stays on the record.",
    };
  }

  const { error } = await supabase.from("whitbyos_invoices").delete().eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };

  return { ok: true, to: `${back}?deleted=${encodeURIComponent(String(invoice.number))}` };
}

import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { invoiceStage, type InvoiceStage } from "@/whitbyos/lib/invoice-vocab";

export type InvoiceLine = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
};

export type InvoiceRow = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  requestId: string | null;
  requestTitle: string | null;
  description: string | null;
  amountCents: number;
  currency: string;
  /** `date` columns, "YYYY-MM-DD". */
  issuedAt: string;
  dueAt: string;
  sentAt: string | null;
  paidAt: string | null;
  paidNote: string | null;
  notifiedAt: string | null;
  stage: InvoiceStage;
};

export type InvoiceDetail = InvoiceRow & { lines: InvoiceLine[] };

const COLUMNS =
  "id, number, client_id, request_id, description, amount_cents, currency, issued_at, due_at, sent_at, paid_at, paid_note, notified_at";

/**
 * A `date` column, handed to a renderer that will apply a timezone to it.
 *
 * "2026-09-07" parses as UTC midnight, and midnight UTC is the day before in
 * every zone west of London — the portal renders these in the professional's
 * zone, so a due date would arrive a day early. Noon has no such edge in any
 * zone the product supports, which is why the portal's own fixtures set an hour
 * rather than leaving one.
 */
export function atNoon(date: string | null): string {
  return date ? `${date}T12:00:00.000Z` : "";
}

export function invoiceDates(row: InvoiceRow) {
  return { issuedAt: atNoon(row.issuedAt), dueAt: atNoon(row.dueAt) };
}

function toInvoice(
  row: Record<string, unknown>,
  clientNames: Map<string, string>,
  requestTitles: Map<string, string>,
): InvoiceRow {
  const facts = {
    sentAt: (row.sent_at as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    issuedAt: row.issued_at as string,
    dueAt: row.due_at as string,
  };

  return {
    id: row.id as string,
    number: row.number as string,
    clientId: row.client_id as string,
    clientName: clientNames.get(row.client_id as string) ?? "No client",
    requestId: (row.request_id as string | null) ?? null,
    requestTitle: row.request_id
      ? requestTitles.get(row.request_id as string) ?? null
      : null,
    description: (row.description as string | null) ?? null,
    amountCents: Number(row.amount_cents ?? 0),
    currency: (row.currency as string) ?? "USD",
    ...facts,
    paidNote: (row.paid_note as string | null) ?? null,
    notifiedAt: (row.notified_at as string | null) ?? null,
    stage: invoiceStage(facts),
  };
}

/** The names an invoice list needs, resolved once rather than per row. */
async function labels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
) {
  const [{ data: clients }, { data: requests }] = await Promise.all([
    supabase.from("whitbyos_clients").select("id, name").eq("workspace_id", workspaceId),
    supabase.from("whitbyos_requests").select("id, title").eq("workspace_id", workspaceId),
  ]);

  return {
    clientNames: new Map((clients ?? []).map((r) => [r.id as string, r.name as string])),
    requestTitles: new Map((requests ?? []).map((r) => [r.id as string, r.title as string])),
  };
}

/**
 * Every invoice in this workspace, newest first, optionally one client's.
 *
 * Scoped by `workspace_id` in the query as well as by the `_staff` policy. The
 * policy is what makes it safe; the filter is what makes it right, and a screen
 * that leans only on RLS breaks silently the day someone adds a second policy.
 */
export async function listInvoices(clientId?: string): Promise<InvoiceRow[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  let query = supabase
    .from("whitbyos_invoices")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (clientId) query = query.eq("client_id", clientId);

  const { data } = await query;
  if (!data || data.length === 0) return [];

  const { clientNames, requestTitles } = await labels(supabase, workspaceId);
  return data.map((row) =>
    toInvoice(row as unknown as Record<string, unknown>, clientNames, requestTitles),
  );
}

/** One invoice with what it is for. Null when it is not this workspace's. */
export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("whitbyos_invoices")
    .select(COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) return null;

  const [{ clientNames, requestTitles }, { data: lines }] = await Promise.all([
    labels(supabase, workspaceId),
    supabase
      .from("whitbyos_invoice_lines")
      .select("id, position, description, quantity, unit_amount_cents, amount_cents")
      .eq("invoice_id", id)
      .order("position", { ascending: true }),
  ]);

  return {
    ...toInvoice(data as unknown as Record<string, unknown>, clientNames, requestTitles),
    lines: (lines ?? []).map((line) => ({
      id: line.id as string,
      position: Number(line.position ?? 0),
      description: line.description as string,
      quantity: Number(line.quantity ?? 0),
      unitAmountCents: Number(line.unit_amount_cents ?? 0),
      amountCents: Number(line.amount_cents ?? 0),
    })),
  };
}

/** Outstanding and paid-this-year, for the head of a list. */
export function invoiceTotals(rows: InvoiceRow[], now: Date = new Date()) {
  const year = now.getUTCFullYear();

  return {
    // Drafts are excluded: nobody has been asked for this money yet, so
    // counting it as outstanding would overstate what is owed.
    outstandingCents: rows
      .filter((row) => row.stage === "due" || row.stage === "overdue")
      .reduce((sum, row) => sum + row.amountCents, 0),
    paidThisYearCents: rows
      .filter((row) => row.paidAt && new Date(row.paidAt).getUTCFullYear() === year)
      .reduce((sum, row) => sum + row.amountCents, 0),
    overdueCount: rows.filter((row) => row.stage === "overdue").length,
    draftCount: rows.filter((row) => row.stage === "draft").length,
  };
}

/**
 * Who would be told if this invoice were sent, by name.
 *
 * The same rule the send action applies, read ahead of time so the confirmation
 * can say who rather than "the client". Portal access is the first condition —
 * someone with no way in cannot be notified — and the stored preference is the
 * second, with an absent row meaning on, which is how the portal's own reader
 * treats it.
 */
export async function invoiceRecipients(clientId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("whitbyos_client_members")
    .select("contact_id, portal_access")
    .eq("client_id", clientId);

  const contacts = (members ?? [])
    .filter((row) => row.portal_access)
    .map((row) => row.contact_id as string);

  if (contacts.length === 0) return [];

  const [{ data: prefs }, { data: people }] = await Promise.all([
    supabase
      .from("client_portal_notification_prefs")
      .select("contact_id, enabled")
      .in("contact_id", contacts)
      .eq("event_type", "invoice_payment_event")
      .eq("channel", "email"),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, preferred_name")
      .in("id", contacts),
  ]);

  const off = new Set(
    (prefs ?? [])
      .filter((row) => row.enabled === false)
      .map((row) => row.contact_id as string),
  );

  return (people ?? [])
    .filter((person) => !off.has(person.id as string))
    .map(
      (person) =>
        (person.preferred_name as string) ||
        [person.first_name, person.last_name].filter(Boolean).join(" ") ||
        "someone on the account",
    );
}

export type ClientBilling = {
  count: number;
  currency: string;
  outstandingCents: number;
  paidThisYearCents: number;
  overdueCount: number;
  draftCount: number;
};

/**
 * One client's billing, small enough for the Account section on Overview.
 *
 * That section used to print a warning saying billing was not connected and
 * that invoices would appear "once an accounting integration is set up". None
 * of that had been true since migration 059: invoices are a table in this
 * schema, the Billing tab raises and sends them, and 067 wired Stripe to
 * collect them. The notice was written before any of it existed and outlived
 * all of it, telling professionals with sent and paid invoices that they had
 * no billing.
 *
 * The same rows the Billing tab reads, summed by the same function, so the two
 * cannot disagree about what is owed.
 */
export async function clientBillingSummary(clientId: string): Promise<ClientBilling> {
  const rows = await listInvoices(clientId);
  const totals = invoiceTotals(rows);

  return {
    count: rows.length,
    currency: rows[0]?.currency ?? "USD",
    ...totals,
  };
}

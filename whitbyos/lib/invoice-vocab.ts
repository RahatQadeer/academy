/**
 * What an invoice is, in words, with no server imports — the compose dialog is
 * rendered from the client and the portal reads the derivation too.
 *
 * THE STAGE IS DERIVED, NEVER STORED.
 * `whitbyos_invoices` holds facts: when it was sent, when it was paid, the day
 * it is dated and the day it is due. A `status` column beside those would be
 * the same information written a second time and free to drift from it, and it
 * is the drift that bills someone twice. So the five words below are worked out
 * from the facts, in this one function, wherever they are needed.
 *
 * The Client Portal's `InvoiceStatus` is these five minus `draft`: a draft has
 * never been sent, and the client-side RLS policy cannot return one, so the
 * client's four are what is left after the gate.
 */
export type InvoiceStage = "draft" | "scheduled" | "due" | "overdue" | "paid";

export type InvoiceFacts = {
  sentAt: string | null;
  paidAt: string | null;
  /** `date` columns, "YYYY-MM-DD". */
  issuedAt: string;
  dueAt: string;
};

/** Today in UTC as "YYYY-MM-DD", to compare against two `date` columns. */
function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function invoiceStage(facts: InvoiceFacts, now: Date = new Date()): InvoiceStage {
  if (!facts.sentAt) return "draft";
  if (facts.paidAt) return "paid";

  const day = today(now);

  // Dated for a day that has not arrived: composed and sent ahead of the period
  // it bills for. The client sees it coming rather than being asked to pay it.
  if (facts.issuedAt > day) return "scheduled";

  // Compared date to date, not instant to instant: an invoice due today is due,
  // not overdue, in whatever zone the person reading it happens to be in.
  if (facts.dueAt < day) return "overdue";

  return "due";
}

export const STAGE_LABEL: Record<InvoiceStage, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  due: "Due",
  overdue: "Overdue",
  paid: "Paid",
};

/** Tones from `Pill`. Overdue is the only one that is actually wrong. */
export const STAGE_TONE: Record<InvoiceStage, "neutral" | "info" | "warning" | "danger" | "success"> = {
  draft: "neutral",
  scheduled: "info",
  due: "warning",
  overdue: "danger",
  paid: "success",
};

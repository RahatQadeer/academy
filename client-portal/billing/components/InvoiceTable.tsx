import { money, shortDate } from "@/client-portal/lib/format";
import { INVOICE_STATUS } from "@/client-portal/lib/status";
import { payInvoice } from "@/client-portal/lib/actions/billing";
import {
  DataTable,
  DataTableCell,
  DataTableFixed,
  DataTableRow,
  type Column,
} from "@/client-portal/components/DataTable";
import { StatusPill } from "@/client-portal/components/StatusPill";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import type { PortalInvoice } from "@/client-portal/types";

/**
 * Columns rather than a meta line.
 *
 * An invoice is the one row in the portal that is mostly numbers and dates, and
 * it was rendered as a sentence: "Issued 4 Mar · Due 18 Mar · Estate purchase",
 * joined with dots under the invoice number. Amounts were right-aligned and
 * nothing else was, so the one column that lined up was the one column a client
 * cannot scan against a date. Money and dates want columns.
 */
const COLUMNS: Column[] = [
  { label: "Invoice", width: "2.2fr" },
  { label: "Request", width: "1.4fr" },
  { label: "Issued", width: "110px" },
  { label: "Due", width: "110px" },
  { label: "Amount", width: "120px" },
  { label: "Status", width: "130px" },
  { label: "", width: "110px" },
];

export function InvoiceTable({
  invoices,
  currency,
  timeZone = "UTC",
}: {
  invoices: PortalInvoice[];
  currency: string;
  /** The professional's zone — see `PortalContext.timezone`. */
  timeZone?: string;
}) {
  return (
    <DataTable columns={COLUMNS} rowPadding={13} minWidth={940}>
      {invoices.map((invoice) => (
        <DataTableRow key={invoice.id}>
          <span className="min-w-0 pr-3">
            <span className="block truncate font-medium">{invoice.number}</span>
            {invoice.description ? (
              <span
                className="block truncate text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {invoice.description}
              </span>
            ) : null}
          </span>

          <DataTableCell emphasis="soft">{invoice.requestTitle ?? "—"}</DataTableCell>

          <DataTableCell emphasis="muted">
            {shortDate(invoice.issuedAt, new Date(), timeZone)}
          </DataTableCell>

          {/* Paid replaces Due rather than sitting beside it: once it is paid,
              when it was due is no longer the fact anybody is looking for. */}
          <DataTableCell emphasis={invoice.paidAt ? "muted" : "default"}>
            {invoice.paidAt
              ? `Paid ${shortDate(invoice.paidAt, new Date(), timeZone)}`
              : shortDate(invoice.dueAt, new Date(), timeZone)}
          </DataTableCell>

          <DataTableFixed align="end">
            <span className="font-semibold tabular-nums">
              {money(invoice.amountCents, currency)}
            </span>
          </DataTableFixed>

          <DataTableFixed>
            <StatusPill status={INVOICE_STATUS[invoice.status]} />
          </DataTableFixed>

          <DataTableFixed align="end">
            {invoice.status === "paid" ? (
              // PortalInvoice has no downloadable-file reference (no fileUrl /
              // pdfUrl / receiptUrl) — Figma shows a "Download" link here, but
              // wiring a real one needs that field added to the data model
              // first. Nothing renders rather than faking a link.
              null
            ) : (
              <form action={payInvoice}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <SubmitButton size="row" pendingLabel="Opening…">Pay now</SubmitButton>
              </form>
            )}
          </DataTableFixed>
        </DataTableRow>
      ))}
    </DataTable>
  );
}

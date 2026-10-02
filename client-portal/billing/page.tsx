import { getPortalContext } from "@/client-portal/lib/portal-context";
import { getBillingSummary, listInvoices } from "@/client-portal/lib/data/billing";
import { money, shortDate } from "@/client-portal/lib/format";
import { PageBody } from "@/client-portal/components/PageHeader";
import { BillingDataNotice } from "@/client-portal/components/DataNotice";
import { KpiCard, KpiRow } from "@/client-portal/components/Kpi";
import { EmptyState } from "@/client-portal/components/States";
import { InvoiceTable } from "./components/InvoiceTable";

/**
 * Invoices, and what is outstanding across them.
 *
 * There was a second tab, Payment Status, and it did not earn one. It showed
 * the same invoices with the paid ones filtered out — which the Status column
 * already says — above a "Payment method" card that has never had a payment
 * method to show, because no such table exists in the schema. The one thing
 * only it offered was a Pay now for the next invoice due, and every unpaid row
 * in the table carries its own.
 */
export default async function BillingScreen() {
  const [context, summary, invoices] = await Promise.all([
    getPortalContext(),
    getBillingSummary(),
    listInvoices(),
  ]);

  return (
    <PageBody>
      {/* No line under the title here: "Your invoices, amounts, due dates, and
          payment status" described the four tiles immediately below it, which
          are labelled. */}
      <BillingDataNotice />

      <KpiRow wide>
        <KpiCard
          label="Outstanding"
          value={money(summary.outstandingCents, summary.currency)}
          detail={
            summary.nextDueAt
              ? `Next due ${shortDate(summary.nextDueAt, new Date(), context.timezone)}`
              : undefined
          }
          tone={summary.outstandingCents > 0 ? "danger" : "ink"}
        />
        <KpiCard
          label="Paid this year"
          value={money(summary.paidThisYearCents, summary.currency)}
          tone="success"
        />
        <KpiCard
          label="Open invoices"
          value={String(invoices.filter((invoice) => invoice.status !== "paid").length)}
        />
      </KpiRow>

      {invoices.length === 0 ? (
        <EmptyState
          glyph="£"
          title="No invoices yet"
          body="Invoices issued by your team will appear here with their payment status."
        />
      ) : (
        <InvoiceTable
          invoices={invoices}
          currency={summary.currency}
          timeZone={context.timezone}
        />
      )}
    </PageBody>
  );
}

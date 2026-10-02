import { Button } from "@/base/components/Button";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { InvoiceTable } from "@/whitbyos/invoices/components/InvoiceTable";
import { invoiceTotals, type InvoiceRow } from "@/whitbyos/lib/invoices";
import { money } from "@/whitbyos/lib/format";

function softBorder() {
  return "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)";
}

/**
 * This client's invoices, on the client they belong to.
 *
 * The workspace-wide list answers "what is owed"; this answers "what has this
 * one client been billed", which is the question being asked while you are
 * already looking at them. Same table, same dialogs, no client column.
 */
export function BillingTab({
  clientId,
  clientName,
  invoices,
}: {
  clientId: string;
  clientName: string;
  invoices: InvoiceRow[];
}) {
  const base = `/whitbyos/clients/${clientId}/billing`;
  const totals = invoiceTotals(invoices);
  const currency = invoices[0]?.currency ?? "USD";

  if (invoices.length === 0) {
    return (
      <div
        className="rounded-[12px] border px-6 py-8"
        style={{ borderColor: softBorder(), background: "var(--surface)" }}
      >
        <StateMessage
          glyph="▤"
          title={`No invoices for ${clientName} yet`}
          description="A new invoice saves as a draft. Nobody on this account sees it until you send it."
          action={
            <Button unsized href={`${base}?new=1`} variant="primary" className="px-5 py-2.5 text-[13.5px]">
              New invoice
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold tracking-[-0.15px]">Invoices</span>
          <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            What this client has been billed, newest first.
          </span>
        </span>
        <Button unsized href={`${base}?new=1`} variant="primary" className="px-4 py-2 text-[13.5px]">
          New invoice
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Outstanding"
          value={money(totals.outstandingCents, currency)}
          note={
            totals.overdueCount > 0
              ? `${totals.overdueCount} overdue`
              : "Nothing overdue"
          }
          accent={totals.outstandingCents > 0}
        />
        <SummaryCard
          label="Drafts"
          value={String(totals.draftCount)}
          note={
            totals.draftCount > 0
              ? `Not sent yet`
              : "None waiting"
          }
        />
        <SummaryCard
          label="Invoices"
          value={String(invoices.length)}
          note={`${invoices.filter((row) => row.stage === "paid").length} paid`}
        />
      </div>

      <div
        className="overflow-hidden rounded-[12px] border"
        style={{
          borderColor: softBorder(),
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04)",
        }}
      >
        <InvoiceTable invoices={invoices} base={base} withClient={false} pageSize={5} />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-[12px] border px-4 py-3.5"
      style={{
        borderColor: softBorder(),
        background: accent
          ? "linear-gradient(135deg, color-mix(in srgb, var(--accent-tint) 70%, var(--surface)) 0%, var(--surface) 80%)"
          : "var(--surface)",
        boxShadow: "0 1px 2px rgba(31,72,125,.04)",
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[.04em]"
        style={{ color: "var(--text-quiet)" }}
      >
        {label}
      </div>
      <div className="mt-1 text-[18px] font-bold tracking-[-0.3px] tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
        {note}
      </div>
    </div>
  );
}

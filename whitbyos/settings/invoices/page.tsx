import { Button } from "@/base/components/Button";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { InvoiceTable } from "@/whitbyos/invoices/components/InvoiceTable";
import {
  InvoiceDialogHost,
  type InvoiceParams,
} from "@/whitbyos/invoices/components/InvoiceDialogHost";
import { listInvoices, invoiceTotals } from "@/whitbyos/lib/invoices";
import { STAGE_LABEL } from "@/whitbyos/lib/invoice-vocab";
import { matchesSearch } from "@/whitbyos/lib/search";
import { money } from "@/whitbyos/lib/format";
import { redirect } from "next/navigation";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

const BASE = "/whitbyos/settings/invoices";

/**
 * Workspace invoices, under Settings rather than on the main rail.
 *
 * Same list, dialogs and actions as before — this screen is where they live,
 * not a second copy of them. Billing & Plan next to it is the Stripe
 * subscription; this tab is what the firm raises against clients.
 */
export default async function InvoiceSettingsPage({
  searchParams,
}: {
  searchParams?: InvoiceParams;
}) {
  if (!(await usesClientWorkspaces())) redirect("/whitbyos/settings/workspace");
  /* Inside one client's workspace this listed every invoice in the firm —
     other clients' numbers, their descriptions and their amounts — and
     `listInvoices` had taken a client id all along; this screen was the one
     caller that never passed it. */
  const invoices = await listInvoices((await getOpenClientId()) || undefined);
  const q = (Array.isArray(searchParams?.q) ? searchParams?.q[0] : searchParams?.q)?.trim() ?? "";
  const shown = invoices.filter((invoice) =>
    matchesSearch(q, [
      invoice.number,
      invoice.description,
      invoice.clientName,
      invoice.requestTitle,
      STAGE_LABEL[invoice.stage],
    ]),
  );
  const totals = invoiceTotals(invoices);

  // Every invoice in one workspace is usually one currency, but nothing forces
  // that, so the summary says which one it is totalling rather than implying
  // that a mixed list adds up.
  const currencies = [...new Set(invoices.map((invoice) => invoice.currency))];
  const currency = currencies[0] ?? "USD";

  return (
    <SettingsShell
      active="invoices"
      title="Client invoices"
      width={null}
      action={
        invoices.length > 0 ? (
          <Button unsized href={`${BASE}?new=1`} variant="primary" className="px-4 py-[9px] text-[13.5px]">
            New invoice
          </Button>
        ) : undefined
      }
    >
      {invoices.length === 0 ? (
        <StateMessage
          glyph="▤"
          title="No invoices yet"
          description="Compose one against a client. It stays a draft, invisible to them, until you send it."
          action={
            <Button unsized href={`${BASE}?new=1`} variant="primary" className="px-5 py-2.5 text-[13.5px]">
              New invoice
            </Button>
          }
        />
      ) : (
        <>
          {/*
           * One band with rules between, rather than three cards with gaps.
           *
           * They are three readings of the same ledger — what is owed, what
           * came in, what has not been sent — and three bordered boxes made
           * them look like three unrelated figures, the same way Workspace
           * Overview's did before it.
           */}
          <div
            className="mb-6 grid overflow-hidden rounded-[12px] border sm:grid-cols-3"
            style={{ borderColor: "var(--chrome-line)", background: "var(--surface)" }}
          >
            <Summary
              label="Outstanding"
              value={money(totals.outstandingCents, currency)}
              detail={
                totals.overdueCount > 0
                  ? `${totals.overdueCount} overdue`
                  : "Nothing overdue"
              }
              tone={totals.overdueCount > 0 ? "danger" : undefined}
            />
            <Summary
              label={`Paid in ${new Date().getUTCFullYear()}`}
              value={money(totals.paidThisYearCents, currency)}
            />
            <Summary
              label="Drafts"
              value={String(totals.draftCount)}
              detail={totals.draftCount > 0 ? "Not sent to anyone yet" : "None waiting"}
            />
          </div>

          {currencies.length > 1 ? (
            <p className="mb-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Totals shown in {currency}. This list also holds invoices in{" "}
              {currencies.filter((code) => code !== currency).join(", ")}, which are
              not added in.
            </p>
          ) : null}

          <FilterBar
            action={BASE}
            searchPlaceholder="Search invoices…"
            searchValue={q}
          />

          {shown.length === 0 ? (
            <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Nothing matches “{q}”.
            </p>
          ) : (
            <InvoiceTable invoices={shown} base={BASE} />
          )}
        </>
      )}

      <InvoiceDialogHost searchParams={searchParams} base={BASE} />
    </SettingsShell>
  );
}

/**
 * The three figures that used to sit on the top-level Invoices screen.
 *
 * Kept local because they are still only drawn here, and a shared component
 * would have to grow a currency, a detail line and a tone to serve one caller.
 */
function Summary({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "danger";
}) {
  return (
    <div className="border-l border-line px-[22px] py-[18px] first:border-l-0">
      <div
        className="text-[26px] font-bold leading-none tabular-nums"
        style={{ color: tone === "danger" ? "var(--danger-fg)" : "var(--ink)" }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-soft)" }}>
        {label}
      </div>
      {detail ? (
        <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

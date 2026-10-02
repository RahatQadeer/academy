import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { STAGE_LABEL, STAGE_TONE } from "@/whitbyos/lib/invoice-vocab";
import { money, shortDate } from "@/whitbyos/lib/format";
import type { InvoiceRow } from "@/whitbyos/lib/invoices";

/**
 * The invoice list, shared by Settings → Invoices and the client's Billing tab.
 *
 * `withClient` is the only difference between the two: inside one client, a
 * column repeating that client's name on every row says nothing.
 *
 * The number opens the invoice. Drafts go to compose; sent invoices open to
 * read. Each row still carries the one next step — send, record payment, or
 * the paid date — so that action is not buried behind the open.
 */
export function InvoiceTable({
  invoices,
  base,
  withClient = true,
  pageSize = 8,
}: {
  invoices: InvoiceRow[];
  /** The screen these links come back to, so a dialog closes where it opened. */
  base: string;
  withClient?: boolean;
  /** First screenful before Show more. */
  pageSize?: number;
}) {
  const columns: Column[] = [
    // Wide enough for a number and the description under it: at 2.2fr with
    // both on one line, every description arrived as "Ci Cd Tok…".
    { label: "Invoice", width: "2.6fr" },
    ...(withClient ? [{ label: "Client", width: "1.3fr" }] : []),
    { label: "Issued", width: "0.8fr" },
    { label: "Due", width: "0.8fr" },
    { label: "Amount", width: "1fr" },
    { label: "Status", width: "0.9fr" },
    // Named, because it holds a control rather than a fact — and wide enough
    // that "Record payment" is one line rather than two.
    { label: "Next step", width: "1.5fr" },
  ];

  const link = (id: string, action: string) => `${base}?${action}=${id}`;

  return (
    <DataTable columns={columns} rowPadding={13}>
      <ShowMore step={pageSize}>
        {invoices.map((invoice) => (
          <DataTableRow key={invoice.id}>
            <DataTableCell emphasis="ink">
              {/*
               * The number, and the description under it.
               *
               * They shared one line with a middle dot between them, and the
               * description is the half that gets cut — so every row read
               * "INV-0003 · Ci Cd Tok…", which names the invoice twice and the
               * work not at all.
               */}
              <Link
                href={link(invoice.id, invoice.stage === "draft" ? "edit" : "view")}
                className="block font-medium no-underline"
                style={{ color: "var(--ink)" }}
              >
                {invoice.number}
              </Link>
              {invoice.description ? (
                <span
                  className="mt-0.5 block truncate text-[12px]"
                  style={{ color: "var(--text-tertiary)" }}
                  title={invoice.description}
                >
                  {invoice.description}
                </span>
              ) : null}
            </DataTableCell>

            {withClient ? <DataTableCell>{invoice.clientName}</DataTableCell> : null}

            <DataTableCell>{shortDate(invoice.issuedAt)}</DataTableCell>
            <DataTableCell>{shortDate(invoice.dueAt)}</DataTableCell>

            <DataTableCell emphasis="ink">
              <span className="tabular-nums">{money(invoice.amountCents, invoice.currency)}</span>
            </DataTableCell>

            <span>
              <Pill tone={STAGE_TONE[invoice.stage]}>{STAGE_LABEL[invoice.stage]}</Pill>
            </span>

            {/*
             * One control per row, and it looks like one.
             *
             * These were three underline-less links in a row of text, so the one
             * thing to do next read as more of the row's data — and "Record
             * payment" wrapped onto two lines in the space it was given.
             */}
            <span className="flex items-center justify-end gap-1.5 whitespace-nowrap">
              {invoice.stage === "draft" ? (
                <>
                  <RowLink href={link(invoice.id, "delete")} tone="quiet">
                    Delete
                  </RowLink>
                  <RowLink href={link(invoice.id, "edit")}>Edit</RowLink>
                  <RowLink href={link(invoice.id, "send")} tone="accent">
                    Send
                  </RowLink>
                </>
              ) : invoice.stage === "paid" ? (
                <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                  Paid {shortDate(invoice.paidAt)}
                </span>
              ) : (
                <RowLink href={link(invoice.id, "paid")} tone="accent">
                  Record payment
                </RowLink>
              )}
            </span>
          </DataTableRow>
        ))}
      </ShowMore>
    </DataTable>
  );
}

/**
 * A row's next step, drawn as the small control it is.
 *
 * Outlined by default, accent-filled for the one that moves the invoice on,
 * and quiet for the one that destroys a draft — a Delete that looks as
 * pressable as Send is a Delete somebody presses.
 */
function RowLink({
  href,
  children,
  tone,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "accent" | "quiet";
}) {
  const style =
    tone === "accent"
      ? {
          background: "var(--accent)",
          borderColor: "transparent",
          color: "#ffffff",
        }
      : tone === "quiet"
        ? {
            background: "transparent",
            borderColor: "transparent",
            color: "var(--text-tertiary)",
          }
        : {
            background: "var(--surface)",
            borderColor: "var(--border-strong)",
            color: "var(--ink)",
          };

  return (
    <Link
      href={href}
      className="rounded-control border px-2.5 py-[5px] text-[12px] font-medium no-underline transition-all hover:brightness-105"
      style={style}
    >
      {children}
    </Link>
  );
}

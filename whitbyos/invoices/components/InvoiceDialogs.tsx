import { CURRENCIES } from "@/whitbyos/lib/settings-vocab";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Modal } from "@/whitbyos/components/Modal";
import { DialogForm } from "@/whitbyos/components/DialogForm";
import { CONTROL, CONTROL_UNSIZED, Field } from "@/whitbyos/components/Field";
import { InvoiceLines } from "@/whitbyos/invoices/components/InvoiceLines";
import {
  createInvoice,
  updateInvoice,
  sendInvoice,
  markInvoicePaid,
  deleteDraftInvoice,
} from "@/whitbyos/invoices/actions";
import { STAGE_LABEL, STAGE_TONE } from "@/whitbyos/lib/invoice-vocab";
import { money, shortDate } from "@/whitbyos/lib/format";
import type { InvoiceDetail } from "@/whitbyos/lib/invoices";

type Option = { id: string; name: string };
type RequestOption = { id: string; title: string };

const today = () => new Date().toISOString().slice(0, 10);

/**
 * A sent invoice, opened to read rather than to rewrite.
 *
 * Drafts open in the compose dialog instead. Once the client has the record,
 * this is the professional's copy of the same facts — status, amount, client,
 * dates, number — without a save that could disagree with what they already have.
 */
export function ViewInvoiceDialog({
  invoice,
  closeHref,
}: {
  invoice: InvoiceDetail;
  closeHref: string;
}) {
  return (
    <Modal title={invoice.number} closeHref={closeHref} width={560}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            {invoice.clientName}
          </span>
          <Pill tone={STAGE_TONE[invoice.stage]}>{STAGE_LABEL[invoice.stage]}</Pill>
        </div>

        <p className="text-[22px] font-bold tabular-nums">
          {money(invoice.amountCents, invoice.currency)}
        </p>

        <div
          className="grid gap-x-8 gap-y-2 text-[13px]"
          style={{ gridTemplateColumns: "auto 1fr", color: "var(--text-secondary)" }}
        >
          <span>Issued</span>
          <span style={{ color: "var(--ink)" }}>{shortDate(invoice.issuedAt)}</span>
          <span>Due</span>
          <span>{shortDate(invoice.dueAt)}</span>
          {invoice.paidAt ? (
            <>
              <span>Paid</span>
              <span>{shortDate(invoice.paidAt)}</span>
            </>
          ) : null}
        </div>

        {invoice.description ? (
          <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
            {invoice.description}
          </p>
        ) : null}

        {invoice.lines.length > 0 ? (
          <div className="overflow-hidden rounded-[8px] border border-line">
            {invoice.lines.map((line) => (
              <div
                key={line.id}
                className="flex items-baseline justify-between gap-4 border-b border-line px-3.5 py-2.5 text-[13px] last:border-b-0"
              >
                <span>
                  {line.description}
                  {line.quantity !== 1 ? (
                    <span style={{ color: "var(--text-tertiary)" }}> × {line.quantity}</span>
                  ) : null}
                </span>
                <span className="tabular-nums" style={{ color: "var(--ink)" }}>
                  {money(line.amountCents, invoice.currency)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** Thirty days out, the default a professional would otherwise type every time. */
const inThirtyDays = () =>
  new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

/**
 * Compose an invoice, or edit one that has not been sent.
 *
 * The same dialog does both: the fields are identical, and the only difference
 * is which action reads them. An invoice that has been sent does not open here
 * at all — the client is holding it, and a record the other side already has is
 * not something to quietly rewrite.
 */
export function ComposeInvoiceDialog({
  clients,
  requests,
  invoice,
  clientId,
  closeHref,
  back,
  currency,
}: {
  /** The workspace's default, from Settings → Workspace. */
  currency: string;
  clients: Option[];
  requests: RequestOption[];
  /** The draft being edited, or nothing when this is a new invoice. */
  invoice?: InvoiceDetail | null;
  /** Fixed when composing from inside one client, so the picker is not drawn. */
  clientId?: string;
  closeHref: string;
  back: string;
}) {
  const editing = Boolean(invoice);

  return (
    <Modal
      title={editing ? `Edit ${invoice!.number}` : "New invoice"}
      closeHref={closeHref}
      width={640}
    >
      <DialogForm
        action={editing ? updateInvoice : createInvoice}
        closeHref={closeHref}
        submitLabel={editing ? "Save draft" : "Save as draft"}
        pendingLabel="Saving…"
      >
        <input type="hidden" name="back" value={back} />
        {editing ? <input type="hidden" name="invoice_id" value={invoice!.id} /> : null}

        {/* Said before anything is typed, not after Save. Whether the client can
            see this is the thing a professional most needs to be sure of. */}
        {editing ? null : (
          <Callout tone="info">
            This saves as a draft. Nobody at the client sees an invoice until you
            send it.
          </Callout>
        )}

        {clients.length === 0 ? (
          <Callout tone="warning">
            An invoice is raised against a client, and there are none yet.
          </Callout>
        ) : null}

        {clientId ? (
          <input type="hidden" name="client_id" value={clientId} />
        ) : (
          <Field label="Client" htmlFor="client_id">
            <select
              id="client_id"
              name="client_id"
              required
              defaultValue={invoice?.clientId ?? ""}
              disabled={editing}
              className={`${CONTROL} disabled:opacity-60`}
            >
              <option value="" disabled>
                Choose a client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {/* A disabled select posts nothing, and the client an invoice belongs to
            is not something an edit changes anyway. */}
        {editing ? <input type="hidden" name="client_id" value={invoice!.clientId} /> : null}

        <Field label="Description" hint="(optional, shown to the client)" htmlFor="description">
          <input
            id="description"
            name="description"
            defaultValue={invoice?.description ?? ""}
            placeholder="Coordination retainer, current period"
            className={CONTROL}
          />
        </Field>

        <Field label="Against a Request" hint="(optional)" htmlFor="request_id">
          <select
            id="request_id"
            name="request_id"
            defaultValue={invoice?.requestId ?? ""}
            className={CONTROL}
          >
            <option value="">Not tied to a Request</option>
            {requests.map((request) => (
              <option key={request.id} value={request.id}>
                {request.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Invoice date" htmlFor="issued_at">
            <input
              id="issued_at"
              type="date"
              name="issued_at"
              defaultValue={invoice?.issuedAt ?? today()}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            />
          </Field>
          <Field label="Due" htmlFor="due_at">
            <input
              id="due_at"
              type="date"
              name="due_at"
              required
              defaultValue={invoice?.dueAt ?? inThirtyDays()}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            />
          </Field>
          <Field label="Currency" htmlFor="currency">
            {/*
             * The workspace's currency, not "USD".
             *
             * Settings → Workspace has offered a default currency since the
             * beginning and nothing read it: every new invoice opened on USD
             * out of a hardcoded five, so a firm that bills in sterling set
             * the setting, saw it saved, and then picked GBP by hand on every
             * invoice it ever raised. An invoice already written keeps its
             * own, which is the one case where the default is the wrong
             * answer.
             */}
            <select
              id="currency"
              name="currency"
              defaultValue={invoice?.currency ?? currency}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <InvoiceLines
          currency={invoice?.currency ?? "USD"}
          initial={invoice?.lines.map((line) => ({
            description: line.description,
            quantity: String(line.quantity),
            rate: (line.unitAmountCents / 100).toFixed(2),
          }))}
        />
      </DialogForm>
    </Modal>
  );
}

/**
 * Sending, on its own, with what it will do written out.
 *
 * Deliberately not a checkbox on the compose form: this is the moment the
 * client can see the invoice, and it is the one step here that cannot be taken
 * back. So it asks, and it says who will be told.
 */
export function SendInvoiceDialog({
  invoice,
  recipients,
  closeHref,
  back,
}: {
  invoice: InvoiceDetail;
  /** People on the account with portal access who asked to be told. */
  recipients: string[];
  closeHref: string;
  back: string;
}) {
  return (
    <Modal title={`Send ${invoice.number}?`} closeHref={closeHref} width={480}>
      <DialogForm
        action={sendInvoice}
        closeHref={closeHref}
        submitLabel="Send invoice"
        pendingLabel="Sending…"
      >
        <input type="hidden" name="invoice_id" value={invoice.id} />
        <input type="hidden" name="back" value={back} />

        <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
          {invoice.clientName} will see this on their Billing screen straight
          away, for{" "}
          <strong style={{ color: "var(--ink)" }}>
            {money(invoice.amountCents, invoice.currency)}
          </strong>
          , due {invoice.dueAt}. It cannot be edited or deleted afterwards.
        </p>

        <div
          className="rounded-[8px] px-3.5 py-3 text-[12.5px] leading-[1.6]"
          style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
        >
          {recipients.length === 0 ? (
            "Nobody on this account has portal access, so the invoice will be waiting for them when they first sign in."
          ) : (
            <>
              Notifying {recipients.join(", ")}.
              {/* Said plainly rather than implied: there is no mail path in this
                  product yet, and a professional should not believe an email
                  went out because a dialog implied one. */}
              <span style={{ color: "var(--text-tertiary)" }}>
                {" "}
                Email is not connected yet, so this is recorded for them rather
                than sent.
              </span>
            </>
          )}
        </div>
      </DialogForm>
    </Modal>
  );
}

/** Recording what arrived. Not a charge — nothing here takes money. */
export function MarkPaidDialog({
  invoice,
  closeHref,
  back,
}: {
  invoice: InvoiceDetail;
  closeHref: string;
  back: string;
}) {
  return (
    <Modal title={`Record payment for ${invoice.number}`} closeHref={closeHref} width={460}>
      <DialogForm
        action={markInvoicePaid}
        closeHref={closeHref}
        submitLabel="Mark as paid"
        pendingLabel="Recording…"
      >
        <input type="hidden" name="invoice_id" value={invoice.id} />
        <input type="hidden" name="back" value={back} />

        <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
          {money(invoice.amountCents, invoice.currency)} from {invoice.clientName}.
          This writes down what arrived; it does not take a payment.
        </p>

        <Field label="Paid on" htmlFor="paid_on">
          <input
            id="paid_on"
            type="date"
            name="paid_on"
            defaultValue={today()}
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          />
        </Field>

        <Field label="Reference" hint="(optional, not shown to the client)" htmlFor="paid_note">
          <input
            id="paid_note"
            name="paid_note"
            placeholder="Wire, ref 88213"
            className={CONTROL}
          />
        </Field>
      </DialogForm>
    </Modal>
  );
}

/** A draft nobody has seen. Sent invoices have no delete. */
export function DeleteDraftDialog({
  invoice,
  closeHref,
  back,
}: {
  invoice: InvoiceDetail;
  closeHref: string;
  back: string;
}) {
  return (
    <Modal title={`Delete ${invoice.number}?`} closeHref={closeHref} width={440}>
      <DialogForm
        action={deleteDraftInvoice}
        closeHref={closeHref}
        submitLabel="Delete draft"
        pendingLabel="Deleting…"
      >
        <input type="hidden" name="invoice_id" value={invoice.id} />
        <input type="hidden" name="back" value={back} />

        <p className="text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
          This draft was never sent, so nobody at {invoice.clientName} has seen
          it. The number {invoice.number} is not reused.
        </p>
      </DialogForm>
    </Modal>
  );
}

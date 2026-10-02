import { Toast } from "@/whitbyos/components/Toast";
import {
  ComposeInvoiceDialog,
  DeleteDraftDialog,
  MarkPaidDialog,
  SendInvoiceDialog,
  ViewInvoiceDialog,
} from "@/whitbyos/invoices/components/InvoiceDialogs";
import { getInvoice, invoiceRecipients } from "@/whitbyos/lib/invoices";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { listRequestOptions } from "@/whitbyos/lib/tasks";
import { getWorkspaceSettings } from "@/whitbyos/lib/settings";

export type InvoiceParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Every invoice dialog and every invoice toast, in one place.
 *
 * The workspace list and a client's Billing tab open exactly the same set from
 * exactly the same query keys, so the alternative was the same forty lines
 * twice, drifting apart the first time one of them changed. `base` is where the
 * dialogs close back to, which is the only thing the two screens disagree on.
 */
export async function InvoiceDialogHost({
  searchParams,
  base,
  clientId,
}: {
  searchParams?: InvoiceParams;
  base: string;
  /** Set inside one client, so composing there does not ask which client. */
  clientId?: string;
}) {
  const composing = one(searchParams?.new) === "1";
  const editing = one(searchParams?.edit) ?? "";
  const viewing = one(searchParams?.view) ?? "";
  const sending = one(searchParams?.send) ?? "";
  const paying = one(searchParams?.paid) ?? "";
  const deleting = one(searchParams?.delete) ?? "";

  const drafted = one(searchParams?.drafted);
  const saved = one(searchParams?.saved);
  const sent = one(searchParams?.sent);
  const told = Number(one(searchParams?.told) ?? "0");
  const recorded = one(searchParams?.paid_ok);
  const deleted = one(searchParams?.deleted);

  const open = editing || viewing || sending || paying || deleting;
  const invoice = open ? await getInvoice(open) : null;

  const [clients, requests] = composing || editing
    ? await Promise.all([listClientOptions(), listRequestOptions()])
    : [[], []];

  return (
    <>
      {composing || (editing && invoice) ? (
        <ComposeInvoiceDialog
          currency={(await getWorkspaceSettings())?.currency ?? "USD"}
          clients={clients}
          requests={requests}
          invoice={editing ? invoice : null}
          clientId={editing ? undefined : clientId}
          closeHref={base}
          back={base}
        />
      ) : null}

      {viewing && invoice ? (
        <ViewInvoiceDialog invoice={invoice} closeHref={base} />
      ) : null}

      {sending && invoice ? (
        <SendInvoiceDialog
          invoice={invoice}
          recipients={await invoiceRecipients(invoice.clientId)}
          closeHref={base}
          back={base}
        />
      ) : null}

      {paying && invoice ? (
        <MarkPaidDialog invoice={invoice} closeHref={base} back={base} />
      ) : null}

      {deleting && invoice ? (
        <DeleteDraftDialog invoice={invoice} closeHref={base} back={base} />
      ) : null}

      {drafted ? (
        <Toast
          title={`${drafted} saved as a draft`}
          detail="Nobody at the client can see it. Send it when you are ready."
          closeHref={base}
        />
      ) : null}

      {saved ? (
        <Toast title={`${saved} saved`} detail="Still a draft." closeHref={base} />
      ) : null}

      {sent ? (
        <Toast
          title={`${sent} sent`}
          detail={
            told > 0
              ? `It is on the client's Billing screen. ${told} ${told === 1 ? "person was" : "people were"} notified.`
              : "It is on the client's Billing screen. Nobody was notified: either nobody has portal access, or they have turned invoice notices off."
          }
          closeHref={base}
        />
      ) : null}

      {recorded ? (
        <Toast
          title={`${recorded} marked paid`}
          detail="The client's screen shows it as paid too."
          closeHref={base}
        />
      ) : null}

      {deleted ? (
        <Toast title={`${deleted} deleted`} detail="It was never sent." closeHref={base} />
      ) : null}
    </>
  );
}

import { photoOf } from "@/whitbyos/lib/people-photos";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { portalDefaultAreas } from "@/whitbyos/lib/portal-defaults";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/whitbyos/components/BackLink";
import { createClient } from "@/base/lib/supabase/server";
import { ClientHeader } from "@/whitbyos/clients/[id]/components/ClientHeader";
import { ExportTimelineDialog } from "@/whitbyos/clients/[id]/components/ExportTimelineDialog";
import { ReviewAccessDialog } from "@/whitbyos/clients/[id]/components/ReviewAccessDialog";
import { Toast } from "@/whitbyos/components/Toast";
import { redirectIfNoClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { ArchiveOrDeleteDialog } from "@/whitbyos/components/ArchiveOrDelete";
import { archiveClient, deleteClient } from "@/whitbyos/clients/actions";
import { ClientTabs, type ClientTabSlug } from "@/whitbyos/clients/[id]/components/ClientTabs";
import { OverviewTab } from "@/whitbyos/clients/[id]/tabs/OverviewTab";
import { RequestsTab } from "@/whitbyos/clients/[id]/tabs/RequestsTab";
import { ContactsTab } from "@/whitbyos/clients/[id]/tabs/ContactsTab";
import { DocumentsTab } from "@/whitbyos/clients/[id]/tabs/DocumentsTab";
import { BillingTab } from "@/whitbyos/clients/[id]/tabs/BillingTab";
import { InvoiceDialogHost } from "@/whitbyos/invoices/components/InvoiceDialogHost";
import { clientBillingSummary, listInvoices } from "@/whitbyos/lib/invoices";
import { TimelineTab } from "@/whitbyos/clients/[id]/tabs/TimelineTab";
import {
  getClient,
  listAccessRequests,
  listClientFormAnswers,
  listClientContacts,
  listClientDocuments,
  listClientRequests,
  listClientTimeline,
  type ClientRequest,
} from "@/whitbyos/lib/client-detail";
import {
  getPortalCeiling,
  getWorkCounts,
  getOverviewStats,
  listThisWeek,
  listHistory,
  readPreferences,
  clientRequestTrend,
} from "@/whitbyos/lib/client-sections";

type ClientWithSummary = Awaited<ReturnType<typeof getClient>> & {
  current_summary?: string | null;
  next_action?: string | null;
  preferences?: unknown;
};

export default async function ClientDetailPage({
  clientId,
  tab = "",
  searchParams,
}: {
  clientId: string;
  tab?: ClientTabSlug;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await redirectIfNoClientWorkspaces();
  const client = (await getClient(clientId)) as ClientWithSummary;
  if (!client) notFound();
  const { isHiddenFirmClient } = await import("@/whitbyos/lib/client-workspace");
  if (isHiddenFirmClient(client)) redirect("/whitbyos/clients");

  // Requests are needed by every tab: the count in the tab strip, and as the
  // parent scope for tasks, documents, notes and timeline.
  const requests = await listClientRequests(clientId);
  const ownerName = await getOwnerName(client.owner_user_id);

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const base = `/whitbyos/clients/${clientId}/timeline`;
  const exporting = one(searchParams?.export) === "1";

  const reviewing = one(searchParams?.review);
  const approved = one(searchParams?.approved);
  const declined = one(searchParams?.declined) === "1";
  const emailed = one(searchParams?.sent) === "1";
  const reason = one(searchParams?.reason);
  const contactsHref = `/whitbyos/clients/${clientId}/contacts`;

  // 2.0a, opened from the client itself. `here` keeps the tab you were on, so
  // cancelling the dialog puts you back where you were rather than on Overview.
  const here = `/whitbyos/clients/${clientId}${tab ? `/${tab}` : ""}`;
  const removing = one(searchParams?.remove) === "1";

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href="/whitbyos/clients" label="Back to Clients" />
      <ClientHeader
        client={client}
        removeHref={`${here}?remove=1`}
        photo={await photoOf(client.primary_contact_id ?? null)}
      />
      <ClientTabs
        clientId={clientId}
        active={tab}
        requestCount={requests.length}
        accessWaiting={(await listAccessRequests(clientId)).length > 0}
      />
      {await renderTab({
        tab,
        clientId,
        client,
        requests,
        ownerName,
        category: one(searchParams?.kind),
        show: one(searchParams?.show),
      })}

      {removing ? (
        <ArchiveOrDeleteDialog
          title={`Archive ${client.name}?`}
          lead="This client has linked records. Choose what to remove:"
          linked={
            <>
              Linked to this client:{" "}
              <strong style={{ color: "var(--ink)" }}>{requests.length} Requests</strong>, its
              Work Plans, Documents and Contacts, and their Client Portal access.
            </>
          }
          archiveLabel="Archive this client"
          archiveDetail="Hides it from Clients and everywhere it is listed. Everything stays intact, and Settings → Archive puts it back."
          deleteDetail="Removes all Requests, Work Plans, Documents and the Contact. This can't be undone."
          archiveAction={archiveClient}
          hidden={{ client_id: client.id }}
          closeHref={here}
        />
      ) : null}

      {tab === "billing" ? (
        <InvoiceDialogHost
          searchParams={searchParams}
          base={`/whitbyos/clients/${clientId}/billing`}
          clientId={clientId}
        />
      ) : null}

      {exporting ? (
        <ExportTimelineDialog
          clientId={clientId}
          clientName={client.name}
          closeHref={base}
        />
      ) : null}

      {reviewing ? (
        <ReviewRequest
          clientId={clientId}
          requestId={reviewing}
          closeHref={contactsHref}
        />
      ) : null}

      {approved ? (
        emailed ? (
          <Toast
            title="Access approved"
            detail={`${approved} has been added to this account and invited to the portal.`}
            closeHref={contactsHref}
          />
        ) : (
          <Toast
            tone="warning"
            title="Access approved, invitation not emailed"
            detail={reason ?? `${approved} was added, but no email left.`}
            closeHref={contactsHref}
          />
        )
      ) : null}

      {declined ? (
        <Toast
          title="Request declined"
          detail="Nothing on the account changed."
          closeHref={contactsHref}
        />
      ) : null}

   </div>
  );
}

async function getOwnerName(userId: string | null) {
  if (!userId) return "Unassigned";
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("full_name, preferred_name")
    .eq("id", userId)
    .maybeSingle();

  return (
    (data?.preferred_name as string) || (data?.full_name as string) || "Unassigned"
  );
}

async function renderTab({
  tab,
  clientId,
  client,
  requests,
  ownerName,
  category,
  show,
}: {
  tab: ClientTabSlug;
  clientId: string;
  client: ClientWithSummary;
  requests: ClientRequest[];
  ownerName: string;
  /** Which category the Documents tab is filtered to, from `?kind=`. */
  category?: string;
  /** How many rows that tab has been asked for, from `?show=`. */
  show?: string;
}) {
  if (!client) return null;

  switch (tab) {
    case "requests":
      return <RequestsTab requests={requests} />;

    case "contacts":
      return (
        <ContactsTab
          contacts={await listClientContacts(clientId)}
          clientId={clientId}
          requests={await listAccessRequests(clientId)}
        />
      );

    case "documents":
      return (
        <DocumentsTab
          documents={await listClientDocuments(clientId, requests)}
          forms={await listClientFormAnswers(clientId)}
          clientId={clientId}
          category={category}
          show={show}
        />
      );

    case "billing":
      return (
        <BillingTab
          clientId={clientId}
          clientName={client.name}
          invoices={await listInvoices(clientId)}
        />
      );

    case "timeline":
      return (
        <TimelineTab
          entries={await listClientTimeline(requests)}
          history={await listHistory(clientId, requests)}
          exportHref={`/whitbyos/clients/${clientId}/timeline?export=1`}
        />
      );

    default:
      return (
        <OverviewTab
          client={client}
          requests={requests}
          timeline={await listClientTimeline(requests)}
          ownerName={ownerName}
          work={await getWorkCounts(clientId, requests)}
          stats={await getOverviewStats(clientId, requests)}
          week={await listThisWeek(clientId, requests)}
          trend={clientRequestTrend(requests)}
          preferences={readPreferences(client.preferences)}
          ceiling={await getPortalCeiling(clientId)}
          billing={await clientBillingSummary(clientId)}
        />
      );
  }
}


/**
 * The request being reviewed, looked up again rather than threaded down through
 * the tab — the tab renders under a different branch of this page and would
 * otherwise have to carry a prop it does not use.
 */
async function ReviewRequest({
  clientId,
  requestId,
  closeHref,
}: {
  clientId: string;
  requestId: string;
  closeHref: string;
}) {
  const requests = await listAccessRequests(clientId);
  const request = requests.find((row) => row.id === requestId);
  if (!request) return null;

  return (
    <ReviewAccessDialog
      request={request}
      clientId={clientId}
      closeHref={closeHref}
      defaultAreas={await portalDefaultAreas(await getCurrentWorkspaceId())}
    />
  );
}

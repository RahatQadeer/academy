import Link from "next/link";
import { Button } from "@/base/components/Button";
import { SessionExpired } from "@/base/components/SessionExpired";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Pill } from "@/base/components/Pill";
import { StatusPill } from "@/whitbyos/components/StatusPill";
import { NavIcon } from "@/base/components/NavIcons";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import { listClients } from "@/whitbyos/lib/clients";
import { listClientContacts, type ClientContactRow } from "@/whitbyos/lib/client-detail";
import { listMyWorkspaces } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { clientKind, contactName, relativeTime } from "@/whitbyos/lib/format";
import { getWorkspaceSettings } from "@/whitbyos/lib/settings";
import { redirectIfNoClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { param, type SearchParams } from "@/whitbyos/lib/params";
import { AddClientDialog } from "@/whitbyos/clients/components/AddClientDialog";
import { WorkspaceCreatedDialog } from "@/whitbyos/clients/components/WorkspaceCreatedDialog";
import {
  ArchiveOrDeleteDialog,
  ArchiveOrDeleteLink,
} from "@/whitbyos/components/ArchiveOrDelete";
import { archiveClient } from "@/whitbyos/clients/actions";
import { ResendForm } from "@/whitbyos/components/ResendButton";
import {
  canResend,
  PORTAL_STATE,
  portalLabel,
  portalTone,
} from "@/whitbyos/lib/portal-state";
import { initialsOf, roleLabel, roleTone } from "@/whitbyos/lib/contact-vocab";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { Toast } from "@/whitbyos/components/Toast";
import type { ClientListRow } from "@/whitbyos/types";

const LIST = "/whitbyos/clients";

/** Keeps the active filters in the URL when the dialog opens and closes. */
function listHref(filters: Record<string, string | undefined>, extra?: string) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  if (extra) query.set(extra, "1");
  const search = query.toString();
  return search ? `${LIST}?${search}` : LIST;
}

const COLUMNS: Column[] = [
  { label: "Name", width: "2.4fr" },
  { label: "Type", width: "1fr" },
  { label: "Primary Contact", width: "1.8fr" },
  { label: "Active Requests", width: "1fr" },
  { label: "Status", width: "1fr" },
  { label: "Last Activity", width: "1fr" },
  { label: "", width: "200px" },
];

const PORTAL_OPTIONS = (
  ["active", "invited", "link_expired", "not_sent", "expired", "none", "deleted"] as const
).map((state) => ({ value: state, label: PORTAL_STATE[state].label }));

function Face({ name, kind = "person" }: { name: string; kind?: "person" | "company" }) {
  const company = kind === "company";
  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 shrink-0 items-center justify-center text-[11px] font-bold ${
        company ? "rounded-[9px]" : "rounded-full"
      }`}
      style={
        company
          ? { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }
          : { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }
      }
    >
      {initialsOf(name)}
    </span>
  );
}

function softBorder() {
  return "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)";
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await redirectIfNoClientWorkspaces();

  /*
   * Scoped to the client whose workspace is open, unless asked otherwise.
   *
   * `?all=1` widens it without changing the choice — looking at the whole list
   * is not the same act as switching which client you are working in.
   */
  const openClientId = await getOpenClientId();
  const showingAll = param(searchParams, "all") === "1";
  const scopedTo = showingAll ? null : openClientId;

  const filters = {
    q: param(searchParams, "q"),
    workspace: param(searchParams, "workspace"),
    type: param(searchParams, "type"),
    portal: param(searchParams, "portal"),
    sort: param(searchParams, "sort"),
    view: param(searchParams, "view"),
  };
  const cards = filters.view === "card";

  const workspaces = await listMyWorkspaces();
  const classifications = (await getWorkspaceSettings())?.classifications ?? [];

  const loaded = await listClients({ ...filters, clientId: scopedTo ?? undefined });
  const result = loaded;
  const filtered = Boolean(
    filters.q || filters.type || filters.portal || filters.workspace,
  );

  const people =
    scopedTo && result.ok && result.rows[0]
      ? await listClientContacts(scopedTo)
      : [];

  const closeHref = listHref(filters);
  const addHref = listHref(filters, "new");
  const allHref = listHref({ ...filters, all: "1" });
  const dialogOpen = param(searchParams, "new") === "1" && !scopedTo;
  const invited = param(searchParams, "invited");
  const emailed = param(searchParams, "sent") === "1";
  const reason = param(searchParams, "reason");
  const note = param(searchParams, "note");
  const invitedClient = param(searchParams, "client");
  const added = param(searchParams, "added");

  const createdId = param(searchParams, "created");
  const createdName = param(searchParams, "name") ?? "";
  const createdThen = param(searchParams, "then") ?? "";
  const removing = param(searchParams, "remove");
  const removingClient =
    removing && result.ok ? result.rows.find((row) => row.id === removing) : undefined;

  const openClient = scopedTo && result.ok ? result.rows[0] : undefined;

  return (
    <div className="min-h-full px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <div className="mb-6 flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          <NavIcon href="/whitbyos/clients" label="Clients" />
        </span>
        <div className="min-w-0 flex-1">
          <PageHeader
            title={scopedTo ? "Client" : "Clients"}
            subtitle={
              scopedTo && openClient
                ? `${openClient.name} is open. People on this client are below; every client is still one click away.`
                : showingAll && openClientId
                  ? "Every workspace. Open one from Workspace Overview to focus the rest of Whitby."
                  : "Workspaces you coordinate work for. Open one to focus Requests, Plans and Messages on that relationship."
            }
            size={22}
            gap={20}
            action={
              scopedTo ? (
                <Button
                  href={allHref}
                  variant="secondary"
                  unsized
                  className="px-4 py-[9px] text-[13.5px]"
                >
                  All clients
                </Button>
              ) : (
                <Button
                  href={addHref}
                  variant="primary"
                  unsized
                  className="px-4 py-[9px] text-[14px]"
                >
                  + Add Client
                </Button>
              )
            }
          />
        </div>
      </div>

      {/* Filters only earn their place on the full list. */}
      {scopedTo ? null : (
        <FilterBar
          action="/whitbyos/clients"
          searchPlaceholder="Search clients…"
          searchValue={filters.q}
          selects={[
            {
              name: "workspace",
              anyLabel: "All workspaces",
              value: filters.workspace,
              options: workspaces.map((workspace) => ({
                value: workspace.id,
                label: workspace.name,
              })),
            },
            {
              name: "type",
              anyLabel: "All classifications",
              value: filters.type,
              options: classifications.map((label) => ({ value: label, label })),
            },
            {
              name: "portal",
              anyLabel: "All statuses",
              value: filters.portal,
              options: PORTAL_OPTIONS,
            },
          ]}
          sort={{
            name: "sort",
            anyLabel: "Sort: Most recent activity",
            value: filters.sort,
            options: [
              { value: "name", label: "Sort: Client name (A–Z)" },
              { value: "requests", label: "Sort: Active requests" },
            ],
          }}
          hidden={{
            view: cards ? "card" : undefined,
            all: showingAll ? "1" : undefined,
          }}
          trailing={
            <ViewToggle
              listHref={listHref({ ...filters, view: undefined, all: showingAll ? "1" : undefined })}
              cardHref={listHref({ ...filters, view: "card", all: showingAll ? "1" : undefined })}
              cards={cards}
            />
          }
        />
      )}

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your clients. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button
                href="mailto:support@privateattache.com?subject=Clients%20failed%20to%20load"
                variant="secondary"
              >
                Contact support
              </Button>
              <Button href="/whitbyos/clients" variant="primary">
                Try again
              </Button>
            </>
          }
        />
      ) : result.rows.length === 0 ? (
        <div
          className="rounded-[12px] border px-8 py-10"
          style={{ borderColor: softBorder(), background: "var(--surface)" }}
        >
          <StateMessage
            glyph="◔"
            title={filtered ? "No clients match those filters" : "No clients yet"}
            description={
              filtered
                ? "Try a different search term, or clear the filters to see every client."
                : "Add your first client to start creating requests and building workplans with Whitby."
            }
            action={
              filtered ? (
                <Button href="/whitbyos/clients" variant="secondary">
                  Clear filters
                </Button>
              ) : (
                <Button href={addHref} variant="primary">
                  + Add your first client
                </Button>
              )
            }
          />
        </div>
      ) : scopedTo && openClient ? (
        <OpenClientView
          client={openClient}
          people={people}
          removeHref={listHref({ ...filters, remove: openClient.id })}
        />
      ) : cards ? (
        <ClientCards
          rows={result.rows}
          removeHref={(id) =>
            listHref({ ...filters, remove: id, all: showingAll ? "1" : undefined })
          }
        />
      ) : (
        <div
          className="overflow-hidden rounded-[12px] border"
          style={{
            borderColor: softBorder(),
            background: "var(--surface)",
            boxShadow: "0 1px 2px rgba(31,72,125,.04)",
          }}
        >
          <DataTable columns={COLUMNS} rowPadding={12}>
            <ShowMore step={8}>
              {result.rows.map((client) => (
                <DataTableRow
                  key={client.id}
                  href={`/whitbyos/clients/${client.id}`}
                  trailing={
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/whitbyos/clients/${client.id}`}
                        className="rounded-control border px-3 py-[5px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
                        style={{
                          borderColor: "var(--border-strong)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                        }}
                      >
                        View
                      </Link>

                      {client.primary_contact?.email &&
                      canResend(client.portal_state ?? "none") ? (
                        <ResendForm
                          clientId={client.id}
                          contactId={client.primary_contact.id}
                          email={client.primary_contact.email}
                          name={contactName(client.primary_contact)}
                          label="Resend"
                          variant="button"
                        />
                      ) : null}

                      <ArchiveOrDeleteLink
                        href={listHref({
                          ...filters,
                          remove: client.id,
                          all: showingAll ? "1" : undefined,
                        })}
                        label="Archive client"
                        variant="word"
                      />
                    </span>
                  }
                >
                  <DataTableCell emphasis="strong">
                    <span className="inline-flex min-w-0 items-center gap-2.5">
                      <Face
                        name={client.name}
                        kind={
                          client.client_type === "company" ||
                          client.client_type === "organization"
                            ? "company"
                            : "person"
                        }
                      />
                      <span className="inline-flex min-w-0 flex-col gap-0.5">
                        <span className="inline-flex items-center gap-2 truncate">
                          {client.name}
                          {client.status && client.status !== "active" ? (
                            <StatusPill status={client.status} />
                          ) : null}
                        </span>
                      </span>
                    </span>
                  </DataTableCell>
                  <DataTableCell>{clientKind(client)}</DataTableCell>
                  <DataTableCell>{contactName(client.primary_contact)}</DataTableCell>
                  <DataTableCell emphasis="strong">
                    {client.active_request_count}
                  </DataTableCell>
                  <span>
                    <Pill tone={portalTone(client.portal_state ?? "none")}>
                      {portalLabel(client.portal_state ?? "none")}
                    </Pill>
                  </span>
                  <DataTableCell emphasis="muted">
                    {relativeTime(client.last_activity_at)}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </ShowMore>
          </DataTable>
        </div>
      )}

      {removingClient ? (
        <ArchiveOrDeleteDialog
          title={`Archive ${removingClient.name}?`}
          lead="This client has linked records. Choose what to remove:"
          linked={
            <>
              Linked to this client:{" "}
              <strong style={{ color: "var(--ink)" }}>
                {removingClient.active_request_count} Requests
              </strong>
              , its Work Plans, Documents and Contacts, and their Client Portal access.
            </>
          }
          archiveLabel="Archive this client"
          archiveDetail="Hides it from Clients and everywhere it is listed. Everything stays intact, and Settings → Archive puts it back."
          deleteDetail="Removes all Requests, Work Plans, Documents and the Contact. This can't be undone."
          archiveAction={archiveClient}
          hidden={{ client_id: removingClient.id }}
          closeHref={closeHref}
        />
      ) : null}

      {dialogOpen ? (
        <AddClientDialog
          closeHref={closeHref}
          error={param(searchParams, "error")}
          classifications={classifications}
        />
      ) : null}

      {invited && emailed ? (
        <Toast
          tone={note ? "warning" : "success"}
          title={note ? "Invitation sent, check the address" : "Invitation sent"}
          detail={
            note ??
            `Email sent to ${invited}. Until they open it, they show as Invited on the client's Contacts tab.`
          }
          closeHref={closeHref}
        />
      ) : null}

      {invited && !emailed ? (
        <Toast
          tone="warning"
          title="Invitation created, email not sent"
          detail={reason ?? `No email reached ${invited}. The invitation link still works.`}
          action={
            invitedClient ? (
              <Button unsized
                href={`/whitbyos/clients/${invitedClient}/contacts`}
                variant="secondary"
                className="px-3 py-1.5 text-[12.5px]"
              >
                Copy the link
              </Button>
            ) : undefined
          }
          closeHref={closeHref}
        />
      ) : null}

      {added ? (
        <Toast
          title="Client added"
          detail={`${added} is on your list. Nobody was invited to the portal, an email address on a contact is what does that.`}
          closeHref={closeHref}
        />
      ) : null}

      {createdId ? (
        <WorkspaceCreatedDialog
          clientName={createdName}
          setUpHref={`${LIST}/${createdId}/setup`}
          skipHref={createdThen ? `${LIST}?${createdThen}` : LIST}
        />
      ) : null}

      {param(searchParams, "expired") === "1" ? <SessionExpired next="/whitbyos/clients" /> : null}
    </div>
  );
}

/**
 * One client is open: show that workspace as a card, then the people on it
 * (primary + additional members), not a lonely one-row table.
 */
function OpenClientView({
  client,
  people,
  removeHref,
}: {
  client: ClientListRow;
  people: ClientContactRow[];
  removeHref: string;
}) {
  const primaryId = client.primary_contact_id;
  const ordered = [...people].sort((a, b) => {
    if (a.id === primaryId) return -1;
    if (b.id === primaryId) return 1;
    return a.name.localeCompare(b.name);
  });

  /*
   * Primary contact can exist on the client before a membership row is written.
   * Surface them once so the open view is never "client with nobody".
   */
  const primaryOnly =
    client.primary_contact && !ordered.some((row) => row.id === client.primary_contact!.id)
      ? client.primary_contact
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div
        className="relative overflow-hidden rounded-[14px] border"
        style={{
          borderColor: softBorder(),
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04), 0 18px 40px -28px rgba(31,72,125,.45)",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: "var(--accent)" }}
        />

        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 pl-6">
          <div className="flex min-w-0 items-start gap-3.5">
            <Face
              name={client.name}
              kind={
                client.client_type === "company" || client.client_type === "organization"
                  ? "company"
                  : "person"
              }
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[18px] font-semibold tracking-[-0.2px]">
                  {client.name}
                </h2>
                <Pill tone={portalTone(client.portal_state ?? "none")}>
                  {portalLabel(client.portal_state ?? "none")}
                </Pill>
                {client.status && client.status !== "active" ? (
                  <StatusPill status={client.status} />
                ) : null}
              </div>
              <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
                {clientKind(client)}
                {contactName(client.primary_contact)
                  ? ` · Primary: ${contactName(client.primary_contact)}`
                  : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/whitbyos/clients/${client.id}`}
              className="rounded-control border px-3.5 py-[7px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
              style={{
                borderColor: "var(--border-strong)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            >
              Open profile
            </Link>
            <ArchiveOrDeleteLink href={removeHref} label="Archive client" variant="word" />
          </div>
        </div>

        <div
          className="grid grid-cols-2 gap-px border-t sm:grid-cols-4"
          style={{
            borderColor: "var(--chrome-line)",
            background: "var(--chrome-line)",
          }}
        >
          {[
            {
              label: "Active requests",
              value: String(client.active_request_count),
            },
            {
              label: "People",
              value: String(ordered.length + (primaryOnly ? 1 : 0)),
            },
            {
              label: "Type",
              value: clientKind(client),
            },
            {
              label: "Last activity",
              value: relativeTime(client.last_activity_at),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="px-5 py-3.5"
              style={{ background: "var(--surface)" }}
            >
              <div
                className="text-[11px] font-semibold uppercase tracking-[.04em]"
                style={{ color: "var(--text-quiet)" }}
              >
                {stat.label}
              </div>
              <div className="mt-1 text-[15px] font-semibold">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.15px]">
              People on this client
            </h3>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Primary contact and additional members linked to this workspace.
            </p>
          </div>
          <Link
            href={`/whitbyos/clients/${client.id}/contacts`}
            className="shrink-0 text-[12.5px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            Manage contacts →
          </Link>
        </div>

        {ordered.length === 0 && !primaryOnly ? (
          <div
            className="rounded-[12px] border px-5 py-8 text-center"
            style={{ borderColor: softBorder(), background: "var(--surface)" }}
          >
            <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              Nobody else is on this client yet. Add people from the client profile.
            </p>
            <Link
              href={`/whitbyos/clients/${client.id}/contacts`}
              className="mt-3 inline-block text-[13px] font-medium no-underline"
              style={{ color: "var(--accent)" }}
            >
              Add people →
            </Link>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-[12px] border"
            style={{
              borderColor: softBorder(),
              background: "var(--surface)",
              boxShadow: "0 1px 2px rgba(31,72,125,.04)",
            }}
          >
            {primaryOnly ? (
              <PersonRow
                name={contactName(primaryOnly) || "Primary contact"}
                detail={primaryOnly.email}
                role="primary_contact"
                portal={client.portal_state ?? "none"}
                href={`/whitbyos/contacts/${primaryOnly.id}`}
                primary
              />
            ) : null}
            {ordered.map((person) => (
              <PersonRow
                key={person.id}
                name={person.name}
                detail={person.email}
                role={person.role_label}
                portal={person.portal_state}
                href={`/whitbyos/contacts/${person.id}`}
                primary={person.id === primaryId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PersonRow({
  name,
  detail,
  role,
  portal,
  href,
  primary,
}: {
  name: string;
  detail: string | null;
  role: string;
  portal: Parameters<typeof portalTone>[0];
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b px-4 py-3.5 no-underline last:border-b-0"
      style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
    >
      <Face name={name} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[13.5px] font-medium">{name}</span>
          {primary ? <Pill tone="info">Primary</Pill> : null}
          {roleLabel(role) ? (
            <Pill tone={roleTone(role)}>{roleLabel(role)}</Pill>
          ) : null}
        </span>
        {detail ? (
          <span
            className="mt-0.5 block truncate text-[12px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {detail}
          </span>
        ) : null}
      </span>
      <Pill tone={portalTone(portal)}>{portalLabel(portal)}</Pill>
    </Link>
  );
}

function ViewToggle({
  listHref,
  cardHref,
  cards,
}: {
  listHref: string;
  cardHref: string;
  cards: boolean;
}) {
  const cell =
    "flex h-8 w-8 items-center justify-center text-[14px] no-underline";
  return (
    <div className="flex overflow-hidden rounded-control border border-line-strong">
      <Link
        href={listHref}
        title="List view"
        className={cell}
        style={{
          background: cards ? "var(--surface)" : "var(--surface-soft)",
          color: cards ? "var(--text-tertiary)" : "var(--ink)",
        }}
      >
        ☰
      </Link>
      <Link
        href={cardHref}
        title="Card view"
        className={cell}
        style={{
          background: cards ? "var(--surface-soft)" : "var(--surface)",
          color: cards ? "var(--ink)" : "var(--text-tertiary)",
          borderLeft: "1px solid var(--border-strong)",
        }}
      >
        ▦
      </Link>
    </div>
  );
}

function ClientCards({
  rows,
  removeHref,
}: {
  rows: ClientListRow[];
  removeHref: (id: string) => string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((client) => (
        <div
          key={client.id}
          className="relative rounded-[12px] border p-[18px]"
          style={{
            borderColor: softBorder(),
            background: "var(--surface)",
            boxShadow: "0 1px 2px rgba(31,72,125,.04)",
          }}
        >
          <Link
            href={`/whitbyos/clients/${client.id}`}
            className="flex flex-col gap-2.5 no-underline"
            style={{ color: "inherit" }}
          >
            <div className="flex items-center gap-2.5 pr-6">
              <Face
                name={client.name}
                kind={
                  client.client_type === "company" ||
                  client.client_type === "organization"
                    ? "company"
                    : "person"
                }
              />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                {client.name}
              </span>
              <Pill tone={portalTone(client.portal_state ?? "none")}>
                {portalLabel(client.portal_state ?? "none")}
              </Pill>
            </div>
            <div
              className="flex flex-wrap items-center gap-1.5 text-[12.5px]"
              style={{ color: "var(--text-muted)" }}
            >
              <span>
                {clientKind(client)}
                {" · "}
                {contactName(client.primary_contact)}
              </span>
              {client.status && client.status !== "active" ? (
                <StatusPill status={client.status} />
              ) : null}
            </div>
            <div
              className="flex justify-between border-t pt-2 text-[12px]"
              style={{ borderColor: "var(--chrome-line)", color: "var(--text-tertiary)" }}
            >
              <span>
                {client.active_request_count} active request
                {client.active_request_count === 1 ? "" : "s"}
              </span>
              <span>{relativeTime(client.last_activity_at)}</span>
            </div>
          </Link>
          <div className="absolute right-3 top-3">
            <ArchiveOrDeleteLink href={removeHref(client.id)} label="Archive client" />
          </div>
        </div>
      ))}
    </div>
  );
}

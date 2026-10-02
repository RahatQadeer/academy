import { Pill } from "@/base/components/Pill";
import { EmptyNote } from "@/whitbyos/components/EmptyNote";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import { relativeTime, statusLabel } from "@/whitbyos/lib/format";
import { ACCESS_AREAS, GRANT_ROLES } from "@/whitbyos/lib/access-requests-vocab";
import { CopyInviteLink } from "@/whitbyos/clients/[id]/components/CopyInviteLink";
import { ResendForm } from "@/whitbyos/components/ResendButton";
import Link from "next/link";
import type { AccessRequest, ClientContactRow } from "@/whitbyos/lib/client-detail";

/**
 * Whether this person can actually open the portal, which is not the same as
 * whether they were given permission to. "Portal" on its own said only that
 * the professional had granted it, and read as though they were already in.
 */
function PortalPill({ contact }: { contact: ClientContactRow }) {
  // They closed it themselves. Everything of theirs is still here — this only
  // says not to expect them to read anything sent to the portal.
  if (contact.portal_state === "deleted") {
    return (
      <Pill tone="danger">
        <span aria-hidden>−</span> Account deleted
      </Pill>
    );
  }
  // Read from their account, not from the invitation — being in is the fact.
  if (contact.portal_state === "active") return <Pill tone="success">Portal · Active</Pill>;
  if (contact.portal_state === "invited") return <Pill tone="warning">Invited</Pill>;
  // An invitation exists and no email left. This claims neither thing: "Invited"
  // would leave somebody waiting on a reply, and a standing red pill turns one
  // failed send into a permanent mark on the person. The failure is reported
  // when it happens; the link sits beside this, which is what gets them in.
  if (contact.portal_state === "not_sent") return null;
  if (contact.portal_state === "expired") return <Pill tone="danger">Invite expired</Pill>;
  if (contact.portal_access) return <Pill tone="neutral">Access, not invited</Pill>;
  return null;
}

const COLUMNS: Column[] = [
  { label: "Name", width: "2fr" },
  { label: "Contact", width: "2fr" },
  { label: "Role", width: "1.5fr" },
];

export function ContactsTab({
  contacts,
  clientId,
  requests = [],
}: {
  contacts: ClientContactRow[];
  clientId: string;
  /** Pending access requests from the client's own side (§4.9). */
  requests?: AccessRequest[];
}) {
  const pending =
    requests.length > 0 ? (
      // Above the list, because it is something to answer rather than something
      // to read. The portal has been writing these since it was built and
      // nothing here ever showed them.
      <div
        className="relative mb-5 overflow-hidden rounded-[14px] border"
        style={{
          borderColor: "var(--warning-border)",
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(31,72,125,.05), 0 14px 32px -24px rgba(31,72,125,.5)",
        }}
      >
        {/* The edge carries the colour, so the card can stay paper: a full
            amber band across the top made the thing shout before it said
            anything, and the rows under it read as an afterthought. */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: "var(--warning-fg)" }}
        />

        <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
          <span
            className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[.05em]"
            style={{ color: "var(--warning-fg)" }}
          >
            <span aria-hidden className="text-[8px]">●</span>
            {requests.length === 1
              ? "Access request"
              : `${requests.length} access requests`}
          </span>
          <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
            Waiting on you
          </span>
        </div>

        {requests.map((request) => {
          const level =
            GRANT_ROLES.find((role) => role.value === request.requestedRole)?.label ??
            request.requestedRole;
          const areas = request.requestedAreas?.length ?? null;

          return (
            <div
              key={request.id}
              className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3.5 first-of-type:border-t-0"
            >
              <span
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold"
                style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
              >
                {request.initials}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[14px] font-semibold">
                    {request.personName}
                  </span>
                  {request.relationship ? (
                    <span
                      className="shrink-0 rounded-full px-2 py-[1px] text-[11px] font-medium"
                      style={{ background: "var(--surface-active)", color: "var(--text-secondary)" }}
                    >
                      {request.relationship}
                    </span>
                  ) : null}
                </span>

                {/* What they asked for, before the dialog is opened: the level
                    and how much of the portal it comes with are the two things
                    this decision turns on. */}
                <span
                  className="mt-1 block truncate text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {[
                    level ? `Asked for ${level}` : null,
                    areas === null ? null : `${areas} area${areas === 1 ? "" : "s"}`,
                    request.requestedBy ? `asked by ${request.requestedBy}` : null,
                    relativeTime(request.createdAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>

              {/* The one thing to do with a request, so it is drawn as the one
                  thing to do with it. */}
              <Link
                href={`/whitbyos/clients/${clientId}/contacts?review=${request.id}`}
                className="shrink-0 rounded-control px-4 py-[8px] text-[13px] font-medium text-white no-underline transition-all hover:-translate-y-px"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 1px 2px rgba(35,131,226,.35), 0 8px 18px -10px rgba(35,131,226,.8)",
                }}
              >
                Review
              </Link>
            </div>
          );
        })}
      </div>
    ) : null;

  if (contacts.length === 0) {
    return (
      <>
        {pending}
        <EmptyNote>
          No people linked to this client yet. Add someone from Contacts to give
          them a role here.
        </EmptyNote>
      </>
    );
  }

  return (
    <>
    {pending}
    <DataTable columns={COLUMNS}>
      {contacts.map((contact) => (
        <DataTableRow key={contact.id}>
          <DataTableCell emphasis="strong">{contact.name}</DataTableCell>
          <DataTableCell>
            {contact.email ?? contact.phone ?? "No contact details"}
            {/* What they can actually reach, which until now was decided in a
                dialog and then never shown again: the primary contact asks for
                somebody to be added, somebody here ticks the areas, and from
                that moment nobody could say what had been granted without
                reading the database. */}
            <AccessNote contact={contact} />
          </DataTableCell>
          <span className="flex items-center gap-2">
            <span style={{ color: "var(--text-secondary)" }} className="text-[13.5px]">
              {statusLabel(contact.role_label)}
            </span>
            <PortalPill contact={contact} />
            {contact.invite_url ? <CopyInviteLink url={contact.invite_url} /> : null}

            {/* Nothing to resend to someone with no address, and nothing to
                resend to someone already in. */}
            {contact.email &&
            contact.portal_state !== "active" &&
            contact.portal_state !== "deleted" ? (
              <ResendForm
                clientId={clientId}
                contactId={contact.id}
                email={contact.email}
                name={contact.name}
                label={contact.portal_state === "none" ? "Send invitation" : "Resend"}
              />
            ) : null}
          </span>
        </DataTableRow>
      ))}
    </DataTable>
    </>
  );
}

/**
 * The areas this person may reach, under their address.
 *
 * Three named, then a count: the row is a person and their address first, and
 * a list of nine would push everything else off it. Nothing at all where the
 * portal is not open to them, because an access list for somebody with no way
 * in is a list of things that do not happen.
 *
 * "Not set" is its own answer. A membership nobody has decided about inherits
 * whatever the portal's own rules give it, which is not the same as none, and
 * saying "none" of it would be a plain untruth on the screen.
 */
function AccessNote({ contact }: { contact: ClientContactRow }) {
  if (contact.portal_state === "none" || contact.portal_state === "deleted") return null;

  const granted = contact.areas;

  if (granted === null) {
    return (
      <span className="mt-1 block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        Access not set, they see what this account allows by default.
      </span>
    );
  }

  if (granted.length === 0) {
    return (
      <span className="mt-1 block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        No areas granted.
      </span>
    );
  }

  const names = granted
    .map((key) => ACCESS_AREAS.find((area) => area.key === key)?.label ?? key)
    /* The label is a sentence for the review dialog, "Requests, view assigned
       Requests"; on a row it is the first half of it that names the area. */
    .map((label) => label.split(",")[0]);

  const shown = names.slice(0, 3).join(", ");
  const rest = names.length > 3 ? ` and ${names.length - 3} more` : "";

  return (
    <span
      className="mt-1 block text-[12px]"
      style={{ color: "var(--text-tertiary)" }}
      title={names.join(", ")}
    >
      Can see {shown}
      {rest}.
    </span>
  );
}

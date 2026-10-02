import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import { Button } from "@/base/components/Button";
import { Toast } from "@/whitbyos/components/Toast";
import { BackLink } from "@/whitbyos/components/BackLink";
import { EmailLink, PhoneLink } from "@/whitbyos/components/Reach";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { relativeTime, shortDate } from "@/whitbyos/lib/format";
import { getContact } from "@/whitbyos/lib/contacts";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { EditContactDialog } from "@/whitbyos/contacts/components/EditContactDialog";
import { initialsOf, roleLabel, roleTone } from "@/whitbyos/lib/contact-vocab";
import { requestStatusLabel, requestStatusTone } from "@/whitbyos/lib/request-status";

const LIST = "/whitbyos/contacts";

/**
 * Screen 4.4 — one person.
 *
 * The export gives the left column what somebody needs to act: how this person
 * wants to be dealt with, what work is running around them, and what is known
 * about them. The right column is reference — how to reach them, who they
 * belong to, what to do next, and what has just happened.
 *
 * Their roles move into the header as pills, which is where 4.4 puts them: a
 * decision-maker is a fact about the person, and it was only readable before
 * by finding their name in a list of clients further down.
 */
export default async function ContactDetailPage({
  contactId,
  searchParams,
}: {
  contactId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const contact = await getContact(contactId);
  if (!contact) notFound();
  const showClients = await usesClientWorkspaces();

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const here = `${LIST}/${contactId}`;
  const editing = one(searchParams?.edit) === "1";
  const saved = one(searchParams?.saved) === "1";
  const error = one(searchParams?.error);

  // A person can hold the same role at two clients; the header says it once.
  const roles = [...new Set(contact.links.map((link) => link.role))];

  const open = contact.requests.filter(
    (row) => requestStatusLabel(row.status) !== "Completed",
  );
  const advice = open.find((row) => row.nextAction);

  return (
    <div className="min-h-full px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={LIST} label="Back to Contacts" />

      <div className="mb-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        <Link href={LIST} className="no-underline hover:underline" style={{ color: "inherit" }}>
          Contacts
        </Link>
        {" / "}
        <span style={{ color: "var(--ink)" }}>{contact.name}</span>
      </div>

      {/*
       * Masthead: who they are and how to reach them, together at the top.
       */}
      <div
        className="mb-7 flex flex-wrap items-center gap-4 rounded-[12px] border px-5 py-4"
        style={{
          borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
          background:
            "linear-gradient(105deg, color-mix(in srgb, var(--avatar-blue-bg) 55%, var(--surface)) 0%, var(--surface) 62%)",
        }}
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-bold"
          style={{ background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }}
        >
          {initialsOf(contact.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[24px] font-bold tracking-[-0.35px]">{contact.name}</h1>
            {contact.portalAccountDeleted ? (
              <span
                title="This person deleted their Client Portal account. Their record and history are unchanged."
                className="flex shrink-0 items-center gap-1 rounded-[5px] px-[7px] py-[2px] text-[10.5px] font-medium"
                style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}
              >
                <span aria-hidden>−</span>
                Account deleted
              </span>
            ) : null}
            {roles.map((role) => (
              <Pill key={role} tone={roleTone(role)}>
                {roleLabel(role)}
              </Pill>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px]">
            <span style={{ color: "var(--text-secondary)" }}>
              {contact.titleRole ?? "No company or role recorded"}
            </span>
            {contact.email ? (
              <>
                <span style={{ color: "var(--text-quiet)" }} aria-hidden>
                  ·
                </span>
                <EmailLink address={contact.email} />
              </>
            ) : null}
            {contact.phone ? (
              <>
                <span style={{ color: "var(--text-quiet)" }} aria-hidden>
                  ·
                </span>
                <PhoneLink number={contact.phone} />
              </>
            ) : null}
            {contact.timezone ? (
              <span style={{ color: "var(--text-quiet)" }}>· {contact.timezone}</span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {contact.email ? (
            <Button unsized
              href={`mailto:${contact.email}`}
              variant="secondary"
              className="px-3.5 py-[8px] text-[13px]"
            >
              Email
            </Button>
          ) : null}
          <Button unsized
            href={`${here}?edit=1`}
            variant="primary"
            className="px-3.5 py-[8px] text-[13px]"
          >
            Edit
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Section
            title="Communication Preferences"
            mark={{ glyph: "✉", bg: "var(--accent-tint)", fg: "var(--accent)" }}
            add={`${here}?edit=1`}
          >
            {contact.communicationPreferences ? (
              <p
                className="whitespace-pre-line text-[13.5px] leading-[1.75]"
                style={{ color: "var(--text-secondary)" }}
              >
                {contact.communicationPreferences}
              </p>
            ) : (
              <Empty>How this person prefers to be reached, and when not to.</Empty>
            )}
          </Section>

          <Section
            title={`Linked Requests (${contact.requests.length})`}
            mark={{ glyph: "☰", bg: "var(--avatar-tan-bg)", fg: "var(--avatar-tan-fg)" }}
          >
            {contact.requests.length === 0 ? (
              <Empty>No work is running at the clients this person is attached to.</Empty>
            ) : (
              <div className="flex flex-col">
                <ShowMore step={6}>
                  {contact.requests.map((request, index) => (
                    <Link
                      key={request.id}
                      href={`/whitbyos/requests/${request.id}`}
                      className="flex items-center gap-3 py-2.5 no-underline transition-colors hover:bg-[var(--surface-soft)]"
                      style={{
                        color: "var(--ink)",
                        borderTop: index === 0 ? undefined : "1px solid var(--chrome-line)",
                        marginLeft: -4,
                        marginRight: -4,
                        paddingLeft: 4,
                        paddingRight: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Pill tone={requestStatusTone(request.status)}>
                        {requestStatusLabel(request.status)}
                      </Pill>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                        {request.title}
                      </span>
                      <span
                        className="shrink-0 text-[12px]"
                        style={{ color: "var(--text-quiet)" }}
                      >
                        {request.targetDate ? `Due ${shortDate(request.targetDate)}` : "No due date"}
                      </span>
                    </Link>
                  ))}
                </ShowMore>
              </div>
            )}
          </Section>

          <Section
            title="Notes"
            mark={{ glyph: "✎", bg: "var(--avatar-orange-bg)", fg: "var(--avatar-orange-fg)" }}
            add={`${here}?edit=1`}
          >
            {contact.notes ? (
              <p
                className="whitespace-pre-line text-[13.5px] leading-[1.7]"
                style={{ color: "var(--text-secondary)" }}
              >
                {contact.notes}
              </p>
            ) : (
              <Empty>What somebody picking this relationship up would want to know.</Empty>
            )}
          </Section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 lg:w-[300px]">
          {showClients ? (
            <Panel
              title="Linked Clients"
              mark={{ glyph: "◔", bg: "var(--accent-tint)", fg: "var(--accent)" }}
            >
              {contact.links.length === 0 ? (
                <div style={{ color: "var(--text-tertiary)" }}>Not linked to any client yet.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {contact.links.map((link) => (
                    <Link
                      key={link.clientId}
                      href={`/whitbyos/clients/${link.clientId}`}
                      className="flex items-center gap-2 rounded-[7px] px-2 py-1.5 no-underline transition-colors hover:bg-[var(--surface-soft)]"
                      style={{ color: "var(--ink)", marginLeft: -8, marginRight: -8 }}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {link.clientName}
                      </span>
                      {contact.portalAccountDeleted ? null : contact.inThePortal ? (
                        <Pill tone="success">Portal</Pill>
                      ) : link.portalAccess ? (
                        <Pill tone="neutral">Access</Pill>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          <Panel
            title="Next Action"
            mark={{ glyph: "→", bg: "var(--avatar-green-bg)", fg: "var(--avatar-green-fg)" }}
          >
            {advice ? (
              <>
                <div className="text-[13px] leading-[1.55]" style={{ color: "var(--ink)" }}>
                  {advice.nextAction}
                </div>
                <div className="mt-1.5 text-[12px]" style={{ color: "var(--text-quiet)" }}>
                  On {advice.title}
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-tertiary)" }}>
                No open request has a next action recorded.
              </div>
            )}
          </Panel>

          <Panel
            title="Timeline"
            mark={{ glyph: "◷", bg: "var(--avatar-orange-bg)", fg: "var(--avatar-orange-fg)" }}
          >
            {contact.timeline.length === 0 ? (
              <div style={{ color: "var(--text-tertiary)" }}>Nothing has happened yet.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {contact.timeline.map((line) => (
                  <div key={line.id} className="leading-[1.45]">
                    <div style={{ color: "var(--ink)" }}>{line.description}</div>
                    <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
                      {relativeTime(line.at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Record"
            mark={{ glyph: "◈", bg: "var(--surface-soft)", fg: "var(--text-secondary)" }}
          >
            <div>Added {shortDate(contact.created_at)}</div>
            {contact.salutation ? <div className="mt-1">Salutation: {contact.salutation}</div> : null}
            <div className="mt-2" style={{ color: "var(--text-tertiary)" }}>
              Shared across every client, so editing here changes it everywhere.
            </div>
          </Panel>
        </aside>
      </div>

      {editing ? (
        <EditContactDialog contact={contact} closeHref={here} error={error} />
      ) : null}

      {saved ? (
        <Toast
          title="Contact updated"
          detail="A contact is shared, so every client they are attached to sees this."
          closeHref={here}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
  add,
  mark,
}: {
  title: string;
  children: React.ReactNode;
  add?: string;
  mark: { glyph: string; bg: string; fg: string };
}) {
  return (
    <div
      className="overflow-hidden rounded-[10px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
        background: "var(--surface)",
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{
          borderColor: "var(--chrome-line)",
          background: `color-mix(in srgb, ${mark.bg} 38%, var(--surface))`,
        }}
      >
        <span
          aria-hidden
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[11px]"
          style={{ background: mark.bg, color: mark.fg }}
        >
          {mark.glyph}
        </span>
        <span
          className="min-w-0 flex-1 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {title}
        </span>
        {add ? (
          <Link
            href={add}
            className="text-[12px] font-medium no-underline"
            style={{ color: "var(--accent)" }}
          >
            Add
          </Link>
        ) : null}
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] leading-[1.6]" style={{ color: "var(--text-quiet)" }}>
      {children}
    </div>
  );
}

function Panel({
  title,
  children,
  mark,
}: {
  title: string;
  children: React.ReactNode;
  mark: { glyph: string; bg: string; fg: string };
}) {
  return (
    <div
      className="overflow-hidden rounded-[10px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
        background: "var(--surface)",
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-3.5 py-2"
        style={{
          borderColor: "var(--chrome-line)",
          background: `color-mix(in srgb, ${mark.bg} 38%, var(--surface))`,
        }}
      >
        <span
          aria-hidden
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] text-[10px]"
          style={{ background: mark.bg, color: mark.fg }}
        >
          {mark.glyph}
        </span>
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {title}
        </span>
      </div>
      <div className="px-3.5 py-3 text-[12.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

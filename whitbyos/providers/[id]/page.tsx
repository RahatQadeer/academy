import Link from "next/link";
import { BackLink } from "@/whitbyos/components/BackLink";
import { notFound } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import { relativeTime, shortDate } from "@/whitbyos/lib/format";
import { Button } from "@/base/components/Button";
import { Toast } from "@/whitbyos/components/Toast";
import { EmailLink, PhoneLink, WebsiteLink } from "@/whitbyos/components/Reach";
import { EditProviderDialog } from "@/whitbyos/providers/components/EditProviderDialog";
import { ProviderNotes } from "@/whitbyos/providers/components/ProviderNotes";
import { ProviderPeople } from "@/whitbyos/providers/components/ProviderPeople";
import { AddProviderDialog } from "@/whitbyos/providers/components/AddProviderDialog";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { SetContactDialog } from "@/whitbyos/providers/components/SetContactDialog";
import {
  getProvider,
  listCompanyOptions,
  listTeammates,
  listUsedSpecialties,
} from "@/whitbyos/lib/providers";
import { categoryBySlugOrName, listCategories } from "@/whitbyos/lib/taxonomy";
import { listProviderNotes } from "@/whitbyos/lib/provider-notes";
import { listCompanyPeople } from "@/whitbyos/lib/provider-people";
import { initialsOf } from "@/whitbyos/lib/contact-vocab";
import {
  optionLabel,
  outreachLabel,
  readinessLabel,
  readinessTone,
  responseLabel,
  sourceLabel,
} from "@/whitbyos/lib/provider-vocab";
import { requestStatusLabel, requestStatusTone } from "@/whitbyos/lib/request-status";

/**
 * Screen 14a — one provider.
 *
 * The evidence panel is the point of the screen. §6.9 asks a professional to be
 * able to say why they trust someone before placing a client's work with them,
 * so where they came from and when they were last checked sit beside the name
 * rather than buried.
 */
export default async function ProviderDetailPage({
  providerId,
  searchParams,
}: {
  providerId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const provider = await getProvider(providerId);
  if (!provider) notFound();
  const showClients = await usesClientWorkspaces();

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const editing = one(searchParams?.edit) === "1";
  const saved = one(searchParams?.saved) === "1";
  const error = one(searchParams?.error);
  const here = `/whitbyos/providers/${providerId}`;

  const choosingContact = one(searchParams?.contact) === "1";
  const addingPerson = one(searchParams?.addperson) === "1" && Boolean(provider.companyId);

  const [notes, people] = await Promise.all([
    listProviderNotes(providerId),
    provider.companyId
      ? listCompanyPeople(provider.companyId, providerId)
      : Promise.resolve([]),
  ]);

  /*
   * The point of contact is somebody at this firm, not anybody on file.
   *
   * Both dialogs used to offer every contact the workspace has, which on a
   * provider called Ahmed & Partners meant offering the client whose work it
   * is and the member of staff doing the offering. A contact is canonical and
   * shared, so the list has to be narrowed by where somebody actually works,
   * and `company_contacts` is what says so.
   */
  const contacts = people.map((person) => ({
    id: person.contactId,
    name: person.role ? `${person.name} · ${person.role}` : person.name,
  }));

  const editingSomebody = Boolean(one(searchParams?.person));

  const [teammates, categories, usedSpecialties] =
    editing || addingPerson || editingSomebody
      ? await Promise.all([listTeammates(), listCategories(), listUsedSpecialties()])
      : [[], [], []];

  const [companies, clients] =
    addingPerson || editingSomebody
      ? await Promise.all([
          listCompanyOptions(),
          showClients ? listClientOptions() : Promise.resolve([]),
        ])
      : [[], []];

  /*
   * Editing somebody who is a provider themselves is editing that provider.
   *
   * Their name, role and two ways to reach them are the least of what is on
   * file about them; opening four boxes over a record that also holds a
   * category, a readiness and an outreach state is editing the shadow of it.
   * Somebody entered before the firm's dialog existed has only the four, and
   * gets the smaller one.
   */
  const editingPerson = people.find((person) => person.id === one(searchParams?.person));
  const asProvider = editingPerson?.providerId
    ? await getProvider(editingPerson.providerId)
    : null;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      {/* Back to where they were opened from, which for a person at a firm is
          the firm, not the directory two steps behind it. */}
      <BackLink
        href={
          provider.firmProviderId
            ? `/whitbyos/providers/${provider.firmProviderId}`
            : "/whitbyos/providers"
        }
        label={provider.firmName ? `Back to ${provider.firmName}` : "Back to Providers"}
      />
      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/whitbyos/providers" className="no-underline" style={{ color: "inherit" }}>
          Providers
        </Link>
        {" / "}
        {provider.firmProviderId && provider.firmName ? (
          <>
            <Link
              href={`/whitbyos/providers/${provider.firmProviderId}`}
              className="no-underline"
              style={{ color: "inherit" }}
            >
              {provider.firmName}
            </Link>
            {" / "}
          </>
        ) : null}
        <span style={{ color: "var(--ink)" }}>{provider.name}</span>
      </div>

      {/*
       * The head of the record sits on something, like everything under it.
       *
       * Parent (firm) wears tan — the mark and the wash. Child (person) wears
       * blue. Same pairing the directory uses for Face.
       */}
      <div
        className="mb-6 flex items-center gap-3.5 rounded-[12px] border border-line px-5 py-4"
        style={{
          background:
            provider.type === "Company"
              ? "linear-gradient(105deg, color-mix(in srgb, var(--avatar-tan-bg) 70%, var(--surface)) 0%, var(--surface) 62%)"
              : "linear-gradient(105deg, color-mix(in srgb, var(--avatar-blue-bg) 55%, var(--surface)) 0%, var(--surface) 62%)",
        }}
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center text-[16px] font-bold ${
            provider.type === "Company" ? "rounded-[10px]" : "rounded-full"
          }`}
          style={
            provider.type === "Company"
              ? { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }
              : { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }
          }
        >
          {initialsOf(provider.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold">{provider.name}</h1>
          <div className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {/* Where they work, for a person who works somewhere. It was the
                heading's only clue and it was not there. */}
            {[
              provider.type,
              provider.type === "Individual" && provider.firmName
                ? `at ${provider.firmName}`
                : null,
              provider.category,
              provider.location,
            ]
              .filter(Boolean)
              .join(" · ") || "No category recorded"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pill tone={readinessTone(provider.readiness)}>
            {readinessLabel(provider.readiness)}
          </Pill>
          {provider.outreach ? <Pill>{outreachLabel(provider.outreach)}</Pill> : null}
          {/* Against the export, for the same reason 4.4 keeps one: an address
              on a screen that cannot be pressed is a copy-and-paste job the
              browser has always done for you. */}
          {provider.email ? (
            <Button unsized
              href={`mailto:${provider.email}`}
              variant="secondary"
              className="ml-1.5 px-3.5 py-[7px] text-[13px]"
            >
              Email
            </Button>
          ) : null}
          <Button unsized
            href={`${here}?edit=1`}
            variant="secondary"
            className="ml-1.5 px-3.5 py-[7px] text-[13px]"
          >
            Edit
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Labelled like everything under it. A specialty printed on its
              own line said "Immigration" and left the reader to work out what
              that was an answer to. */}
          <Section title="Overview" mark={{ glyph: "◈", bg: "var(--accent-tint)", fg: "var(--accent)" }}>
            <Line label="Specialty" value={provider.specialty} />
            {showClients ? (
              <Line label="Available to" value={provider.clientName ?? "Any client"} />
            ) : null}
            <Line label="Next action" value={provider.nextAction} />
          </Section>

          {/* The provider's own way in, which is not any one person's. A
              switchboard, a general inbox, where they actually are. */}
          {/*
           * Named for whose details these are, because the page holds two
           * sets and calls one of them "Point of Contact". "Contact &
           * address" over the firm's own switchboard and general inbox put
           * the same word on both, so the email under it read as the person's
           * and the person's read as a second one of the firm's.
           */}
          <Section
            title={provider.type === "Company" ? "Firm details" : "Their details"}
            mark={{ glyph: "◫", bg: "var(--avatar-tan-bg)", fg: "var(--avatar-tan-fg)" }}
          >
            {/* Used, not only read: the browser has always been able to open
                a site, start a mail and dial a number. */}
            <Line
              label="Email"
              value={provider.ownEmail ? <EmailLink address={provider.ownEmail} /> : null}
            />
            <Line
              label="Phone"
              value={provider.ownPhone ? <PhoneLink number={provider.ownPhone} /> : null}
            />
            <Line
              label="Website"
              value={provider.website ? <WebsiteLink url={provider.website} /> : null}
            />
            <Line label="Address" value={provider.address} />
            <Line label="Service area" value={provider.location} />
          </Section>

          {/* §6.9's question, in the order 5.1 asks it: where they came from,
              whether they were checked, what makes them credible, what they
              will not do, and what nobody has established yet. */}
          <Section
            title="Evidence &amp; Review"
            mark={{ glyph: "✓", bg: "var(--avatar-green-bg)", fg: "var(--avatar-green-fg)" }}
          >
            <Line label="Source" value={sourceLabel(provider.evidenceSource)} />
            <Line label="Verification status" value={readinessLabel(provider.readiness)} />
            <Line
              label="Last reviewed"
              value={provider.lastVerifiedAt ? shortDate(provider.lastVerifiedAt) : null}
            />
            <Line label="Qualifications" value={provider.qualifications} />
            <Line label="Restrictions" value={provider.restrictions} />
            <Line label="Missing information" value={provider.missingInformation} />
          </Section>

          {/* Between what is on the record about them and what has actually
              been done with them: the firm's own account, which is neither. */}
          {/* A firm is people. The provider row keeps one of them as the
              point of contact; this is all of them. */}
          {provider.companyId ? (
            <ProviderPeople
              providerId={providerId}
              companyId={provider.companyId}
              people={people}
              here={here}
            />
          ) : null}

          <ProviderNotes providerId={providerId} notes={notes} />

        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          {/* The control sits here rather than inside Edit. An empty panel
              offering nothing, with the way to fill it behind a button
              labelled for something else, is a panel nobody fills.

              Only for a company: where the provider is a person, `contact_id`
              is that person, and offering to change it would offer to turn the
              provider into somebody else. */}
          <Panel
            title="Point of Contact"
            mark={{ glyph: "✆", bg: "var(--accent-tint)", fg: "var(--accent)" }}
            action={
              provider.companyId ? (
                <Link
                  href={`${here}?contact=1`}
                  className="text-[12.5px] font-medium no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  {provider.contactId ? "Change" : "Add a contact"}
                </Link>
              ) : provider.contactId ? (
                // A provider who is a person: their details are the contact
                // record's own, so the way to fill them in is to open it.
                // Without this the panel is a dead end for individuals in
                // exactly the way it was for companies.
                <Link
                  href={`/whitbyos/contacts/${provider.contactId}`}
                  className="text-[12.5px] font-medium no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  Edit details
                </Link>
              ) : null
            }
          >
            {/* The person first and in the page's own ink, then the two ways
                to reach them under it. They were three equal grey lines, so
                whose details these were took reading to find out. */}
            {provider.contactName ? (
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }}
                >
                  {initialsOf(provider.contactName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                    {provider.contactName}
                  </span>
                  {provider.contactRole ? (
                    <span className="block truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      {provider.contactRole}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}
            {provider.email ? (
              <div className="truncate">
                <EmailLink address={provider.email} />
              </div>
            ) : null}
            {provider.phone ? (
              <div>
                <PhoneLink number={provider.phone} />
              </div>
            ) : null}
            {!provider.contactName && !provider.email && !provider.phone ? (
              <div style={{ color: "var(--text-tertiary)" }}>No contact details recorded.</div>
            ) : null}
          </Panel>

          <Panel
            title="Relationship Owner"
            mark={{ glyph: "◉", bg: "var(--avatar-green-bg)", fg: "var(--avatar-green-fg)" }}
          >
            {provider.ownerName ? (
              <span className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: "var(--avatar-green-bg)", color: "var(--avatar-green-fg)" }}
                >
                  {initialsOf(provider.ownerName)}
                </span>
                <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                  {provider.ownerName}
                </span>
              </span>
            ) : (
              <span style={{ color: "var(--text-tertiary)" }}>Nobody owns this relationship.</span>
            )}
          </Panel>

          <Panel
            title="Documents"
            mark={{ glyph: "❐", bg: "var(--avatar-tan-bg)", fg: "var(--avatar-tan-fg)" }}
          >
            {provider.documents.length === 0 ? (
              <span style={{ color: "var(--text-tertiary)" }}>Nothing on file.</span>
            ) : (
              provider.documents.map((document) => (
                <div key={document.id} className="truncate" title={document.title}>
                  {document.title}
                </div>
              ))
            )}
          </Panel>

          <Panel
            title="Timeline"
            mark={{ glyph: "◷", bg: "var(--avatar-orange-bg)", fg: "var(--avatar-orange-fg)" }}
          >
            {provider.timeline.length === 0 ? (
              <span style={{ color: "var(--text-tertiary)" }}>Nothing has happened yet.</span>
            ) : (
              /*
               * A list, not a paragraph.
               *
               * "Daniel Okafor was added at this provider · 5m ago" wrapped
               * mid-sentence into the next line's opening words, so four
               * events read as one block of prose with dots in it. The time
               * goes under the line it belongs to, and a rule between each
               * says where one thing ends and the next begins.
               */
              <div className="flex flex-col">
                {provider.timeline.map((line, index) => (
                  <div
                    key={line.id}
                    className="py-2"
                    style={{
                      borderTop: index === 0 ? undefined : "1px solid var(--border)",
                    }}
                  >
                    <div className="leading-[1.5]" style={{ color: "var(--ink)" }}>
                      {line.description}
                    </div>
                    <div className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                      {relativeTime(line.at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/*
           * Outreach and Requests belong on this side.
           *
           * The main column is what the provider is: what they do, how to
           * reach them, who is there, what has been said about them. These two
           * are the state of our dealings with them, which is the same kind of
           * thing as the point of contact, the owner and the timeline already
           * standing here.
           */}
          <Panel
            title="Outreach"
            mark={{ glyph: "↗", bg: "var(--avatar-blue-bg)", fg: "var(--avatar-blue-fg)" }}
          >
            <SideLine label="State" value={outreachLabel(provider.outreach)} />
            <SideLine
              label="Last contact"
              value={provider.lastContactDate ? shortDate(provider.lastContactDate) : null}
            />
            <SideLine
              label="Next follow-up"
              value={provider.nextFollowUp ? shortDate(provider.nextFollowUp) : null}
            />
            <SideLine label="Response" value={responseLabel(provider.responseState)} />
          </Panel>

          {/* 5.1 counts these; they are the answer to "has this provider ever
              actually been used", which no other screen gives. */}
          <Panel
            title={`Requests (${provider.requests.length})`}
            mark={{ glyph: "☰", bg: "var(--accent-tint)", fg: "var(--accent)" }}
          >
            {provider.requests.length === 0 ? (
              <span style={{ color: "var(--text-tertiary)" }}>
                Not put in front of a client yet.
              </span>
            ) : (
              <div className="flex flex-col">
                {provider.requests.map((request, index) => (
                  <Link
                    key={request.id}
                    href={`/whitbyos/requests/${request.id}`}
                    className="flex flex-col gap-1 py-2 no-underline"
                    style={{
                      color: "var(--ink)",
                      borderTop: index === 0 ? undefined : "1px solid var(--border)",
                    }}
                  >
                    <span className="truncate text-[12.5px]">{request.title}</span>
                    <span className="flex items-center gap-2">
                      <Pill tone={requestStatusTone(request.status)}>
                        {requestStatusLabel(request.status)}
                      </Pill>
                      <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
                        {optionLabel(request.note)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

        </aside>
      </div>

      {asProvider && provider.companyId ? (
        <EditProviderDialog
          providerId={asProvider.id}
          companyId={asProvider.companyId}
          contactId={asProvider.contactId}
          contacts={[]}
          teammates={teammates}
          categories={categories}
          usedSpecialties={usedSpecialties}
          atFirm={{ id: provider.companyId, name: provider.firmName ?? provider.name }}
          inherit={{
            category:
              asProvider.categoryId ??
              categoryBySlugOrName(categories, asProvider.category)?.id ??
              provider.categoryId,
            location: asProvider.location,
            source: asProvider.evidenceSource,
            readiness: asProvider.readiness,
            outreach: asProvider.outreach,
          }}
          returnTo={here}
          closeHref={here}
          error={error}
          values={{
            name: asProvider.name,
            type: "individual",
            role: editingPerson?.role,
            category:
              asProvider.categoryId ??
              categoryBySlugOrName(categories, asProvider.category)?.id ??
              null,
            location: asProvider.location,
            readiness: asProvider.readiness,
            outreach: asProvider.outreach,
            ownerId: asProvider.ownerId,
            clientId: asProvider.clientId,
            nextAction: asProvider.nextAction,
            qualifications: asProvider.qualifications,
            restrictions: asProvider.restrictions,
            missingInformation: asProvider.missingInformation,
            lastContactDate: asProvider.lastContactDate,
            responseState: asProvider.responseState,
            specialty: asProvider.specialty,
            lastVerifiedAt: asProvider.lastVerifiedAt,
            nextFollowUp: asProvider.nextFollowUp,
            email: asProvider.ownEmail || editingPerson?.email,
            phone: asProvider.ownPhone || editingPerson?.phone,
            website: asProvider.website,
            address: asProvider.address,
          }}
        />
      ) : null}

      {/* Somebody on file as a contact only. The same form, filled in with
          what is known, and saving it gives them the record they lacked. */}
      {editingPerson && !asProvider && provider.companyId ? (
        <AddProviderDialog
          companies={companies}
          teammates={teammates}
          clients={clients}
          categories={categories}
          usedSpecialties={usedSpecialties}
          atFirm={{ id: provider.companyId, name: provider.name }}
          defaultClientId={provider.clientId}
          defaultOwnerId={provider.ownerId}
          firmProviderId={providerId}
          inherit={{
            category: provider.categoryId,
            location: provider.location,
            source: provider.evidenceSource,
            readiness: provider.readiness,
            outreach: provider.outreach,
          }}
          existingContactId={editingPerson.contactId}
          errorTo={`${here}?person=${editingPerson.id}`}
          values={{
            name: editingPerson.name,
            type: "individual",
            role: editingPerson.role,
            email: editingPerson.email,
            phone: editingPerson.phone,
          }}
          returnTo={here}
          closeHref={here}
          error={error}
        />
      ) : null}

      {addingPerson && provider.companyId ? (
        <AddProviderDialog
          companies={companies}
          teammates={teammates}
          clients={clients}
          categories={categories}
          usedSpecialties={usedSpecialties}
          atFirm={{ id: provider.companyId, name: provider.name }}
          defaultClientId={provider.clientId}
          defaultOwnerId={provider.ownerId}
          firmProviderId={providerId}
          inherit={{
            category: provider.categoryId,
            location: provider.location,
            source: provider.evidenceSource,
            readiness: provider.readiness,
            outreach: provider.outreach,
          }}
          returnTo={here}
          errorTo={`${here}?addperson=1`}
          closeHref={here}
          error={error}
        />
      ) : null}

      {choosingContact && provider.companyId ? (
        <SetContactDialog
          providerId={providerId}
          providerName={provider.name}
          contacts={contacts}
          contactId={provider.contactId}
          closeHref={here}
          error={error}
        />
      ) : null}

      {editing ? (
        <EditProviderDialog
          providerId={providerId}
          companyId={provider.companyId}
          contactId={provider.contactId}
          contacts={contacts}
          teammates={teammates}
          categories={categories}
          usedSpecialties={usedSpecialties}
          worksAt={provider.firmName}
          closeHref={here}
          error={error}
          values={{
            name: provider.name,
            type: provider.type === "Company" ? "company" : "individual",
            category:
              provider.categoryId ??
              categoryBySlugOrName(categories, provider.category)?.id ??
              null,
            email: provider.ownEmail,
            phone: provider.ownPhone,
            website: provider.website,
            address: provider.address,
            location: provider.location,
            source: provider.evidenceSource,
            readiness: provider.readiness,
            outreach: provider.outreach,
            ownerId: provider.ownerId,
            nextAction: provider.nextAction,
            qualifications: provider.qualifications,
            restrictions: provider.restrictions,
            missingInformation: provider.missingInformation,
            lastContactDate: provider.lastContactDate,
            responseState: provider.responseState,
            specialty: provider.specialty,
            lastVerifiedAt: provider.lastVerifiedAt,
            nextFollowUp: provider.nextFollowUp,
          }}
        />
      ) : null}

      {saved ? (
        <Toast
          title="Provider updated"
          detail={`${provider.name} has been saved.`}
          closeHref={here}
        />
      ) : null}
    </div>
  );
}

/**
 * A titled panel, with the title on the panel rather than floating above it.
 *
 * The heading used to sit outside the border at the same weight as the page's
 * own, so a column of four read as four little pages. Inside and quieter, they
 * read as what they are: four parts of one record.
 */
/**
 * A mark on each section, in its own colour.
 *
 * Four panels with the same grey head are four things you have to read to tell
 * apart, and on a record somebody opens twenty times a week that is twenty
 * readings of the same four words. The glyph and its colour are found without
 * reading — Overview is the accent, the firm is tan, evidence green, outreach
 * blue — so the eye goes where it meant to go.
 *
 * Tints from the avatar set, which is where the product already keeps quiet
 * colours that sit under text without shouting.
 */
export type SectionMark = { glyph: string; bg: string; fg: string };

function Section({
  title,
  mark,
  children,
}: {
  title: string;
  mark?: SectionMark;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-line" style={{ background: "var(--surface)" }}>
      {/*
       * The head carries the colour too, at a fraction of it.
       *
       * The tints these come from are already pale, and a whole bar of one is
       * louder than a record wants — so it is mixed back into the surface
       * until it is barely there. Enough that the eye lands on the right
       * panel; not so much that the page becomes a set of coloured boxes.
       */}
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-tertiary)",
          background: mark
            ? `color-mix(in srgb, ${mark.bg} 38%, var(--surface))`
            : undefined,
        }}
      >
        {mark ? (
          <span
            aria-hidden
            className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] text-[11px]"
            style={{ background: mark.bg, color: mark.fg }}
          >
            {mark.glyph}
          </span>
        ) : null}
        {title}
      </div>
      <div className="px-4 py-3.5 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

function Panel({
  title,
  mark,
  action,
  children,
}: {
  title: string;
  mark?: SectionMark;
  /** A link in the panel's own heading — where what it holds is set. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-line" style={{ background: "var(--surface)" }}>
      {/* The same head the sections in the main column wear. They were a
          heavier, darker thing over here, so the two columns read as two
          different screens sitting side by side. */}
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{
          borderColor: "var(--border)",
          background: mark
            ? `color-mix(in srgb, ${mark.bg} 38%, var(--surface))`
            : undefined,
        }}
      >
        <span
          className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {mark ? (
            <span
              aria-hidden
              className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] text-[11px]"
              style={{ background: mark.bg, color: mark.fg }}
            >
              {mark.glyph}
            </span>
          ) : null}
          {title}
        </span>
        {action}
      </div>
      <div className="px-4 py-3 text-[12.5px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * One fact, as a label and a value rather than a sentence.
 *
 * These were written "Label: value" in a paragraph at 1.9 line height, so six
 * of them read as prose and the eye had to find each colon to know where the
 * answer started. Two columns: the labels line up, the answers line up, and
 * what is missing is visible at a glance instead of being read for.
 */
function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 py-[5px]">
      <span
        className="w-[150px] shrink-0 text-[12.5px] leading-[1.55]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <span className="min-w-0 flex-1 leading-[1.55]" style={{ color: "var(--ink)" }}>
        {value || <span style={{ color: "var(--text-disabled)" }}>Not recorded</span>}
      </span>
    </div>
  );
}


/** `Line`, at the width the side column has: label over value, not beside it. */
function SideLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-[3px]">
      <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <span className="min-w-0 text-right" style={{ color: "var(--ink)" }}>
        {value ?? <span style={{ color: "var(--text-disabled)" }}>Not recorded</span>}
      </span>
    </div>
  );
}

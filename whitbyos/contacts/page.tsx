import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import { DataTable, DataTableCell, DataTableRow, type Column } from "@/whitbyos/components/DataTable";
import { AddContactDialog } from "@/whitbyos/contacts/components/AddContactDialog";
import {
  ArchiveOrDeleteDialog,
  ArchiveOrDeleteLink,
} from "@/whitbyos/components/ArchiveOrDelete";
import { archiveContact } from "@/whitbyos/contacts/actions";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { relativeTime } from "@/whitbyos/lib/format";
import {
  contactsReachable,
  listCompanies,
  listPeople,
  listRecent,
} from "@/whitbyos/lib/contacts";
import { ROLES, initialsOf, roleLabel, roleTone } from "@/whitbyos/lib/contact-vocab";
import { FilterSelect } from "@/whitbyos/components/FilterSelect";
import { SearchField } from "@/whitbyos/components/SearchField";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { NavIcon } from "@/base/components/NavIcons";
import { LiveSearch } from "@/whitbyos/components/LiveSearch";

const LIST = "/whitbyos/contacts";

// 4 draws three, and Companies is not one of them: a company is a row in the
// All Contacts table now, told apart by its Type rather than by its own tab.
const TABS = [
  { slug: "", label: "All Contacts" },
  { slug: "people", label: "People" },
  { slug: "recent", label: "Recent" },
] as const;

/** 4 — one table for both kinds. Trailing holds View + archive. */
const ALL_COLUMNS: Column[] = [
  { label: "Name", width: "2.2fr" },
  { label: "Type", width: "0.9fr" },
  { label: "Relationship", width: "1.6fr" },
  { label: "Linked Client", width: "1.6fr" },
  { label: "Last Activity", width: "1fr" },
  { label: "", width: "108px" },
];

const PEOPLE_COLUMNS: Column[] = [
  { label: "Name", width: "2.2fr" },
  { label: "Company / Role", width: "1.2fr" },
  { label: "Relationship", width: "1.6fr" },
  { label: "Linked Client", width: "1.6fr" },
  { label: "Last Activity", width: "1fr" },
  { label: "", width: "108px" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Face({ name, kind }: { name: string; kind: "person" | "company" }) {
  const company = kind === "company";
  return (
    <span
      aria-hidden
      className={`flex h-8 w-8 shrink-0 items-center justify-center text-[11px] font-bold ${
        company ? "rounded-[8px]" : "rounded-full"
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

/**
 * Screens 4.1–4.3 — the relationship address book.
 *
 * All Contacts = people + companies. People = persons only. Recent = latest
 * touch on that same pool. Providers, client organisations and teammates are
 * kept out — each has its own page.
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const tab = (one(searchParams?.tab) ?? "") as (typeof TABS)[number]["slug"];
  const search = one(searchParams?.q)?.trim() ?? "";
  const adding = one(searchParams?.new) === "1";
  const created = one(searchParams?.created);
  const error = one(searchParams?.error);

  /*
   * Whose work this screen is showing is not this screen's question any more.
   * It is chosen once on Workspace Overview and answered the same way
   * everywhere — see `lib/open-client.ts`.
   */
  const client = (await getOpenClientId()) ?? "";
  const showClients = await usesClientWorkspaces();
  /* Linked Client stays visible: some rows are tied to a client, some are not. */
  const showLinkedClient = showClients;
  const type = one(searchParams?.type) ?? "";
  const relationship = one(searchParams?.relationship) ?? "";
  const removing = one(searchParams?.remove) ?? "";

  const wantsPeople = tab === "" || tab === "people" || tab === "recent";
  const wantsCompanies = tab === "" || tab === "recent";

  const [peopleRaw, companiesRaw, recentRaw, unreachable, clientOptions] = await Promise.all([
    wantsPeople ? listPeople(search) : Promise.resolve([]),
    wantsCompanies ? listCompanies(search) : Promise.resolve([]),
    tab === "recent" ? listRecent() : Promise.resolve([]),
    contactsReachable(),
    listClientOptions(),
  ]);

  /*
   * With a client open: that client's people, and anyone not linked yet.
   * A contact does not have to belong to a client — firm-wide / unlinked
   * rows stay on the list. Other clients' people stay out of the way.
   *
   * Providers are already kept out of `listPeople` / `listCompanies`.
   */
  const people = peopleRaw.filter(
    (row) => !client || !row.clientId || row.clientId === client,
  );
  const companies = companiesRaw;

  // 4 merges the two into one list, newest first, which is the only order that
  // makes sense once they share a table.
  const everyone = [
    ...people.map((row) => ({
      key: `person-${row.id}`,
      href: `${LIST}/${row.id}`,
      name: row.name,
      type: "Person" as const,
      relationship: row.role,
      relationshipLabel: roleLabel(row.role),
      clientId: row.clientId,
      clientName: row.clientName,
      updated_at: row.updated_at,
    })),
    ...companies.map((row) => ({
      key: `company-${row.id}`,
      href: undefined as string | undefined,
      name: row.name,
      type: "Company" as const,
      relationship: row.status.toLowerCase(),
      relationshipLabel: row.status,
      clientId: null as string | null,
      clientName: row.clientName,
      updated_at: row.updated_at,
    })),
  ]
    .filter((row) => !type || row.type === type)
    .filter((row) => !relationship || row.relationship === relationship)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

  const personById = new Map(peopleRaw.map((row) => [row.id, row]));
  const recent = recentRaw.filter((row) => {
    if (!client) return true;
    if (row.kind === "person") {
      const link = personById.get(row.id);
      return !link?.clientId || link.clientId === client;
    }
    return true;
  });

  const removingRow = removing
    ? everyone.find((row) => row.key === `person-${removing}`)
    : undefined;

  const total =
    tab === "recent" ? recent.length : tab === "people" ? people.length : everyone.length;

  const filters = new URLSearchParams();
  if (client) filters.set("client", client);
  if (type) filters.set("type", type);
  if (relationship) filters.set("relationship", relationship);
  const href = (slug: string) => {
    const query = new URLSearchParams(filters);
    if (slug) query.set("tab", slug);
    const built = query.toString();
    return built ? `${LIST}?${built}` : LIST;
  };

  const allColumns = (showLinkedClient ? ALL_COLUMNS : ALL_COLUMNS.filter((column) => column.label !== "Linked Client"));
  const peopleColumns = (showLinkedClient ? PEOPLE_COLUMNS : PEOPLE_COLUMNS.filter((column) => column.label !== "Linked Client"));

  // Every other module has one; this had none, so a failure here read as an
  // address book that happened to be empty.
  if (unreachable) {
    return (
      <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Contacts. Check your connection and try again. If this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Contacts%20failed%20to%20load"
                variant="secondary"
                className="px-4 py-[9px]"
              >
                Contact support
              </Button>
              <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px]">
                Try again
              </Button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-full px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <div className="mb-6 flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          <NavIcon href="/whitbyos/contacts" label="Contacts" />
        </span>
        <div className="min-w-0 flex-1">
          <PageHeader
            title="Contacts"
            subtitle="Relationship people and companies. Providers, clients and team live on their own pages."
            size={22}
            gap={20}
            action={
              <Button
                href={`${LIST}?new=1`}
                variant="primary"
                unsized
                className="px-4 py-[9px] text-[14px]"
              >
                + Add Contact
              </Button>
            }
          />
        </div>
      </div>

      <div className="mb-5 flex gap-6 border-b border-line">
        {TABS.map((item) => {
          const active = item.slug === tab;
          return (
            <Link
              key={item.label}
              href={href(item.slug)}
              className="pb-2.5 text-[13.5px] no-underline"
              style={{
                color: active ? "var(--ink)" : "var(--text-tertiary)",
                fontWeight: active ? 600 : 400,
                borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* 4 filters by type and relationship; 4.1 carries only the
          relationship, because a People tab has already answered the type. */}
      {tab !== "recent" ? (
        <form
          action={LIST}
          className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[10px] border px-3.5 py-3"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "rgba(255,255,255,.88)",
          }}
        >
          {tab ? <input type="hidden" name="tab" value={tab} /> : null}
          <SearchField
            defaultValue={search}
            placeholder={tab === "people" ? "Search people…" : "Search contacts…"}
            label="Search contacts"
            className="w-[260px]"
          />
          {/* Narrows as you type — see `LiveSearch`. */}
          <LiveSearch />
          {tab === "" ? (
            <FilterSelect
              name="type"
              value={type}
              all="All types"
              options={[
                { value: "Person", label: "Person" },
                { value: "Company", label: "Company" },
              ]}
            />
          ) : null}
          <FilterSelect
            name="relationship"
            value={relationship}
            all="All relationships"
            options={ROLES.filter((role) => role.value !== "provider")}
          />
          <span
            className="ml-auto text-[12px] font-medium tabular-nums"
            style={{ color: "var(--text-tertiary)" }}
          >
            {total} {total === 1 ? "contact" : "contacts"}
          </span>
        </form>
      ) : null}

      {total === 0 ? (
        <div
          className="rounded-[12px] border px-8 py-10"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
          }}
        >
          <StateMessage
            glyph="⚇"
            title={
              search
                ? `No matches for “${search}”`
                : "No contacts yet"
            }
            description={
              search
                ? "Try a different name, or clear the search to see everyone."
                : "Add relationship people and companies here. Providers, clients and teammates stay on their own pages."
            }
            action={
              <Button unsized
                href={search ? href(tab) : `${LIST}?new=1`}
                variant="primary"
                className="px-5 py-2.5 text-[13.5px]"
              >
                {search ? "Clear search" : "+ Add contact"}
              </Button>
            }
          />
        </div>
      ) : tab === "recent" ? (
        <div
          className="overflow-hidden rounded-[12px] border"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
            boxShadow: "0 1px 2px rgba(31,72,125,.04)",
          }}
        >
          <ShowMore step={8}>
            {recent.map((row) => (
              <Link
                key={`${row.kind}-${row.id}`}
                href={row.href}
                className="flex items-center gap-3 border-b px-4 py-3 no-underline last:border-b-0"
                style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
              >
                <Face name={row.name} kind={row.kind === "company" ? "company" : "person"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{row.name}</span>
                  <span
                    className="block truncate text-[12px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {row.detail}
                  </span>
                </span>
                <span className="shrink-0 text-[12px]" style={{ color: "var(--text-disabled)" }}>
                  {relativeTime(row.at)}
                </span>
              </Link>
            ))}
          </ShowMore>
        </div>
      ) : tab === "" ? (
        <DataTable columns={allColumns} rowPadding={12}>
          <ShowMore step={8}>
            {everyone.map((row) => (
              <DataTableRow
                key={row.key}
                href={row.href}
                trailing={
                  <span className="flex items-center gap-1.5">
                    {row.href ? (
                      <Link
                        href={row.href}
                        className="rounded-control border px-2.5 py-[5px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
                        style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
                      >
                        View
                      </Link>
                    ) : null}
                    {row.type === "Person" ? (
                      <ArchiveOrDeleteLink
                        href={`${href("")}${href("").includes("?") ? "&" : "?"}remove=${row.key.replace("person-", "")}`}
                        label="Archive contact"
                      />
                    ) : null}
                  </span>
                }
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Face name={row.name} kind={row.type === "Company" ? "company" : "person"} />
                  <DataTableCell emphasis="strong">{row.name}</DataTableCell>
                </span>
                <DataTableCell>{row.type}</DataTableCell>
                <DataTableCell>
                  {row.relationshipLabel ? (
                    <Pill tone={roleTone(row.relationship)}>{row.relationshipLabel}</Pill>
                  ) : null}
                </DataTableCell>
                {showLinkedClient ? (
                  <DataTableCell>{row.clientName ?? "No client"}</DataTableCell>
                ) : null}
                <DataTableCell emphasis="muted">{relativeTime(row.updated_at)}</DataTableCell>
              </DataTableRow>
            ))}
          </ShowMore>
        </DataTable>
      ) : (
        <DataTable columns={peopleColumns} rowPadding={12}>
          <ShowMore step={8}>
            {people.map((person) => (
              <DataTableRow
                key={person.id}
                href={`${LIST}/${person.id}`}
                trailing={
                  <span className="flex items-center gap-1.5">
                    <Link
                      href={`${LIST}/${person.id}`}
                      className="rounded-control border px-2.5 py-[5px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
                      style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
                    >
                      View
                    </Link>
                    <ArchiveOrDeleteLink
                      href={`${href("people")}${href("people").includes("?") ? "&" : "?"}remove=${person.id}`}
                      label="Archive contact"
                    />
                  </span>
                }
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Face name={person.name} kind="person" />
                  <DataTableCell emphasis="strong">{person.name}</DataTableCell>
                </span>
                <DataTableCell>{person.companyRole ?? "No role"}</DataTableCell>
                <span>
                  {person.role ? (
                    <Pill tone={roleTone(person.role)}>{roleLabel(person.role)}</Pill>
                  ) : null}
                </span>
                {showLinkedClient ? (
                  <DataTableCell>{person.clientName ?? "No client"}</DataTableCell>
                ) : null}
                <DataTableCell emphasis="muted">{relativeTime(person.updated_at)}</DataTableCell>
              </DataTableRow>
            ))}
          </ShowMore>
        </DataTable>
      )}

      {removingRow ? (
        <ArchiveOrDeleteDialog
          title={`Archive ${removingRow.name}?`}
          lead={
            removingRow.relationship === "primary_contact"
              ? "This contact is the Primary Contact on a linked Client."
              : "This contact has linked records. Choose what to remove:"
          }
          linked={
            <>
              Linked:{" "}
              <strong style={{ color: "var(--ink)" }}>
                {removingRow.clientName ?? "No client"}
              </strong>{" "}
              (Client), Requests and Messages addressed to this person.
            </>
          }
          archiveLabel="Archive this contact"
          archiveDetail={`${removingRow.clientName ?? "The client"} and its Requests stay linked. Unarchive anytime from Settings → Archive`}
          deleteDetail={
            removingRow.relationship === "primary_contact"
              ? `Also removes ${removingRow.clientName ?? "the client"} and its Requests, Work Plans and Documents. This can't be undone.`
              : "Removes this contact and its links. This can't be undone."
          }
          archiveAction={archiveContact}
          hidden={{ contact_id: removingRow.key.replace("person-", "") }}
          closeHref={href(tab)}
        />
      ) : null}

      {adding ? (
        <AddContactDialog
          clients={clientOptions}
          defaultClientId={client || null}
          closeHref={href(tab)}
          error={error}
        />
      ) : null}

      {created ? (
        <Toast
          title="Contact added"
          detail={`"${created}" is now in your contacts.`}
          closeHref={href(tab)}
        />
      ) : null}
    </div>
  );
}

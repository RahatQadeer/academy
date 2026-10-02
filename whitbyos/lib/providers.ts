import { createClient } from "@/base/lib/supabase/server";
import { listCategories } from "@/whitbyos/lib/taxonomy";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import type { LinkedRequest, TimelineLine } from "@/whitbyos/lib/contacts";

export type ProviderRow = {
  id: string;
  name: string;
  /** 5 draws this: a provider is a company or a person, never both. */
  type: "Company" | "Individual";
  category: string | null;
  /** Null when the provider is available to every client. */
  clientName: string | null;
  /**
   * The company provider this one works at, when it is a person who does.
   *
   * The list nests them: a firm at the left margin with its own people under
   * it, and anybody independent at the left margin too, because they are not
   * under anybody.
   */
  parentId: string | null;
  /** Which company row this is or belongs to, for pairing the two up. */
  companyId: string | null;
  /** The person this provider is, when it is one. */
  contactId: string | null;
  readiness: string;
  outreach: string | null;
  ownerName: string | null;
  updated_at: string;
};

/**
 * Somebody at a provider company who is not a provider themselves.
 *
 * They hang off the firm's row in the list. The link goes to their contact
 * record, because that is what they are: a person the workspace holds, filed
 * at this firm.
 */
export type ProviderChild = {
  id: string;
  parentId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  href: string;
};

export type ProviderFilters = {
  q?: string;
  type?: string;
  category?: string;
  readiness?: string;
  outreach?: string;
};

export type ProviderListResult =
  | { ok: true; rows: ProviderRow[]; people: ProviderChild[]; categories: string[] }
  | { ok: false; error: string };

/**
 * Whose name a provider row carries.
 *
 * A person at a firm has both a contact and a company: the contact is who they
 * are, the company is where they work. Reading the company first made every
 * one of them show the firm's name.
 */
export function nameOfProvider(
  kind: string | null,
  company: { name?: string | null } | null,
  contact: {
    first_name?: string | null;
    last_name?: string | null;
    preferred_name?: string | null;
  } | null,
) {
  const person =
    contact?.preferred_name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
    "";

  if (kind === "individual") return person || company?.name || "Unnamed provider";
  return company?.name || person || "Unnamed provider";
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Screen 14 — the workspace's provider directory.
 *
 * `whitbyos_providers` has no workspace column of its own, so a provider is
 * this workspace's when the company or contact behind it is. Migration 011 adds
 * the column and the policy to match; until it runs, this filter is the only
 * thing separating one professional's directory from another's, because the
 * table's own policy in base admits every signed-in user.
 */
export async function listProviders(
  filters: ProviderFilters = {},
): Promise<ProviderListResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [], people: [], categories: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whitbyos_providers")
    .select(
      "id, kind, readiness, outreach_status, specialty_capability, category_id, client_id, relationship_owner_user_id, updated_at, company_id, contact_id, client:whitbyos_clients!client_id (id, name), company:companies!company_id (id, name, industry_type, created_by_workspace_id), contact:contacts!contact_id (id, first_name, last_name, preferred_name, title_role, created_by_workspace_id)",
    )
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  type Company = { id: string; name: string; industry_type: string | null; created_by_workspace_id: string | null };
  type Contact = {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    title_role: string | null;
    created_by_workspace_id: string | null;
  };

  /*
   * The taxonomy decides what a category is called.
   *
   * `industry_type` and `title_role` are where the old six-word dropdown wrote
   * its answer, and providers filed before this change still carry it. They
   * stay as the fallback, so nothing that was already typed goes blank, but a
   * provider with a `category_id` is read from the taxonomy, which is the only
   * one of the three that can be renamed in one place.
   */
  const categoryNames = new Map(
    (await listCategories()).map((category) => [category.id, category.name]),
  );

  /*
   * Whose provider this is, at last.
   *
   * `client_id` has been on the table since migration 045 and nothing had ever
   * read it — a provider filed to one client and one filed to none looked
   * exactly alike on every screen, which is why the field on Add Provider did
   * nothing at all. A provider with no client is the firm's and every client
   * may be sent to them; one with a client is theirs alone, and is kept out of
   * everybody else's directory.
   */
  const openClientId = await getOpenClientId();

  /*
   * Who owns the relationship, which the list had a column for and no answer.
   *
   * `ownerName` was written `null` here, so every row read "Unassigned" no
   * matter who the detail screen showed beside it. One lookup for the whole
   * page rather than a join: the owners are teammates, there are a handful of
   * them, and the same few names repeat down the column.
   */
  const owners = new Map((await listTeammates()).map((mate) => [mate.id, mate.name]));

  const rows: ProviderRow[] = [];

  for (const row of data ?? []) {
    const company = firstOf(row.company as unknown as Company | Company[] | null);
    const contact = firstOf(row.contact as unknown as Contact | Contact[] | null);

    const mine =
      company?.created_by_workspace_id === workspaceId ||
      contact?.created_by_workspace_id === workspaceId;
    if (!mine) continue;

    const forClient = (row.client_id as string | null) ?? null;
    // With one client open: theirs, and the firm's. Never another client's.
    if (openClientId && forClient && forClient !== openClientId) continue;

    const name = nameOfProvider(row.kind as string | null, company, contact);

    rows.push({
      id: row.id as string,
      name,
      /*
       * `kind` says which it is, rather than the columns being read for a
       * hint. A person at a firm now carries both a contact and a company, so
       * "has a company, therefore is one" stopped being true the moment that
       * became possible. Rows written before it fall back to the old guess,
       * which is still right for them.
       */
      type:
        row.kind === "individual"
          ? "Individual"
          : row.kind === "company"
            ? "Company"
            : company
              ? "Company"
              : "Individual",
      category:
        categoryNames.get((row.category_id as string | null) ?? "") ??
        company?.industry_type ??
        contact?.title_role ??
        null,
      clientName:
        firstOf(row.client as unknown as { name: string } | { name: string }[] | null)
          ?.name ?? null,
      parentId: null,
      companyId: (row.company_id as string | null) ?? null,
      contactId: (row.contact_id as string | null) ?? null,
      readiness: (row.readiness as string) ?? "prospect",
      outreach: (row.outreach_status as string | null) ?? null,
      ownerName:
        owners.get((row.relationship_owner_user_id as string | null) ?? "") ?? null,
      updated_at: row.updated_at as string,
    });
  }

  const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[];

  /*
   * Pairing people to the firms they are at.
   *
   * An individual provider's `company_id` is the firm they work at; a company
   * provider's is the firm it is. Where those match, one belongs under the
   * other. A person at a firm the directory does not hold stays at the left
   * margin: there is nothing to put them under.
   */
  const firmsByCompany = new Map(
    rows
      .filter((row) => row.type === "Company" && row.companyId)
      .map((row) => [row.companyId as string, row.id]),
  );

  for (const row of rows) {
    if (row.type !== "Individual" || !row.companyId) continue;
    const firm = firmsByCompany.get(row.companyId);
    if (firm && firm !== row.id) row.parentId = firm;
  }

  /*
   * And everybody else at those firms.
   *
   * Not only the people who are providers in their own right: the whole of a
   * firm's `company_contacts`, which is what the People panel writes. A
   * directory that shows Ahmed & Partners and hides the six people you
   * actually ring is a directory of names of buildings.
   *
   * Somebody who is both — filed at the firm and a provider themselves — is
   * listed once, as the provider, because that row says more.
   */
  const companyIds = rows
    .filter((row) => row.type === "Company" && row.companyId)
    .map((row) => row.companyId as string);

  const people: ProviderChild[] = [];

  if (companyIds.length) {
    const { data: staff } = await supabase
      .from("company_contacts")
      .select(
        "id, company_id, contact_id, title_function, is_primary, contact:contacts!contact_id (id, first_name, last_name, preferred_name, email, phone)",
      )
      .in("company_id", companyIds);

    const alreadyProviders = new Set(
      rows.filter((row) => row.type === "Individual").map((row) => row.contactId),
    );

    for (const link of staff ?? []) {
      const contact = firstOf(
        link.contact as unknown as
          | { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null; email: string | null; phone: string | null }
          | null,
      );
      if (!contact) continue;
      if (alreadyProviders.has(contact.id)) continue;

      const parent = firmsByCompany.get(link.company_id as string);
      if (!parent) continue;

      people.push({
        id: link.id as string,
        parentId: parent,
        name:
          contact.preferred_name ||
          [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
          "Contact",
        role: (link.title_function as string | null) ?? null,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        isPrimary: Boolean(link.is_primary),
        href: `/whitbyos/contacts/${contact.id}`,
      });
    }
  }

  const search = filters.q?.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (search && !row.name.toLowerCase().includes(search)) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.readiness && row.readiness !== filters.readiness) return false;
    if (filters.outreach && row.outreach !== filters.outreach) return false;
    return true;
  });

  /* A person is shown when the firm they are at is. */
  const shown = new Set(filtered.map((row) => row.id));

  return {
    ok: true,
    rows: filtered,
    people: people.filter((person) => shown.has(person.parentId)),
    categories: categories.sort(),
  };
}

export type ProviderDetail = ProviderRow & {
  companyId: string | null;
  contactId: string | null;
  /** The taxonomy id, which is what Edit reopens on. `category` is its name. */
  categoryId: string | null;
  /** The client this provider is kept for, when it is kept for one. */
  clientId: string | null;
  /** The firm a person works at, when the provider is a person who does. */
  firmName: string | null;
  /** That firm's own provider record, so the page can lead back to it. */
  firmProviderId: string | null;
  /** The provider's own, as distinct from whichever contact is linked. */
  ownEmail: string | null;
  ownPhone: string | null;
  website: string | null;
  address: string | null;
  location: string | null;
  ownerId: string | null;
  specialty: string | null;
  evidenceSource: string | null;
  lastVerifiedAt: string | null;
  nextFollowUp: string | null;
  email: string | null;
  phone: string | null;
  optionCount: number;
  /** 5.1's six fields, added by migration 051. */
  nextAction: string | null;
  qualifications: string | null;
  restrictions: string | null;
  missingInformation: string | null;
  lastContactDate: string | null;
  responseState: string | null;
  /** The Point of Contact panel: who to speak to, and what they do there. */
  contactName: string | null;
  contactRole: string | null;
  /** The Relationship Owner panel — a teammate, not a contact. */
  ownerName: string | null;
  /** The requests this provider has been put in front of a client on. */
  requests: LinkedRequest[];
  /** Filed against the provider's company or its contact. */
  documents: { id: string; title: string }[];
  timeline: TimelineLine[];
};

/** Screen 14a — one provider, and the evidence behind trusting them. */
export async function getProvider(providerId: string): Promise<ProviderDetail | null> {
  const list = await listProviders();
  if (!list.ok) return null;

  const summary = list.rows.find((row) => row.id === providerId);
  if (!summary) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_providers")
    .select(
      "id, kind, company_id, contact_id, category_id, client_id, location, company:companies!company_id (name), relationship_owner_user_id, specialty_capability, email, phone, website, address, evidence_source, last_verified_at, next_follow_up_date, next_action, qualifications, restrictions, missing_information, last_contact_date, response_state, contact:contacts!contact_id (first_name, last_name, preferred_name, title_role, email, phone)",
    )
    .eq("id", providerId)
    .maybeSingle();

  const contact = firstOf(
    data?.contact as unknown as {
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      title_role: string | null;
      email: string | null;
      phone: string | null;
    } | null,
  );

  // 5.1's "Requests (2)": every time this provider was put in front of a
  // client, and what came of it. The option's own status is the note beside
  // the request, because that is the part about this provider.
  const { data: options } = await supabase
    .from("whitbyos_provider_options")
    .select(
      "id, status, request:whitbyos_requests!request_id (id, title, status, target_date)",
    )
    .eq("provider_id", providerId);

  const requests: LinkedRequest[] = (options ?? []).flatMap((row) => {
    const request = firstOf(
      row.request as unknown as {
        id: string;
        title: string | null;
        status: string | null;
        target_date: string | null;
      } | null,
    );
    if (!request) return [];
    return [
      {
        id: request.id,
        title: request.title ?? "Untitled request",
        status: request.status ?? "",
        targetDate: request.target_date ?? null,
        note: (row.status as string | null) ?? null,
        nextAction: null,
      },
    ];
  });

  // A provider is a company or a person, so its documents are whatever is
  // filed against whichever of the two it is. `document_context_type` already
  // has both; it has no `provider`, and adding one would file the same paper
  // in two places.
  const contexts: [string, string][] = [];
  if (data?.company_id) contexts.push(["company", data.company_id as string]);
  if (data?.contact_id) contexts.push(["contact", data.contact_id as string]);

  const documentRows = await Promise.all(
    contexts.map(([type, id]) =>
      supabase
        .from("documents")
        .select("id, title")
        .eq("context_type", type)
        .eq("context_id", id)
        .order("created_at", { ascending: false })
        .limit(6),
    ),
  );

  const { data: owner } = data?.relationship_owner_user_id
    ? await supabase
        .from("users")
        .select("full_name, preferred_name, email")
        .eq("id", data.relationship_owner_user_id as string)
        .maybeSingle()
    : { data: null };

  /*
   * The provider's own history, and the Requests it has been on.
   *
   * This read only the second, so a provider never put in front of a client
   * showed "Nothing has happened yet" however much had happened to it: added,
   * people filed, a point of contact chosen, notes written. Both now, newest
   * first, because both are things that happened to this provider.
   */
  const requestIds = requests.map((row) => row.id);
  const { data: events } = await supabase
    .from("whitbyos_timeline_events")
    .select("id, description, created_at")
    .or(
      requestIds.length
        ? `provider_id.eq.${providerId},request_id.in.(${requestIds.join(",")})`
        : `provider_id.eq.${providerId}`,
    )
    .order("created_at", { ascending: false })
    .limit(8);

  /*
   * The firm's own row, for somebody who works at one.
   *
   * A person opened from their firm's People panel had "Back to Providers"
   * over them and a trail that skipped the firm entirely, so the way back was
   * the directory and then finding the firm again.
   */
  const worksAt =
    (data?.kind as string | null) === "individual" && data?.company_id
      ? await supabase
          .from("whitbyos_providers")
          .select("id, kind")
          .eq("company_id", data.company_id as string)
          .is("archived_at", null)
      : { data: null };

  const firmRow = (worksAt.data ?? []).find(
    (row) => row.id !== providerId && row.kind !== "individual",
  );

  const count = requests.length;

  return {
    ...summary,
    companyId: (data?.company_id as string | null) ?? null,
    contactId: (data?.contact_id as string | null) ?? null,
    categoryId: (data?.category_id as string | null) ?? null,
    clientId: (data?.client_id as string | null) ?? null,
    firmProviderId: (firmRow?.id as string | undefined) ?? null,
    firmName:
      (data?.kind as string | null) === "individual"
        ? (firstOf(
            data?.company as unknown as { name: string } | { name: string }[] | null,
          )?.name ?? null)
        : null,
    ownEmail: (data?.email as string | null) ?? null,
    ownPhone: (data?.phone as string | null) ?? null,
    website: (data?.website as string | null) ?? null,
    address: (data?.address as string | null) ?? null,
    location: (data?.location as string | null) ?? null,
    ownerId: (data?.relationship_owner_user_id as string | null) ?? null,
    specialty: (data?.specialty_capability as string | null) ?? null,
    evidenceSource: (data?.evidence_source as string | null) ?? null,
    lastVerifiedAt: (data?.last_verified_at as string | null) ?? null,
    nextFollowUp: (data?.next_follow_up_date as string | null) ?? null,
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
    optionCount: count,
    nextAction: (data?.next_action as string | null) ?? null,
    qualifications: (data?.qualifications as string | null) ?? null,
    restrictions: (data?.restrictions as string | null) ?? null,
    missingInformation: (data?.missing_information as string | null) ?? null,
    lastContactDate: (data?.last_contact_date as string | null) ?? null,
    responseState: (data?.response_state as string | null) ?? null,
    contactName:
      [contact?.preferred_name || contact?.first_name, contact?.last_name]
        .filter(Boolean)
        .join(" ") || null,
    contactRole: contact?.title_role ?? null,
    ownerName:
      (owner?.preferred_name as string | null) ||
      (owner?.full_name as string | null) ||
      (owner?.email as string | null) ||
      null,
    requests,
    documents: documentRows.flatMap(({ data: rows }) =>
      (rows ?? []).map((row) => ({ id: row.id as string, title: (row.title as string) ?? "Document" })),
    ),
    timeline: (events ?? []).map((row) => ({
      id: row.id as string,
      description: (row.description as string) ?? "Activity",
      at: row.created_at as string,
    })),
  };
}

/** The Add dialog's company list — every company this workspace has recorded. */
/**
 * The companies this firm already has, and which of them are already here.
 *
 * `companies` is base's, shared with Clients, Contacts and the Partner Center,
 * so Add Provider asks before it writes: naming one that exists would make a
 * second row for the same firm and split its work between them.
 *
 * `isProvider` is the other half, and it was missing. The list offered every
 * company including the ones already in this directory, so choosing one and
 * pressing Add filed the same company as a provider twice, with nothing
 * stopping it and nothing afterwards saying which was which.
 */
export type CompanyOption = { id: string; name: string; isProvider: boolean };

export async function listCompanyOptions(): Promise<CompanyOption[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name")
    .eq("created_by_workspace_id", workspaceId)
    .order("name");

  const companies = data ?? [];
  if (companies.length === 0) return [];

  const { data: filed } = await supabase
    .from("whitbyos_providers")
    .select("company_id")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .not("company_id", "is", null);

  // Archived ones are left out: filing them again is how somebody brings a
  // provider back, and refusing that would leave them no way to.
  const already = new Set((filed ?? []).map((row) => row.company_id as string));

  return companies.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    isProvider: already.has(row.id as string),
  }));
}


/** The Relationship Owner list on 5.0a and 5.1a — this workspace's own people. */
export async function listTeammates(): Promise<{ id: string; name: string }[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  const ids = (members ?? []).map((row) => row.user_id as string);
  if (ids.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, preferred_name, email")
    .in("id", ids);

  return (users ?? []).map((row) => ({
    id: row.id as string,
    name:
      (row.preferred_name as string) ||
      (row.full_name as string) ||
      (row.email as string) ||
      "Teammate",
  }));
}



export type ProviderDocumentContext = {
  providerId: string;
  contextType: "company" | "contact";
  contextId: string;
  name: string;
};

/**
 * Where a provider's paperwork is filed, for the screens that file and list it.
 *
 * A provider is a company or a person, so its documents hang off whichever of
 * the two it is — `document_context_type` has had `company` and `contact` since
 * the schema was written, and the provider screen has always read them. What
 * was missing was both ends: Upload could only offer a Client or a Request, so
 * nothing could be filed this way, and the Documents list only reached client
 * and request ids, so anything filed this way would have been invisible there
 * even if it existed.
 *
 * One helper for both, because a place you can file into and a place you can
 * read out of have to be the same list or documents go missing.
 */
export async function listProviderDocumentContexts(): Promise<ProviderDocumentContext[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_providers")
    .select(
      "id, kind, company_id, contact_id, company:companies!company_id (name), contact:contacts!contact_id (first_name, last_name, preferred_name)",
    )
    .eq("workspace_id", workspaceId)
    .is("archived_at", null);

  return (data ?? []).flatMap((row) => {
    /*
     * Whose paperwork this is.
     *
     * Both columns can be filled now — a person at a firm has a contact and a
     * company — so "whichever is set" is no longer an answer. A person's
     * documents are the person's; a firm's are the firm's, and `kind` says
     * which the row is.
     */
    const companyId = (row.company_id as string | null) ?? null;
    const contactId = (row.contact_id as string | null) ?? null;
    const individual = row.kind === "individual";
    const contextId = individual ? (contactId ?? companyId) : (companyId ?? contactId);
    if (!contextId) return [];

    const company = firstOf(row.company as { name?: string | null } | { name?: string | null }[] | null);
    const contact = firstOf(
      row.contact as
        | { first_name?: string | null; last_name?: string | null; preferred_name?: string | null }
        | { first_name?: string | null; last_name?: string | null; preferred_name?: string | null }[]
        | null,
    );

    const name = nameOfProvider(
      row.kind as string | null,
      company as { name?: string | null } | null,
      contact,
    );

    return [
      {
        providerId: row.id as string,
        contextType:
          contextId === contactId ? ("contact" as const) : ("company" as const),
        contextId,
        name,
      },
    ];
  });
}

/** A provider as the drafter needs to see it, and as a plan needs to use it. */
export type DraftableProvider = {
  id: string;
  name: string;
  category: string | null;
  specialty: string | null;
  location: string | null;
  readiness: string;
  email: string | null;
  phone: string | null;
};

/**
 * The firm's own providers, for drafting a plan against.
 *
 * A drafted step could say "you will need an immigration solicitor" and that
 * was the end of it — the workspace's own directory, with people who have
 * actually been screened and whose numbers somebody here has dialled, was
 * never consulted. Meanwhile the plan's contact details came from a web
 * search, which is the weaker source for anything the firm already knows.
 *
 * Excluded providers are left out: the firm has decided against them, and a
 * plan proposing one is worse than a plan proposing nobody. Inactive ones are
 * left out for the same reason in a softer form.
 *
 * The contact details travel with the row but are deliberately *not* put in
 * front of the model. It picks a provider by name; the number is then read
 * from this record. That way the firm's own phone number cannot be garbled by
 * a model retyping it.
 */
export async function listDraftableProviders(): Promise<DraftableProvider[]> {
  const listed = await listProviders();
  if (!listed.ok) return [];

  const usable = listed.rows.filter(
    (row) => !["excluded", "inactive"].includes(row.readiness.toLowerCase()),
  );
  if (usable.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_providers")
    .select(
      "id, location, specialty_capability, contact:contacts!contact_id (email, phone)",
    )
    .in(
      "id",
      usable.map((row) => row.id),
    );

  type Contact = { email: string | null; phone: string | null };
  const extra = new Map(
    (data ?? []).map((row) => {
      const contact = firstOf(row.contact as unknown as Contact | Contact[] | null);
      return [
        row.id as string,
        {
          location: (row.location as string | null) ?? null,
          specialty: (row.specialty_capability as string | null) ?? null,
          email: contact?.email ?? null,
          phone: contact?.phone ?? null,
        },
      ];
    }),
  );

  return usable.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    readiness: row.readiness,
    specialty: extra.get(row.id)?.specialty ?? null,
    location: extra.get(row.id)?.location ?? null,
    email: extra.get(row.id)?.email ?? null,
    phone: extra.get(row.id)?.phone ?? null,
  }));
}


/**
 * Every specialty this firm has already written down.
 *
 * The picker offers these under whatever category is chosen, after the starter
 * list. It is their own vocabulary, which is usually closer to what they are
 * about to type than anything written for them in advance.
 */
export async function listUsedSpecialties(): Promise<string[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_providers")
    .select("specialty_capability")
    .eq("workspace_id", workspaceId)
    .not("specialty_capability", "is", null);

  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    const value = String(row.specialty_capability ?? "").trim();
    if (!value) continue;
    // Case-insensitively unique, keeping the first spelling somebody used.
    const key = value.toLowerCase();
    if (!seen.has(key)) seen.set(key, value);
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

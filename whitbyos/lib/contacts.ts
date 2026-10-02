import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { roleLabel } from "@/whitbyos/lib/contact-vocab";

export type PersonRow = {
  id: string;
  name: string;
  companyRole: string | null;
  role: string | null;
  clientName: string | null;
  clientId: string | null;
  updated_at: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  category: string | null;
  status: "Company";
  clientName: string | null;
  updated_at: string;
};

function fullName(row: { first_name?: string; last_name?: string; preferred_name?: string | null }) {
  return (
    row.preferred_name ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    "Unnamed contact"
  );
}

/**
 * Screen 4.1 — People.
 *
 * `contacts` is a base table shared with the Client Portal and Partner Center,
 * so it carries no workspace scope of its own beyond who created the row. This
 * lists the ones this workspace created, plus anyone linked to one of its
 * clients — which is how a contact created elsewhere but working with this
 * professional still appears.
 */
/**
 * Whether the tables behind this screen can be read at all.
 *
 * The three loaders below each return a plain array and discard whatever went
 * wrong, so a failure arrives as an empty list — indistinguishable from having
 * no contacts, which is how screen 4's error state could never appear. Rather
 * than give three functions a result shape their fifteen call sites do not
 * want, one cheap query asks the question the error state is actually about:
 * can this account reach its own contacts.
 */
export async function contactsReachable(): Promise<string | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("created_by_workspace_id", workspaceId);

  return error?.message ?? null;
}

export async function listPeople(search?: string): Promise<PersonRow[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("whitbyos_clients")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  const clientNames = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));

  const { data: members } = clientNames.size
    ? await supabase
        .from("whitbyos_client_members")
        .select("contact_id, client_id, role")
        .in("client_id", [...clientNames.keys()])
    : { data: [] };

  const linked = new Map(
    (members ?? []).map((m) => [
      m.contact_id as string,
      { clientId: m.client_id as string, role: m.role as string },
    ]),
  );

  /*
   * Contacts is the relationship address book — not Providers, not Team.
   *
   * Hide anyone filed as a provider, anyone on a provider firm, and anyone
   * whose email is a workspace teammate (those live under Settings → Team).
   */
  const { data: providerRows } = await supabase
    .from("whitbyos_providers")
    .select("contact_id, company_id")
    .eq("workspace_id", workspaceId);

  const hide = new Set<string>();
  const providerCompanies = new Set<string>();
  for (const row of providerRows ?? []) {
    if (row.contact_id) hide.add(row.contact_id as string);
    if (row.company_id) providerCompanies.add(row.company_id as string);
  }

  if (providerCompanies.size > 0) {
    const { data: atFirm } = await supabase
      .from("company_contacts")
      .select("contact_id")
      .in("company_id", [...providerCompanies]);
    for (const row of atFirm ?? []) {
      if (row.contact_id) hide.add(row.contact_id as string);
    }
  }

  const { data: teammateRows } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");
  const teammateIds = (teammateRows ?? []).map((row) => row.user_id as string);
  const teammateEmails = new Set<string>();
  if (teammateIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("email")
      .in("id", teammateIds);
    for (const row of users ?? []) {
      const email = (row.email as string | null)?.trim().toLowerCase();
      if (email) teammateEmails.add(email);
    }
  }

  let query = supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, preferred_name, title_role, email, updated_at, created_by_workspace_id",
    )
    // 4.0a files a contact away; the list is where that has to show.
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const { data } = await query;

  return (data ?? [])
    .filter((row) => {
      if (hide.has(row.id as string)) return false;
      const email = (row.email as string | null)?.trim().toLowerCase();
      if (email && teammateEmails.has(email)) return false;
      return (
        row.created_by_workspace_id === workspaceId || linked.has(row.id as string)
      );
    })
    .map((row) => {
      const link = linked.get(row.id as string);
      return {
        id: row.id as string,
        name: fullName(row as never),
        companyRole: (row.title_role as string | null) ?? null,
        role: link?.role ?? null,
        clientId: link?.clientId ?? null,
        clientName: link ? clientNames.get(link.clientId) ?? null : null,
        updated_at: row.updated_at as string,
      };
    });
}

/**
 * Screen 4.2 — Companies on the Contacts directory.
 *
 * Provider firms live on Providers. Client organisations live on Clients.
 * What remains here are ordinary company relationship records.
 */
export async function listCompanies(search?: string): Promise<CompanyRow[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  let query = supabase
    .from("companies")
    .select("id, name, industry_type, updated_at, created_by_workspace_id")
    .eq("created_by_workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (search) query = query.ilike("name", `%${search}%`);

  const { data } = await query;
  if (!data || data.length === 0) return [];

  const { data: providers } = await supabase
    .from("whitbyos_providers")
    .select("company_id")
    .eq("workspace_id", workspaceId)
    .in("company_id", data.map((c) => c.id as string));

  const isProvider = new Set((providers ?? []).map((p) => p.company_id as string));

  const { data: clients } = await supabase
    .from("whitbyos_clients")
    .select("name")
    .eq("workspace_id", workspaceId);

  const clientNames = new Set((clients ?? []).map((c) => String(c.name).toLowerCase()));

  return data
    .filter((row) => {
      if (isProvider.has(row.id as string)) return false;
      // The client organisation itself is on Clients, not here.
      if (clientNames.has(String(row.name).toLowerCase())) return false;
      return true;
    })
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      category: (row.industry_type as string | null) ?? null,
      status: "Company" as const,
      clientName: null,
      updated_at: row.updated_at as string,
    }));
}

/** One line of 4.4's "Linked Requests", and of 5.1's "Requests". */
export type LinkedRequest = {
  id: string;
  title: string;
  status: string;
  targetDate: string | null;
  /** 5.1 prints why the provider is on it; 4.4 prints the due date instead. */
  note: string | null;
  /** The request's own next action, which is what 4.4's last panel reads. */
  nextAction: string | null;
};

/** One line of the Timeline panel both detail screens end on. */
export type TimelineLine = { id: string; description: string; at: string };

export type ContactDetail = {
  id: string;
  name: string;
  /**
   * The two stored halves, which `name` is not: a display name is built from
   * a preferred name and a salutation and cannot be split back into them.
   * Splitting it on the first space renamed "Rohail khan / Ahmed" to
   * "Rohail / khan Ahmed" the first time anyone pressed Save.
   */
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  titleRole: string | null;
  salutation: string | null;
  source: string | null;
  /** 4.4's own three fields, added by migration 051. */
  communicationPreferences: string | null;
  notes: string | null;
  timezone: string | null;
  /** Requests belonging to the clients this person is attached to. */
  requests: LinkedRequest[];
  timeline: TimelineLine[];
  created_at: string;
  links: { clientId: string; clientName: string; role: string; portalAccess: boolean }[];
  /** They had a portal account and closed it. Their record is untouched. */
  portalAccountDeleted: boolean;
  /**
   * They have an account tied to this contact and can reach the portal.
   *
   * Not the same as `portalAccess` on a link, which is only permission — a
   * professional granting it does not put anybody in.
   */
  inThePortal: boolean;
};

/** Screen 4.4 — one person, and every client they are attached to. */
export async function getContact(contactId: string): Promise<ContactDetail | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, preferred_name, salutation, email, phone, title_role, source, communication_preferences, notes, timezone, created_at, created_by_workspace_id",
    )
    .eq("id", contactId)
    .maybeSingle();

  if (!data) return null;

  const { data: clients } = await supabase
    .from("whitbyos_clients")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  const clientNames = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));

  const { data: members } = clientNames.size
    ? await supabase
        .from("whitbyos_client_members")
        .select("client_id, role, portal_access")
        .eq("contact_id", contactId)
        .in("client_id", [...clientNames.keys()])
    : { data: [] };

  const [{ data: deletion }, { data: identity }] = await Promise.all([
    supabase
      .from("client_portal_deletions")
      .select("contact_id")
      .eq("contact_id", contactId)
      .maybeSingle(),
    supabase
      .from("client_portal_identities")
      .select("contact_id")
      .eq("contact_id", contactId)
      .maybeSingle(),
  ]);

  const links = (members ?? []).map((m) => ({
    clientId: m.client_id as string,
    clientName: clientNames.get(m.client_id as string) ?? "Unknown client",
    role: m.role as string,
    portalAccess: Boolean(m.portal_access),
  }));

  // Reachable if this workspace made them, or if they work with one of its clients.
  if (data.created_by_workspace_id !== workspaceId && links.length === 0) return null;

  // 4.4's "Linked Requests". A request records the client it is for and not the
  // people at it, so what this can honestly show is the work running at the
  // clients this person is attached to — which for a primary contact is the
  // same list, and for anyone else is at least true.
  const clientIds = links.map((link) => link.clientId);
  const { data: requestRows } = clientIds.length
    ? await supabase
        .from("whitbyos_requests")
        .select("id, title, status, target_date, next_action")
        .in("client_id", clientIds)
        .eq("workspace_id", workspaceId)
        .order("target_date", { nullsFirst: false })
    : { data: [] };

  const requests: LinkedRequest[] = (requestRows ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string) ?? "Untitled request",
    status: (row.status as string) ?? "",
    targetDate: (row.target_date as string | null) ?? null,
    note: null,
    nextAction: (row.next_action as string | null) ?? null,
  }));

  const { data: events } = requests.length
    ? await supabase
        .from("whitbyos_timeline_events")
        .select("id, description, created_at")
        .in(
          "request_id",
          requests.map((row) => row.id),
        )
        .order("created_at", { ascending: false })
        .limit(6)
    : { data: [] };

  return {
    id: data.id as string,
    name: fullName(data as never),
    firstName: (data.first_name as string | null) ?? "",
    lastName: (data.last_name as string | null) ?? "",
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    titleRole: (data.title_role as string | null) ?? null,
    salutation: (data.salutation as string | null) ?? null,
    source: (data.source as string | null) ?? null,
    communicationPreferences: (data.communication_preferences as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
    timezone: (data.timezone as string | null) ?? null,
    requests,
    timeline: (events ?? []).map((row) => ({
      id: row.id as string,
      description: (row.description as string) ?? "Activity",
      at: row.created_at as string,
    })),
    created_at: data.created_at as string,
    links,
    portalAccountDeleted: Boolean(deletion),
    inThePortal: Boolean(identity),
  };
}

/** Screen 4.3 — Recent, which is People and Companies interleaved by activity. */
export async function listRecent() {
  const [people, companies] = await Promise.all([listPeople(), listCompanies()]);

  const rows = [
    ...people.map((p) => ({
      id: p.id,
      kind: "person" as const,
      name: p.name,
      detail: [roleLabel(p.role), p.clientName].filter(Boolean).join(" · ") || "No client linked",
      at: p.updated_at,
      href: `/whitbyos/contacts/${p.id}`,
    })),
    ...companies.map((c) => ({
      id: c.id,
      kind: "company" as const,
      name: c.name,
      detail: [c.status, c.category].filter(Boolean).join(" · "),
      at: c.updated_at,
      href: "/whitbyos/contacts?tab=companies",
    })),
  ];

  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return rows.slice(0, 12);
}




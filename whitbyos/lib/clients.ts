/** The enum values behind the classifications, for clients recorded before 086. */
const CLIENT_TYPE_NAMES = ["individual", "family", "company", "organization"];

import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getSessionProfile } from "@/base/identity/session";
import type { Client, ClientListRow, ClientPrimaryContact } from "@/whitbyos/types";
import { portalStateOf, type PortalState } from "@/whitbyos/lib/portal-state";
import { OPEN_REQUEST_STATUSES } from "@/whitbyos/lib/request-status";

type ClientRow = Client & {
  primary_contact: ClientPrimaryContact | ClientPrimaryContact[] | null;
};

/** One embedded row can come back as an object or a single-element array
 *  depending on how PostgREST resolves the relationship. */
function firstContact(
  value: ClientPrimaryContact | ClientPrimaryContact[] | null,
): ClientPrimaryContact | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type ClientFilters = {
  q?: string;
  /**
   * Narrow to the one client workspace that is open.
   *
   * Every other screen in the product answers to that choice, and this one did
   * not: a professional working inside one client opened Clients and was shown
   * all four, which reads as the choice having been lost.
   */
  clientId?: string;
  type?: string;
  status?: string;
  /**
   * One of `PortalState`. Narrows by whether the client's person can get into
   * the portal, which is what the list's Status column shows.
   *
   * Applied after the rows are read rather than in the query, because a portal
   * state is not a column — it is derived from an auth identity, a closed
   * account and an invitation's status and expiry together.
   */
  portal?: string;
  /**
   * Which workspace to read, when the person belongs to more than one.
   *
   * Checked against their own memberships before it is used, so an id typed
   * into the address bar cannot reach a workspace they are not in. RLS would
   * refuse those rows anyway — this makes the refusal a fallback rather than
   * the only guard, and keeps the filter honest about what it returned.
   */
  workspace?: string;
  sort?: string;
};

export type ClientListResult =
  | { ok: true; rows: ClientListRow[] }
  | { ok: false; error: string };

/**
 * Which workspace a list is being asked for.
 *
 * `getCurrentWorkspaceId` is the session's own choice and stays the default.
 * A `workspace` filter overrides it only where the person is actually a
 * member, so the select on the Clients page can reach across their workspaces
 * and an id in the URL cannot reach anywhere else.
 */
async function resolveWorkspace(requested?: string): Promise<string | null> {
  if (!requested) return getCurrentWorkspaceId();

  const profile = await getSessionProfile();
  const mine = profile?.workspaces ?? [];
  if (mine.some((workspace) => workspace.id === requested)) return requested;

  return getCurrentWorkspaceId();
}

/**
 * The ids of contacts whose name or address matches, so a search can find a
 * client by the person on it and not only by the client's own name.
 *
 * A separate read rather than one `or` across an embedded table: PostgREST
 * cannot or-join a parent column with a child's, and building the filter as a
 * string would put the typed term into a grammar where a comma means
 * something. Scoped by RLS to contacts this workspace may read.
 */
async function contactIdsMatching(
  supabase: Awaited<ReturnType<typeof createClient>>,
  search: string,
): Promise<string[]> {
  const like = `%${search}%`;
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .or(
      [
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
        `preferred_name.ilike.${like}`,
        `email.ilike.${like}`,
      ].join(","),
    );

  return (data ?? []).map((row) => row.id as string);
}

export async function listClients(
  filters: ClientFilters = {},
): Promise<ClientListResult> {
  const workspaceId = await resolveWorkspace(filters.workspace);
  if (!workspaceId) return { ok: true, rows: [] };

  const supabase = await createClient();

  let query = supabase
    .from("whitbyos_clients")
    .select(
      "id, workspace_id, name, client_type, classification, status, owner_user_id, primary_contact_id, preferences, created_at, updated_at, primary_contact:contacts!primary_contact_id (id, first_name, last_name, email, phone)",
    )
    .eq("workspace_id", workspaceId)
    // 2.0a files a client away rather than deleting it; the active list is
    // where "hides it from active views" has to be true.
    .is("archived_at", null);

  const search = filters.q?.trim();
  if (search) {
    // A comma separates conditions in a PostgREST `or`, and a bracket closes
    // one, so neither may arrive from the search box. Ids are uuids and carry
    // neither.
    const safe = search.replace(/[,()]/g, " ").trim();
    const contactIds = safe ? await contactIdsMatching(supabase, safe) : [];
    query = query.or(
      contactIds.length > 0
        ? `name.ilike.%${safe}%,primary_contact_id.in.(${contactIds.join(",")})`
        : `name.ilike.%${safe}%`,
    );
  }
  /* The firm's own word, with the enum behind it for clients recorded before
     the list was wired: filtering on "Family" has to find both the client
     classified "Family" today and the one that only has client_type=family. */
  if (filters.type) {
    const legacy = filters.type.toLowerCase();
    query = query.or(
      CLIENT_TYPE_NAMES.includes(legacy)
        ? `classification.eq.${filters.type},and(classification.is.null,client_type.eq.${legacy})`
        : `classification.eq.${filters.type}`,
    );
  }
  if (filters.clientId) query = query.eq("id", filters.clientId);
  if (filters.status) query = query.eq("status", filters.status);

  const sort = filters.sort ?? "";
  const { data: clients, error } = await query.order(
    sort === "name" ? "name" : "updated_at",
    { ascending: sort === "name" },
  );

  if (error) return { ok: false, error: error.message };

  const rows = (clients ?? []) as ClientRow[];
  if (rows.length === 0) return { ok: true, rows: [] };

  const { isHiddenFirmClient } = await import("@/whitbyos/lib/client-workspace");
  const visible = rows.filter((row) => !isHiddenFirmClient(row));
  if (visible.length === 0) return { ok: true, rows: [] };

  const counts = await countActiveRequests(
    supabase,
    workspaceId,
    visible.map((row) => row.id),
  );

  const { states: portal, since } = await portalStates(
    supabase,
    visible.map((row) => firstContact(row.primary_contact)?.id).filter(Boolean) as string[],
    visible.map((row) => row.id),
  );

  const mapped: ClientListRow[] = visible.map((row) => {
    const contact = firstContact(row.primary_contact);
    const portalAt = contact ? since.get(contact.id) : undefined;
    const last =
      [portalAt, row.updated_at, row.created_at].filter(Boolean).sort().at(-1) ??
      row.created_at;
    return {
      ...row,
      primary_contact: contact,
      active_request_count: counts.get(row.id) ?? 0,
      last_activity_at: last,
      portal_state: contact ? portal.get(contact.id) ?? "none" : "none",
    };
  });

  if (filters.sort === "requests") {
    mapped.sort((a, b) => b.active_request_count - a.active_request_count);
  }

  const shown = filters.portal
    ? mapped.filter((row) => (row.portal_state ?? "none") === filters.portal)
    : mapped;

  return { ok: true, rows: shown };
}

/**
 * Every primary contact's portal state, in three queries rather than three per
 * row. The same derivation the client's own Contacts tab uses, from the same
 * helper, so the list and the page cannot come to different conclusions about
 * the same person.
 */
async function portalStates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactIds: string[],
  clientIds: string[],
): Promise<{ states: Map<string, PortalState>; since: Map<string, string> }> {
  const states = new Map<string, PortalState>();
  // When the thing the state describes actually happened.
  const since = new Map<string, string>();
  if (contactIds.length === 0) return { states, since };

  const [{ data: identities }, { data: closed }, { data: invites }] = await Promise.all([
    supabase
      .from("client_portal_identities")
      .select("contact_id, created_at")
      .in("contact_id", contactIds),
    supabase.from("client_portal_deletions").select("contact_id").in("contact_id", contactIds),
    supabase
      .from("invitations")
      .select("invitee_email, status, expires_at, email_delivered, context_id, created_at, sent_at")
      .in("context_id", clientIds)
      .order("created_at", { ascending: false }),
  ]);

  const inPortal = new Set((identities ?? []).map((r) => r.contact_id as string));
  const joined = new Map(
    (identities ?? []).map((r) => [r.contact_id as string, r.created_at as string]),
  );
  const gone = new Set((closed ?? []).map((r) => r.contact_id as string));

  // An invitation is addressed to an email, not to a contact id, so it is
  // matched back by address. Newest first, so the first hit is the current one.
  const { data: people } = await supabase
    .from("contacts")
    .select("id, email")
    .in("id", contactIds);

  const byEmail = new Map<
    string,
    { status: string | null; expiresAt: string | null; delivered: boolean | null; at: string | null }
  >();
  for (const invite of invites ?? []) {
    const email = (invite.invitee_email as string | null)?.toLowerCase();
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, {
      status: (invite.status as string | null) ?? null,
      expiresAt: (invite.expires_at as string | null) ?? null,
      delivered: (invite.email_delivered as boolean | null) ?? null,
      at: (invite.sent_at as string | null) ?? (invite.created_at as string | null) ?? null,
    });
  }

  for (const person of people ?? []) {
    const id = person.id as string;
    const email = (person.email as string | null)?.toLowerCase();
    const invitation = email ? byEmail.get(email) ?? null : null;
    const state = portalStateOf({
      closed: gone.has(id),
      inThePortal: inPortal.has(id),
      // `at` is the invitation's own sent_at, which is when the link in the
      // email started its hour.
      invitation: invitation ? { ...invitation, sentAt: invitation.at } : null,
    });
    states.set(id, state);

    // The date that belongs to the state it is shown beside: when they came
    // in, or when the invitation they have not answered went out.
    const at = state === "active" ? joined.get(id) : invitation?.at;
    if (at) since.set(id, at);
  }

  return { states, since };
}

/** Counted in one query rather than one per client. */
async function countActiveRequests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  clientIds: string[],
) {
  const counts = new Map<string, number>();

  const { data } = await supabase
    .from("whitbyos_requests")
    .select("client_id")
    .eq("workspace_id", workspaceId)
    .in("client_id", clientIds)
    .in("status", OPEN_REQUEST_STATUSES)
    .is("closed_at", null);

  for (const row of data ?? []) {
    const id = row.client_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

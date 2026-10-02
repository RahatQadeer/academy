import { createClient } from "@/base/lib/supabase/server";
import { inviteOrigin } from "@/base/auth/site";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { ACCESS_AREA_KEYS } from "@/whitbyos/lib/access-requests-vocab";
import type { Client, ClientPrimaryContact } from "@/whitbyos/types";
import { portalStateOf, type PortalState } from "@/whitbyos/lib/portal-state";

export type ClientDetail = Client & {
  primary_contact: ClientPrimaryContact | null;
  /** SRS §5.3.3 Overview — added by migration 006. */
  current_summary: string | null;
  next_action: string | null;
};

export type ClientRequest = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Where this person stands with the Client Portal.
 *
 * `none` — nobody has invited them.
 * `not_sent` — an invitation exists but no email ever left, so as far as this
 *   person knows nothing happened. The link still works if it is handed over.
 * `invited` — an email went and is still good; they have not been in yet.
 * `expired` — it lapsed unused (§9.4.3, 14 days).
 * `active` — they have an account linked to this contact and can reach the
 *   portal. Read from that link rather than from the invitation, because a
 *   used invitation and a working account are not the same fact.
 * `deleted` — they had an account and closed it themselves.
 *
 * Order matters twice over. `deleted` outranks everything, or somebody who left
 * looks like somebody nobody invited. And `active` outranks the invitation, or
 * a person who got in another way reads as still waiting.
 */
export type { PortalState };

export type ClientContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_label: string;
  /** The areas granted to them, or null where nobody has decided. */
  areas: string[] | null;
  portal_access: boolean;
  portal_state: PortalState;
  /** The invitation's own link, so it can be passed on when no email went. */
  invite_url: string | null;
};

export type ClientDocument = {
  id: string;
  title: string;
  request_title: string | null;
  created_at: string;
  status: string;
  /**
   * Who put it here.
   *
   * "client" is a file the client uploaded from the portal, "team" is one of
   * yours. Worked out from the person who uploaded it: a portal login is not
   * a member of the workspace, and that is the whole difference. It matters
   * on this tab because "what has the client sent us" and "what have we
   * filed" are two different questions asked of one list.
   */
  source: "client" | "team";
};

export type TimelineEntry = {
  id: string;
  description: string;
  request_title: string | null;
  created_at: string;
};

function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getClient(clientId: string): Promise<ClientDetail | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_clients")
    .select(
      "id, workspace_id, name, client_type, status, owner_user_id, primary_contact_id, preferences, current_summary, next_action, created_at, updated_at, primary_contact:contacts!primary_contact_id (id, first_name, last_name, email, phone, timezone)",
    )
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as ClientDetail & {
    primary_contact: ClientPrimaryContact | ClientPrimaryContact[] | null;
  };

  return { ...row, primary_contact: firstOf(row.primary_contact) };
}

export async function listClientRequests(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_requests")
    .select("id, title, status, target_date, created_at, updated_at")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });

  return (data ?? []) as ClientRequest[];
}

/**
 * People attached to this Client, and whether each can actually get in.
 *
 * This used to read `contact_roles`. Nothing in WhitbyOS has ever written to
 * that table — the relationship is recorded in `whitbyos_client_members`, which
 * is what every other screen reads — so this tab came back empty for every
 * client added through Whitby.
 *
 * Whether somebody can reach the portal is read from `client_portal_identities`
 * — the link between an account and this contact — because that is the fact.
 * The invitation only says what was sent and whether it lapsed.
 *
 * They come apart in both directions, which is why both are read. Somebody can
 * be in without the invitation being marked used, and an invitation can be
 * marked used by an account that never finished being linked. Reading either
 * one alone gets one of those wrong.
 */
export async function listClientContacts(
  clientId: string,
): Promise<ClientContactRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_client_members")
    .select(
      "id, role, portal_access, permissions, contact:contacts!contact_id (id, first_name, last_name, email, phone)",
    )
    .eq("client_id", clientId);

  const rows = (data ?? []).flatMap((row) => {
    const contact = firstOf(
      row.contact as ClientPrimaryContact | ClientPrimaryContact[] | null,
    );
    return contact ? [{ row, contact }] : [];
  });

  if (rows.length === 0) return [];

  const contactIds = rows.map((entry) => entry.contact.id);

  const [{ data: invitations }, { data: deletions }, { data: identities }] =
    await Promise.all([
      supabase
        .from("invitations")
        .select("invitee_email, status, expires_at, token, email_delivered, sent_at")
        .eq("context_id", clientId)
        .order("sent_at", { ascending: false }),
      supabase
        .from("client_portal_deletions")
        .select("contact_id")
        .in("contact_id", contactIds),
      supabase
        .from("client_portal_identities")
        .select("contact_id")
        .in("contact_id", contactIds),
    ]);

  const closed = new Set((deletions ?? []).map((row) => row.contact_id as string));
  const inThePortal = new Set((identities ?? []).map((row) => row.contact_id as string));

  // Newest first above, so the first seen for an address is the current one.
  const latest = new Map<
    string,
    {
      status: string;
      expires_at: string | null;
      token: string;
      delivered: boolean | null;
      sent_at: string | null;
    }
  >();
  for (const row of invitations ?? []) {
    const email = String(row.invitee_email ?? "").trim().toLowerCase();
    if (email && !latest.has(email)) {
      latest.set(email, {
        status: row.status as string,
        expires_at: (row.expires_at as string | null) ?? null,
        token: row.token as string,
        delivered: (row.email_delivered as boolean | null) ?? null,
        sent_at: (row.sent_at as string | null) ?? null,
      });
    }
  }

  return rows.map(({ row, contact }) => {
    const invitation = latest.get((contact.email ?? "").trim().toLowerCase());

    // The same helper the Clients list resolves with, rather than a second
    // copy of its rules. This used to be that copy, and it had already fallen
    // behind: the list knows when an emailed link has outlived its hour and
    // this did not, so one screen would have said "Link expired" while the
    // other said "Pending" about the same person.
    const state: PortalState = portalStateOf({
      closed: closed.has(contact.id),
      inThePortal: inThePortal.has(contact.id),
      invitation: invitation
        ? {
            status: invitation.status,
            expiresAt: invitation.expires_at,
            delivered: invitation.delivered,
            sentAt: invitation.sent_at,
          }
        : null,
    });

    return {
      id: contact.id,
      name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
      email: contact.email,
      phone: contact.phone,
      role_label: row.role as string,
      portal_access: Boolean(row.portal_access),
      /*
       * What this person may actually reach, as it was granted — 009 and the
       * approval function write the client's own ticks into `permissions`.
       *
       * Null where nothing was ever decided about them, which is not the same
       * as none: a membership made before any of this inherits whatever the
       * portal's own rules give it, and the screen has to say which of the two
       * it is rather than drawing an empty list for both.
       */
      areas: readGranted(row.permissions),
      portal_state: state,
      // Only while it is still worth passing on. An accepted invitation's link
      // does nothing, and an expired one needs sending again, not sharing.
      // Also on not_sent — that is precisely when somebody needs to hand it
      // over — and on link_expired, where the invitation is alive and only the
      // hour-long address in the email has gone.
      invite_url:
        (state === "invited" || state === "not_sent" || state === "link_expired") && invitation
          ? `${inviteOrigin()}/invite/${invitation.token}`
          : null,
    };
  });
}

/**
 * Documents filed against the Client itself plus those on its Requests.
 * Uses the shared base `documents` table — Whitby has no documents table.
 */
export async function listClientDocuments(
  clientId: string,
  requests: ClientRequest[],
): Promise<ClientDocument[]> {
  const supabase = await createClient();
  const titleByRequest = new Map(requests.map((r) => [r.id, r.title]));
  const contextIds = [clientId, ...requests.map((r) => r.id)];

  const { data } = await supabase
    .from("documents")
    .select("id, title, status, context_type, context_id, created_at, uploaded_by_user_id")
    .in("context_type", ["client", "request"])
    .in("context_id", contextIds)
    .order("created_at", { ascending: false });

  const rows = data ?? [];

  /* Who in this workspace uploaded anything here. Everyone else who did is a
     portal login, which is what makes a document "from the client". */
  const uploaders = [
    ...new Set(rows.map((row) => row.uploaded_by_user_id as string | null).filter(Boolean)),
  ] as string[];

  const staff = new Set<string>();
  if (uploaders.length > 0) {
    const workspaceId = await getCurrentWorkspaceId();
    if (workspaceId) {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .in("user_id", uploaders);

      for (const member of members ?? []) staff.add(member.user_id as string);
    }
  }

  return rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    request_title:
      row.context_type === "request"
        ? titleByRequest.get(row.context_id as string) ?? null
        : null,
    created_at: row.created_at as string,
    status: (row.status as string) ?? "current",
    source: staff.has((row.uploaded_by_user_id as string) ?? "") ? "team" : "client",
  }));
}

/**
 * Timeline is a Request-level concept (SRS §6.14.4 — there is no global
 * client timeline), so a Client's history is its Requests' events combined.
 *
 * The table has had `whitbyos_timeline_events_staff` for a while, so reads work.
 * What it did not have until now was anything writing to it — the history was
 * read in four places and recorded in none, so every timeline in the product
 * said nothing had happened. `lib/timeline-events.ts` is what writes it.
 */
export async function listClientTimeline(
  requests: ClientRequest[],
): Promise<TimelineEntry[]> {
  if (requests.length === 0) return [];

  const supabase = await createClient();
  const titleByRequest = new Map(requests.map((r) => [r.id, r.title]));

  const { data } = await supabase
    .from("whitbyos_timeline_events")
    .select("id, description, request_id, created_at")
    .in(
      "request_id",
      requests.map((r) => r.id),
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    description: row.description as string,
    request_title: titleByRequest.get(row.request_id as string) ?? null,
    created_at: row.created_at as string,
  }));
}


export type AccessRequest = {
  id: string;
  personName: string;
  personEmail: string | null;
  relationship: string | null;
  requestedRole: string | null;
  /**
   * The areas the client ticked, or null where the request predates the column
   * that records them. Null and [] are different answers: null means nobody
   * was asked, [] means they were and chose none.
   */
  requestedAreas: string[] | null;
  reason: string | null;
  requestedBy: string | null;
  createdAt: string;
  initials: string;
};

/**
 * Screen 2.1.2.1 — what the client has asked for and nobody has answered.
 *
 * The portal has been able to write these since it was built (§4.9.1); nothing
 * in WhitbyOS has ever read them, so a request sat in the table and the
 * professional was never told. Only pending ones come back — an answered
 * request is a decision already taken, not something waiting.
 */
const REQUEST_COLUMNS =
  "id, client_id, person_name, person_email, relationship, requested_role, reason, created_at, requested_by_contact_id";

/**
 * The pending requests, with `requested_areas` where the column exists.
 *
 * `client-portal/009` adds it and is a proposal until its owner applies it, so
 * this is the same two-step the portal already does in `accessRequestsOf`:
 * naming a column an environment does not have makes PostgREST answer 400, and
 * an empty list of requests is a worse answer than a request with no areas on
 * it.
 */
async function pendingRequestRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientIds: string[],
): Promise<Record<string, unknown>[]> {
  if (clientIds.length === 0) return [];

  const read = async (columns: string) =>
    supabase
      .from("client_portal_access_requests")
      .select(columns)
      .in("client_id", clientIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

  const withAreas = await read(`${REQUEST_COLUMNS}, requested_areas`);
  if (!withAreas.error) return (withAreas.data ?? []) as unknown as Record<string, unknown>[];

  const plain = await read(REQUEST_COLUMNS);
  if (plain.error) return [];
  return (plain.data ?? []) as unknown as Record<string, unknown>[];
}

/** Who asked, by contact id, so a list of requests names people not ids. */
async function askerNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Record<string, unknown>[],
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(rows.map((row) => row.requested_by_contact_id as string).filter(Boolean)),
  ];

  const names = new Map<string, string>();
  if (ids.length === 0) return names;

  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, preferred_name")
    .in("id", ids);

  for (const contact of data ?? []) {
    names.set(
      contact.id as string,
      (contact.preferred_name as string) ||
        [contact.first_name, contact.last_name].filter(Boolean).join(" "),
    );
  }
  return names;
}

/** One row, as the review dialog wants it. */
function toAccessRequest(
  row: Record<string, unknown>,
  askers: Map<string, string>,
): AccessRequest {
  const name = (row.person_name as string) || "Someone";
  return {
    id: row.id as string,
    personName: name,
    personEmail: (row.person_email as string | null) ?? null,
    relationship: (row.relationship as string | null) ?? null,
    requestedRole: (row.requested_role as string | null) ?? null,
    requestedAreas: readRequestedAreas(row.requested_areas),
    reason: (row.reason as string | null) ?? null,
    requestedBy: askers.get(row.requested_by_contact_id as string) ?? null,
    createdAt: row.created_at as string,
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join(""),
  };
}

/**
 * What the client ticked. Absent stays absent: a request written before the
 * column existed asked for nothing in particular, which is not the same as
 * asking for nothing.
 */
function readRequestedAreas(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const chosen = new Set(raw.filter((value): value is string => typeof value === "string"));
  return ACCESS_AREA_KEYS.filter((key) => chosen.has(key));
}

/**
 * Every pending access request in this workspace, whichever client it is on.
 *
 * A request could only be found by opening the one client it belongs to and
 * choosing the Contacts tab, which a professional with fifty clients has no
 * way to do. This is the same read scoped by workspace rather than by client,
 * so the clients are resolved first and nothing outside them is ever asked
 * for: the workspace check has to hold here exactly as it does there.
 */
export async function listWorkspaceAccessRequests(): Promise<
  (AccessRequest & { clientId: string; clientName: string })[]
> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("whitbyos_clients")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null);

  const named = new Map((clients ?? []).map((row) => [row.id as string, row.name as string]));
  if (named.size === 0) return [];

  const rows = await pendingRequestRows(supabase, [...named.keys()]);
  if (rows.length === 0) return [];

  const asked = await askerNames(supabase, rows);

  return rows.map((row) => ({
    ...toAccessRequest(row, asked),
    clientId: row.client_id as string,
    clientName: named.get(row.client_id as string) ?? "No client",
  }));
}

export async function listAccessRequests(clientId: string): Promise<AccessRequest[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  // The id arrives from a URL, so the client is checked against the workspace
  // before anything about it is read.
  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("id")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!client) return [];

  const rows = await pendingRequestRows(supabase, [clientId]);
  if (rows.length === 0) return [];

  const asked = await askerNames(supabase, rows);
  return rows.map((row) => toAccessRequest(row, asked));
}

/**
 * Form answers this client has sent back.
 *
 * The Documents tab is read as "what has passed between us and this client",
 * and a returned form is exactly that — it simply lives in a different table,
 * so it was invisible there while the documents it arrived with were not.
 *
 * Only what the client has actually sent: a form waiting on them is work not
 * yet done, and belongs on Forms rather than in a list of what has arrived.
 */
export type ClientFormAnswer = {
  id: string;
  title: string;
  status: string;
  submitted_at: string;
};

export async function listClientFormAnswers(clientId: string): Promise<ClientFormAnswer[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  const { data: forms } = await supabase
    .from("whitbyos_forms")
    .select("id, title")
    .eq("workspace_id", workspaceId);

  const titles = new Map((forms ?? []).map((row) => [row.id as string, row.title as string]));
  if (titles.size === 0) return [];

  const { data } = await supabase
    .from("whitbyos_form_submissions")
    .select("id, form_id, status, submitted_at")
    .eq("client_id", clientId)
    .in("form_id", [...titles.keys()])
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: titles.get(row.form_id as string) ?? "Form",
    status: (row.status as string) ?? "submitted",
    submitted_at: row.submitted_at as string,
  }));
}

/**
 * The permissions column, read as a list of area keys.
 *
 * jsonb, written by the portal's approval function and by the review dialog,
 * and it has held both an array and null over the life of this table. Anything
 * that is not a list of known keys is treated as nothing having been decided.
 */
function readGranted(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const keys = value.filter((entry): entry is string => typeof entry === "string");
  return keys.filter((key) => ACCESS_AREA_KEYS.includes(key));
}

import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import { portalAvatarUrls } from "@/client-portal/lib/data/avatars";
import {
  AREA_KEYS,
  areaSummary,
  readAreas,
  toPersonRole,
} from "@/client-portal/lib/access";
import type {
  AccessRequest,
  PortalArea,
  PortalPerson,
  PortalPersonRole,
} from "@/client-portal/types";

type MemberRow = {
  id: string;
  role: string | null;
  portal_access: boolean | null;
  /** whitbyos/025 — the area grants 2.1.2.1 records. Absent before that. */
  permissions?: unknown;
  contacts: {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    email: string | null;
    title_role: string | null;
  } | null;
};

export async function listPeople(): Promise<PortalPerson[]> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.PEOPLE;

  const rows = await membersOf(await createClient(), ctx.clientId!);
  if (!rows) return [];

  // Every face on the account in one round trip, rather than one signing per
  // row. A person with no photo is simply absent from the map.
  const photos = await portalAvatarUrls(rows.map((row) => row.contacts?.id));

  return rows.flatMap((row): PortalPerson[] => {
    if (!row.contacts) return [];
    const contact = row.contacts;
    const role = toPersonRole(row.role);
    const access = readAreas(row.permissions, role);
    return [
      {
        id: row.id,
        contactId: contact.id,
        name:
          contact.preferred_name ||
          [contact.first_name, contact.last_name].filter(Boolean).join(" "),
        email: contact.email,
        role,
        relationship: contact.title_role,
        photoUrl: photos.get(contact.id) ?? null,
        portalAccess: row.portal_access === true,
        status: "active",
        // The sentence under a name, from the same reader the portal gates
        // itself on — so what this screen says a person can reach and what they
        // can actually reach cannot drift apart.
        scopeSummary: access.viewOnly
          ? `View only${areaSummary(access.areas) ? `, ${areaSummary(access.areas)}` : ""}`
          : areaSummary(access.areas),
        areas: access.areas,
        viewOnly: access.viewOnly,
        areasInherited: access.inherited,
      },
    ];
  });
}

const MEMBER_COLUMNS =
  "id, role, portal_access, contacts(id, first_name, last_name, preferred_name, email, title_role)";

/**
 * The members of one client account, with `permissions` where the column exists.
 *
 * The same two-step as `resolveMembership` in `portal-context.ts`, for the same
 * reason: PostgREST answers a request naming an unknown column with a 400, and
 * People & Access showing nobody at all is a worse failure than showing everyone
 * without their area grants.
 */
async function membersOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
): Promise<MemberRow[] | null> {
  const withPermissions = await supabase
    .from("whitbyos_client_members")
    .select(`${MEMBER_COLUMNS}, permissions`)
    .eq("client_id", clientId);

  if (!withPermissions.error) {
    return (withPermissions.data ?? []) as unknown as MemberRow[];
  }

  const { data, error } = await supabase
    .from("whitbyos_client_members")
    .select(MEMBER_COLUMNS)
    .eq("client_id", clientId);

  if (error) return null;
  return (data ?? []) as unknown as MemberRow[];
}

/**
 * Access requests this client has raised. Clients can never grant access — they
 * submit a request the professional approves, edits, or declines (SRS 4.8.3).
 * This is one of the two tables the Client Portal actually owns.
 */
export async function listAccessRequests(): Promise<AccessRequest[]> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.ACCESS_REQUESTS;

  const data = await accessRequestsOf(await createClient(), ctx.clientId!);
  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    personName: row.person_name as string,
    personEmail: row.person_email as string,
    relationship: row.relationship as string | null,
    requestedRole: row.requested_role as string | null,
    requestedAreas: readRequestedAreas(row.requested_areas),
    reason: row.reason as string | null,
    status: row.status as AccessRequest["status"],
    createdAt: row.created_at as string,
    reviewedAt: row.reviewed_at as string | null,
  }));
}

const REQUEST_COLUMNS =
  "id, person_name, person_email, relationship, requested_role, reason, status, created_at, reviewed_at";

/**
 * The access requests, with `requested_areas` where the column exists.
 *
 * `client-portal/009` adds it and is a proposal until its owner applies it, so
 * the same two-step every other optional column in this module gets: naming it
 * on an environment without it would 400 the query and empty Pending
 * Invitations, which is a worse answer than a row with no areas on it.
 */
async function accessRequestsOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
): Promise<Record<string, unknown>[] | null> {
  const withAreas = await supabase
    .from("client_portal_access_requests")
    .select(`${REQUEST_COLUMNS}, requested_areas`)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (!withAreas.error) return (withAreas.data ?? []) as Record<string, unknown>[];

  const { data, error } = await supabase
    .from("client_portal_access_requests")
    .select(REQUEST_COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) return null;
  return (data ?? []) as Record<string, unknown>[];
}

export const ROLE_LABEL: Record<PortalPersonRole, string> = {
  primary_member: "Primary Member",
  additional_member: "Additional Member",
  authorized_user: "Authorized User",
  dependent: "Dependent",
};

/**
 * The other people on this account a client may start a conversation with.
 *
 * The picker on Messages, and only that — the professional's team is offered
 * alongside these and is not one of them. Three filters, matching
 * `portal_messageable_contact_ids()` (client-portal/011) and then narrowing it
 * once more:
 *
 *   * Not the reader. `listPeople` returns the whole account including them.
 *   * A portal login, since there is nobody to read it otherwise.
 *   * The Messages area. The function deliberately does not check this — a
 *     grant the professional can change is a poor thing to make a thread's
 *     existence depend on — but offering to write to somebody who cannot open
 *     Messages is offering to write into a drawer nobody opens.
 */
export async function listMessageablePeople(): Promise<PortalPerson[]> {
  const [ctx, people] = await Promise.all([getPortalContext(), listPeople()]);

  return people.filter(
    (person) =>
      person.portalAccess &&
      person.areas.messages &&
      person.contactId !== ctx.contactId,
  );
}

/**
 * The relationships offered on the add-a-person form.
 *
 * A list rather than free text, so what a client types and what the
 * professional's approval screen reads are the same words. "Other" is last and
 * exists because this list cannot be complete — the column is free text on the
 * database side either way, and a request that cannot name the relationship is
 * worse than one that names it loosely.
 */
export const RELATIONSHIPS = [
  "Spouse",
  "Partner",
  "Adult Child",
  "Parent",
  "Sibling",
  "Assistant",
  "Accountant",
  "Attorney",
  "Financial Advisor",
  "Business Partner",
  "Other",
] as const;

/** Roles a client may *request*. Dependent needs no portal access, so it is here too. */
export const REQUESTABLE_ROLES: { value: string; label: string; help: string }[] = [
  {
    value: "additional_member",
    label: "Additional Member",
    help: "A spouse, adult child, or parent with their own requests and login.",
  },
  {
    value: "authorized_user",
    label: "Authorized User",
    help: "An assistant or representative acting for a member, within set limits.",
  },
  {
    value: "billing_contact",
    label: "Billing Contact",
    help: "Invoices and payment status only, without broader account access.",
  },
  {
    value: "dependent",
    label: "Dependent",
    help: "A related person on the account with no portal login.",
  },
];

/**
 * `client_portal_access_requests.requested_areas` (client-portal/009), read the
 * same defensive way as everything else that crosses the wire as jsonb.
 *
 * An empty list is the honest answer for a request raised before 009 — the
 * client named a role and nothing about areas, and inventing a set for them
 * would put words in their mouth on a row the professional is about to act on.
 */
function readRequestedAreas(raw: unknown): PortalArea[] {
  if (!Array.isArray(raw)) return [];
  const chosen = new Set(raw.filter((value): value is string => typeof value === "string"));
  return AREA_KEYS.filter((key) => chosen.has(key));
}


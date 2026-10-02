import { portalIsOpen } from "@/whitbyos/lib/portal-open";
import { cache } from "react";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { ALL_AREAS, readAreas, toPersonRole } from "@/client-portal/lib/access";
import { properName } from "@/client-portal/lib/format";
import { DEFAULT_MAX_ADDITIONAL_MEMBERS } from "@/base/lib/portal-seats";
import type { AccountCapabilities, AreaAccess, PortalPersonRole } from "@/client-portal/types";

export type PortalMode = "live" | "demo";

export type PortalContext = {
  mode: PortalMode;
  /** Why we fell back, so screens can surface an honest banner instead of "no data". */
  demoReason: DemoReason | null;
  userId: string | null;
  email: string | null;
  displayName: string;
  contactId: string | null;
  clientId: string | null;
  workspaceId: string | null;
  /** "[Company Name] Client Portal" — SRS 1.4. Never "Whitby". */
  accountName: string;
  /**
   * The professional's workspace name (`workspaces.name`). Live — renaming
   * the workspace in Settings is what the client reads here. Null until the
   * portal can reach that column (`portal_workspace_name()`).
   */
  professionalName: string | null;
  /**
   * The professional's own zone (`workspaces.timezone`), which is the zone
   * every date on a shared row was decided in — see `whitbyos/lib/zoned.ts`.
   * The portal formats in it rather than in UTC, so a 9:00 AM appointment
   * reads as 9:00 AM on both sides of the same event.
   */
  timezone: string;
  roleLabel: string;
  role: PortalPersonRole;
  /**
   * Which of the nine areas this login may reach, from
   * `whitbyos_client_members.permissions`. Every screen, nav item and write
   * action is gated on it — see `lib/access.ts` for how it is read.
   */
  areas: AreaAccess;
  /** Granted sight of their areas and no writes anywhere (GRANT_ROLES). */
  viewOnly: boolean;
  /** Nothing was recorded on the membership, so `areas` is what it already had. */
  areasInherited: boolean;
  capabilities: AccountCapabilities;
};

export type DemoReason =
  | "supabase_unconfigured"
  | "no_session"
  | "no_contact_link"
  | "no_client_membership"
  /* The firm has closed its portal. Enforced here rather than in the layout
     alone, so a server action is refused as surely as a screen. */
  | "portal_closed";

const DEMO_CAPABILITIES: AccountCapabilities = {
  additionalMembersAllowed: true,
  maxAdditionalMembers: DEFAULT_MAX_ADDITIONAL_MEMBERS,
  authorizedUsersAllowed: true,
  maxAuthorizedUsers: 2,
  mayRequestAccess: true,
  mayInviteDirectly: false,
  mayAddToRequest: true,
  mayAddToConversation: true,
};

const DEMO_CONTEXT: PortalContext = {
  mode: "demo",
  demoReason: "supabase_unconfigured",
  userId: null,
  email: "michael.chen@hartwellfo.com",
  displayName: "Michael Chen",
  contactId: null,
  clientId: null,
  workspaceId: null,
  accountName: "Hartwell Family Office",
  professionalName: "Hartwell Family Office",
  // The fixtures in `lib/fixtures/clock.ts` build their times in UTC hours, so
  // demo mode reads them back in UTC. A live session gets the professional's
  // real zone from `resolveTimezone`.
  timezone: "UTC",
  roleLabel: "Primary Member",
  role: "primary_member",
  // The sample account is a primary member, who holds every area by rule 1 of
  // `readAreas`. Demo mode must show the whole portal or it is not a sample of
  // anything.
  areas: ALL_AREAS,
  viewOnly: false,
  areasInherited: false,
  capabilities: DEMO_CAPABILITIES,
};

function demo(reason: DemoReason): PortalContext {
  return { ...DEMO_CONTEXT, demoReason: reason };
}

/**
 * Resolves who the signed-in person is on the *client* side of the account.
 *
 * The chain is: auth user -> `client_portal_identities` -> base `contacts` ->
 * `whitbyos_client_members` -> `whitbyos_clients`.
 *
 * Until client-portal/migrations/001 is applied this resolves to `demo` for every login, and
 * the reason is upstream of this module:
 *   1. Nothing maps an auth user to a person. `contacts` has no `user_id`
 *      column, and `contacts_select` requires workspace membership, which a
 *      client never has. 001 adds `client_portal_identities` for this.
 *   2. Every deployed `whitbyos_*` policy is `is_workspace_member(workspace_id)`,
 *      so a client-side reader matches zero rows. 001 adds the client-side
 *      policies alongside them.
 *
 * Nothing downstream changes when that lands — only this function starts
 * returning `live`.
 */
export const getPortalContext = cache(async (): Promise<PortalContext> => {
  if (!isSupabaseConfigured()) return demo("supabase_unconfigured");

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return demo("no_session");

  const contact = await resolveContact(supabase, authUser.id, authUser.email);
  if (!contact) return demo("no_contact_link");

  const membership = await resolveMembership(supabase, contact.id);

  const client = membership?.whitbyos_clients as
    | {
        id: string;
        name: string;
        workspace_id: string;
        preferences: Record<string, unknown> | null;
      }
    | undefined;

  if (!membership || !client) return demo("no_client_membership");

  /*
   * The firm's switch, checked before anything is handed back.
   *
   * A closed portal has to refuse the whole product, not just hide its nav:
   * every screen and every action in here starts by asking who the reader is,
   * so answering "nobody" is what closing actually means. The layout signs
   * them out on top of this, so a session already open does not outlive the
   * switch.
   */
  if (!(await portalIsOpen(client.workspace_id))) return demo("portal_closed");

  const prefs = (client.preferences ?? {}) as Record<string, unknown>;
  const role = toPersonRole(membership.role);
  const access = readAreas(membership.permissions, role);
  const seats = await resolveSeatLimits(supabase);

  return {
    mode: "live",
    demoReason: null,
    userId: authUser.id,
    email: authUser.email,
    /*
     * Capitalised once, here, rather than by each screen that shows it.
     *
     * A contact's name is typed by whoever added them in Whitby, and one
     * typed "rohail client" was greeted as "Welcome back, rohail" on the
     * dashboard and set in lowercase on the bar. Every screen reads
     * `displayName`, so raising it at the source is what keeps the greeting,
     * the chip and the avatar's initials saying the same thing.
     *
     * The email fallback is left alone: an address is not a name, and
     * "Rohail@example.com" is a typo rather than a capitalisation.
     */
    displayName:
      properName(
        contact.preferred_name ||
          [contact.first_name, contact.last_name].filter(Boolean).join(" "),
      ) || authUser.email,
    contactId: contact.id,
    clientId: client.id,
    workspaceId: client.workspace_id,
    accountName: client.name,
    professionalName: await resolveProfessionalName(supabase, client.workspace_id),
    timezone: await resolveTimezone(supabase),
    roleLabel: roleLabelFor(membership.role),
    role,
    areas: access.areas,
    viewOnly: access.viewOnly,
    areasInherited: access.inherited,
    capabilities: {
      // The account's size, from the workspace rather than from the row of
      // whoever happens to be signed in.
      //
      // It used to come off `whitbyos_client_members`, which meant the answer
      // depended on which member asked: a ceiling set before somebody was
      // added was never copied onto their row, so the same account was "4 of
      // 4" to one person and unlimited to another. supabase/00056 moved both
      // numbers onto `workspaces`, where one row decides for every client.
      //
      // Null still means no ceiling, and still is not zero — that distinction
      // is why `max_authorized_users` stayed nullable. `max_additional_members`
      // is NOT NULL in the schema, so the fallback below is only reached on an
      // environment without 00056 applied, where inventing a limit would be
      // worse than naming the baseline.
      additionalMembersAllowed: (seats.maxAdditionalMembers ?? 1) > 0,
      maxAdditionalMembers: seats.maxAdditionalMembers,
      authorizedUsersAllowed: (seats.maxAuthorizedUsers ?? 1) > 0,
      maxAuthorizedUsers: seats.maxAuthorizedUsers,
      mayRequestAccess: prefs.may_request_access !== false,
      mayInviteDirectly: prefs.may_invite_directly === true,
      mayAddToRequest: prefs.may_add_to_request !== false,
      mayAddToConversation: prefs.may_add_to_conversation !== false,
    },
  };
});

type MembershipRow = {
  role: string | null;
  portal_access: boolean | null;
  permissions?: unknown;
  whitbyos_clients: unknown;
};

const MEMBERSHIP_COLUMNS =
  "role, portal_access, whitbyos_clients(id, name, workspace_id, preferences)";

/**
 * The membership row, with `permissions` if the column is there.
 *
 * `whitbyos_client_members.permissions` arrives with whitbyos/025. PostgREST
 * answers a request for a column that does not exist with a 400 and no rows, so
 * naming it unconditionally would resolve *every* login to demo mode on an
 * environment a migration behind — the whole portal dark because of one
 * optional column. The retry costs a round trip only where the column is
 * genuinely absent, and `readAreas` reads a missing value as "nothing
 * recorded", which is the access the membership already had.
 */
async function resolveMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string,
): Promise<MembershipRow | null> {
  const withPermissions = await supabase
    .from("whitbyos_client_members")
    .select(`${MEMBERSHIP_COLUMNS}, permissions`)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (!withPermissions.error) {
    return (withPermissions.data as MembershipRow | null) ?? null;
  }

  const { data } = await supabase
    .from("whitbyos_client_members")
    .select(MEMBERSHIP_COLUMNS)
    .eq("contact_id", contactId)
    .maybeSingle();

  return (data as MembershipRow | null) ?? null;
}

/**
 * `workspaces` is closed to a client — `workspaces_select_member` asks for a
 * membership a contacts row can never have — so the zone comes through
 * `portal_workspace_timezone()`, which returns the one column and nothing
 * else (client-portal/008).
 *
 * UTC until that migration is applied, which is what the portal formatted in
 * before it existed. A zone the runtime does not recognise is rejected here
 * rather than at the first `toLocaleString`, where it throws a RangeError in
 * the middle of rendering a page.
 */
async function resolveTimezone(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const { data } = await supabase.rpc("portal_workspace_timezone");
  const zone = typeof data === "string" ? data.trim() : "";
  if (!zone) return "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
}

type SeatLimits = {
  maxAdditionalMembers: number | null;
  maxAuthorizedUsers: number | null;
};

/**
 * The account's two seat ceilings, from `workspaces` (supabase/00056).
 *
 * Same RLS problem as the zone and the firm name: a client matches nothing in
 * `workspaces`. `portal_workspace_seat_limits()` (client-portal/022) is the
 * definer function that hands out these two numbers and nothing else.
 *
 * On an environment a migration behind, PostgREST answers an unknown function
 * with an error rather than rows, and the fallback is the baseline the column
 * itself defaults to. That is deliberately not null: null reads as "no limit"
 * everywhere downstream, so a missing migration would silently hand every
 * account unlimited seats instead of the ten they are entitled to.
 */
async function resolveSeatLimits(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SeatLimits> {
  const { data, error } = await supabase.rpc("portal_workspace_seat_limits");

  // `returns table` comes back as an array of rows; a client whose workspace
  // somehow resolves to nothing gets an empty one.
  const row = Array.isArray(data) ? data[0] : data;

  if (error || !row) {
    return {
      maxAdditionalMembers: DEFAULT_MAX_ADDITIONAL_MEMBERS,
      maxAuthorizedUsers: null,
    };
  }

  const additional = (row as SeatRow).max_additional_members;
  return {
    maxAdditionalMembers:
      typeof additional === "number" ? additional : DEFAULT_MAX_ADDITIONAL_MEMBERS,
    maxAuthorizedUsers: (row as SeatRow).max_authorized_users ?? null,
  };
}

type SeatRow = {
  max_additional_members: number | null;
  max_authorized_users: number | null;
};

/**
 * The professional's firm name, which Settings → Workspace writes.
 *
 * Same RLS problem as the zone: a client cannot select `workspaces`. Prefer
 * `portal_workspace_name()`; until that function exists, read the one column
 * through the service role keyed by the client row this login already holds.
 */
async function resolveProfessionalName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("portal_workspace_name");
  if (!error && typeof data === "string" && data.trim()) return data.trim();

  const { createAdminClient } = await import("@/whitbyos/lib/supabase-admin");
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: workspace } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const name = (workspace?.name as string | undefined)?.trim();
  return name || null;
}

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
};

const CONTACT_COLUMNS = "id, first_name, last_name, preferred_name, email";

/**
 * The explicit link is authoritative. Email matching is kept only as a fallback
 * for accounts provisioned before 001, and is not a long-term path: emails
 * change, alias to the same inbox, and differ in case, none of which should
 * silently re-point a login at a different person's client record.
 */
async function resolveContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string,
): Promise<ContactRow | null> {
  const { data: link } = await supabase
    .from("client_portal_identities")
    .select(`contact_id, contacts(${CONTACT_COLUMNS})`)
    .eq("user_id", userId)
    .maybeSingle();

  const linked = link?.contacts as ContactRow | undefined;
  if (linked) return linked;

  const { data: byEmail } = await supabase
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .ilike("email", email)
    .maybeSingle();

  return (byEmail as ContactRow | null) ?? null;
}

/**
 * The label is derived from the mapped role rather than the raw column, so the
 * name a person is shown and the access they are given cannot disagree — both
 * now come from `toPersonRole`.
 */
function roleLabelFor(role: string | null): string {
  switch (toPersonRole(role)) {
    case "primary_member":
      return "Primary Member";
    case "authorized_user":
      return "Authorized User";
    case "dependent":
      return "Dependent";
    default:
      return "Additional Member";
  }
}

export function portalFirmName(context: PortalContext) {
  return context.professionalName || context.accountName;
}

export function portalBrand(context: PortalContext) {
  return `${portalFirmName(context)} Client Portal`;
}

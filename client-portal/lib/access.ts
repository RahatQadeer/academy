import type { PortalArea, AreaAccess, PortalPersonRole } from "@/client-portal/types";

/**
 * The nine areas of the portal, and what granting one actually means.
 *
 * `whitbyos_client_members.permissions` (whitbyos/025) is the column that
 * carries this. It is jsonb rather than a column per area because §13.14.13
 * describes presets rather than a fixed set of switches, and §13.14.15 lets a
 * single Request be granted on its own — neither of which a boolean column per
 * area would survive.
 *
 * `href` is the nav entry the area owns. Home has no area: it is the landing
 * screen, and it shows only what its reader is permitted to see anyway.
 */
export const PORTAL_AREAS = [
  {
    key: "requests",
    label: "Requests",
    href: "/client-portal/requests",
    what: "See the work in progress and raise new requests.",
  },
  {
    key: "messages",
    label: "Messages",
    href: "/client-portal/messages",
    what: "Take part in conversations with the team.",
  },
  {
    key: "calendar",
    label: "Calendar",
    href: "/client-portal/calendar",
    what: "See appointments and travel on the shared calendar.",
  },
  {
    key: "documents",
    label: "Documents",
    href: "/client-portal/documents",
    what: "Open shared files and upload what is asked for.",
  },
  {
    key: "forms",
    label: "Forms",
    href: "/client-portal/forms",
    what: "Complete and return the forms the team sends.",
  },
  {
    key: "updates",
    label: "Updates",
    href: "/client-portal/updates",
    what: "Read progress updates and share plans of your own.",
  },
  {
    key: "billing",
    label: "Billing",
    href: "/client-portal/billing",
    what: "View invoices, balances and payment history.",
  },
  {
    key: "integrations",
    label: "Integrations",
    href: "/client-portal/integrations",
    what: "Connect their own calendar and email to this account.",
  },
  {
    key: "people",
    label: "People & Access",
    href: "/client-portal/settings/people",
    what: "See everyone on this account and what each of them reaches.",
  },
] as const satisfies readonly {
  key: PortalArea;
  label: string;
  href: string;
  what: string;
}[];

/**
 * The nine keys, and the first of three places they are written down.
 *
 * The other two are `ACCESS_AREAS` in `whitbyos/lib/access-requests-vocab.ts`,
 * which is what the professional ticks, and the key list inside
 * `portal_can_see_billing()` (whitbyos/migrations/066), which is what the
 * database checks when a member's own token asks PostgREST for an invoice
 * directly. Nothing can share one list across TypeScript and a SQL policy, so
 * adding an area means editing all three — and the SQL copy is the one that
 * fails quietly, because it uses the list to decide whether a membership was
 * ever decided about at all.
 */
export const AREA_KEYS = PORTAL_AREAS.map((area) => area.key);

const AREA_KEY_SET = new Set<string>(AREA_KEYS);

export const AREA_LABEL = Object.fromEntries(
  PORTAL_AREAS.map((area) => [area.key, area.label]),
) as Record<PortalArea, string>;

/**
 * Areas 2.1.2.1 does not yet tick, and the area each one follows until it does.
 *
 * `whitbyos/lib/access-requests-vocab.ts` offers four checkboxes — Requests,
 * Messages, Documents, Billing — so a membership approved through that screen
 * has nothing recorded about Calendar, Forms or Updates. Defaulting the three
 * to *on* would let a Billing-only contact read the whole progress feed;
 * defaulting them to *off* would hide a form from someone who has been told to
 * fill it in. Neither is a decision the professional made.
 *
 * All three follow Requests, because all three are views onto the same work:
 * the Calendar is the dates on it, Forms are what it asks the client for, and
 * Updates are what has happened to it. Anyone permitted to see the work is
 * permitted to see those; anyone not, is not.
 *
 * This is a stand-in, not a design. When the professional's screen grows the
 * three checkboxes, they arrive as real keys and this stops being consulted —
 * `readAreas` prefers a written key over a derived one in every case. See the
 * note in `client-portal/migrations/README.md`.
 *
 * `integrations` and `people` are deliberately absent from this map, and that
 * is the whole point of them: an area nobody ticked is an area nobody has. They
 * follow nothing, so a membership approved before 2.1.2.1 grew the two
 * checkboxes reads as denied for both. That does narrow access for memberships
 * already approved through the four-checkbox screen — which is the correct
 * direction to be wrong in, and the only reading under which "they can see what
 * I granted them, and nothing else" is actually true. A membership with *no*
 * area key recorded is untouched: it still inherits everything, by the rule
 * below.
 */
const DERIVED_FROM: Partial<Record<PortalArea, PortalArea>> = {
  calendar: "requests",
  forms: "requests",
  updates: "requests",
};

export const ALL_AREAS: AreaAccess = Object.fromEntries(
  AREA_KEYS.map((key) => [key, true]),
) as AreaAccess;

export type MemberAccess = {
  areas: AreaAccess;
  /**
   * "View only" from GRANT_ROLES — sight of what they are on, and no writes.
   * Reading is still governed per area; this decides whether the write half of
   * a granted area is offered.
   */
  viewOnly: boolean;
  /** True when nothing was ever recorded, so the areas below are inherited. */
  inherited: boolean;
};

/**
 * Reads one membership's `permissions` into the nine areas.
 *
 * Three rules, in order:
 *
 * 1. **A primary member holds the account.** 2.1.2.1 sets permissions for
 *    people the primary asks to have added; it is never shown for the primary
 *    themselves, so their row has nothing in it and never will. Reading that
 *    emptiness as "no access" would lock the account holder out of their own
 *    portal.
 *
 * 2. **Nothing recorded means the access this membership already had.** 025's
 *    own note says an empty object means nothing has been decided — but a
 *    membership created before 025, or by any path other than the approval
 *    screen, has an empty object *and* has been working with full access since
 *    the day it was made. Treating "not decided" as "denied" would silently
 *    revoke access from every existing member the moment this code shipped.
 *    So an object with no area key in it inherits everything, and the caller is
 *    told (`inherited`) so a screen can say the account has no per-area limits
 *    rather than implying the professional chose them.
 *
 * 3. **Otherwise the ticks are the answer.** A key that is present decides its
 *    own area. A key that is absent from an object that *does* carry others
 *    follows `DERIVED_FROM` where it has an entry there, and is denied where it
 *    does not. Denial is the default because this is the branch where somebody
 *    *did* decide: they went through 2.1.2.1 and ticked what they meant to give.
 */
export function readAreas(
  raw: unknown,
  role: PortalPersonRole | null,
): MemberAccess {
  if (role === "primary_member") {
    return { areas: ALL_AREAS, viewOnly: false, inherited: false };
  }

  const permissions =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const written = Object.keys(permissions).filter((key) => AREA_KEY_SET.has(key));
  const viewOnly = permissions.view_only === true;

  if (written.length === 0) {
    return { areas: ALL_AREAS, viewOnly, inherited: true };
  }

  const areas = Object.fromEntries(
    AREA_KEYS.map((key) => {
      if (key in permissions) return [key, permissions[key] === true];
      const follows = DERIVED_FROM[key];
      return [key, follows ? permissions[follows] === true : false];
    }),
  ) as AreaAccess;

  return { areas, viewOnly, inherited: false };
}

/** The areas granted, in nav order, for a one-line summary. */
export function grantedAreas(areas: AreaAccess): PortalArea[] {
  return AREA_KEYS.filter((key) => areas[key]);
}

/**
 * "Requests, Messages and Documents" — the sentence under a person's name.
 *
 * Null when they hold everything, because a list of all nine tells the reader
 * nothing they could not have assumed. The caller says "Full access" instead.
 */
export function areaSummary(areas: AreaAccess): string | null {
  const granted = grantedAreas(areas);
  if (granted.length === AREA_KEYS.length) return null;
  if (granted.length === 0) return "No areas";
  const labels = granted.map((key) => AREA_LABEL[key]);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** Reads a set of area keys off a form, keeping only ones we recognise. */
export function areasFromForm(values: string[]): PortalArea[] {
  const chosen = new Set(values);
  return AREA_KEYS.filter((key) => chosen.has(key));
}

/**
 * `whitbyos_client_members.role` as one of the four the portal draws.
 *
 * The column is `contact_role_label` (00001), a twelve-value enum shared with
 * `contact_roles` and the partner modules. The portal only ever shows four of
 * them, so everything else has to land somewhere deliberately.
 *
 * **`primary_contact` is the account holder.** This is the one that matters:
 * `createClient` in `whitbyos/clients/actions.ts` writes `role:
 * 'primary_contact'` for the person a Client is opened against, and that is how
 * all but one membership in the database is labelled. Reading it as anything
 * else put the account holder in the additional-member bucket — so People &
 * Access drew "No one else on this account" under Primary Member while listing
 * the reader themselves below it, and counted them against the ceiling on
 * people they are allowed to ask for.
 *
 * `primary_member` is the same person under the name `seed_test_account.sql`
 * and the enum's own first value use. Both map here, and neither side has to
 * change to agree with the other.
 *
 * The three "acts for the account, within limits" labels map to Authorized
 * User, which is what the portal calls that person. It is closer than the
 * fallback: Additional Member means a full portal login of one's own, and a
 * billing contact has invoices and nothing else.
 */
const ROLE_ALIASES: Record<string, PortalPersonRole> = {
  primary_member: "primary_member",
  primary_contact: "primary_member",
  additional_member: "additional_member",
  authorized_user: "authorized_user",
  billing_contact: "authorized_user",
  decision_maker: "authorized_user",
  authorized_representative: "authorized_user",
  dependent: "dependent",
};

export function toPersonRole(raw: string | null): PortalPersonRole {
  return (raw && ROLE_ALIASES[raw]) || "additional_member";
}

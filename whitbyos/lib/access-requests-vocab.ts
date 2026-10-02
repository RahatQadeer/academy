/**
 * Screen 2.1.2.1's vocabulary. No server imports — the modal is rendered from
 * the client Contacts tab.
 */

/**
 * What the professional can grant, and the enum values behind them.
 *
 * `contact_role_label` has no "viewer": the closest are family relationships,
 * which is a different kind of fact. So View only is an Additional Member whose
 * permissions grant nothing but sight of what they are on — which is what the
 * words mean anyway, and keeps one vocabulary rather than inventing an enum
 * value the rest of the system would not recognise.
 */
export const GRANT_ROLES = [
  {
    value: "additional_member",
    label: "Member, view and comment",
    viewOnly: false,
  },
  {
    value: "authorized_user",
    label: "Authorized User, full permitted access",
    viewOnly: false,
  },
  {
    value: "view_only",
    label: "View only",
    viewOnly: true,
  },
  /*
   * The two the portal can ask for and this screen could not answer.
   *
   * `REQUESTABLE_ROLES` offers four — Additional Member, Authorized User,
   * Billing Contact, Dependent — and this list held three, none of which were
   * the last two. A request for either arrived with its value missing from the
   * select, so the browser showed the first option instead and approving it
   * granted a full Additional Member: a Dependent, defined in the portal as "a
   * related person on the account with no portal login", was given a login.
   *
   * Both are values `contact_role_label` already has and the portal already
   * maps (`ROLE_ALIASES`), so this is the screen catching up with the schema.
   */
  {
    value: "billing_contact",
    label: "Billing Contact, invoices only",
    viewOnly: false,
  },
  {
    value: "dependent",
    label: "Dependent, on the account with no login",
    viewOnly: false,
  },
] as const;

/**
 * The areas 2.1.2.1 ticks, and what each one lets someone do.
 *
 * Nine, matching the portal's `PORTAL_AREAS` key for key. The export draws
 * four, and the other five were each missing for their own reason.
 *
 * Calendar, Forms and Updates were being derived: `client-portal/lib/access.ts`
 * had all three follow whatever Requests was granted, with a note calling it a
 * stand-in rather than a design. Now that they are ticked here they arrive as
 * written keys, and the portal prefers a written key over a derived one, so the
 * stand-in stops being consulted. They default on with Requests, which is what
 * the derivation did, so nobody's existing access narrows the day this ships.
 *
 * Integrations and People & Access were not derived at all — they were outside
 * the permission system, and the portal drew both for anyone with a login
 * because this screen could not withhold them. They start off, and they follow
 * nothing: connecting a mailbox to the account, and reading the list of
 * everyone on it, are not part of "add my assistant so she can chase a
 * request". That does narrow a membership approved through the four-checkbox
 * screen, unlike the three above, and `readAreas` says why it is the right
 * direction to be wrong in.
 *
 * Keep the keys identical to `client-portal/lib/access.ts` — they are written
 * straight into `whitbyos_client_members.permissions` and read back by key on
 * the other side, and `portal_can_see_billing()` (whitbyos/migrations/061, then
 * 066) hardcodes the same list a third time in SQL. Adding an area means all
 * three: the policy uses its copy to decide whether a membership was ever
 * decided about, so a key it does not know reads as "nothing was decided" and
 * inherits Billing.
 */
export const ACCESS_AREAS = [
  { key: "requests", label: "Requests, view assigned Requests", defaultOn: true },
  { key: "messages", label: "Messages, participate in shared threads", defaultOn: true },
  { key: "calendar", label: "Calendar, see the dates on that work", defaultOn: true },
  { key: "documents", label: "Documents, view and upload", defaultOn: true },
  { key: "forms", label: "Forms, complete what the work asks for", defaultOn: true },
  { key: "updates", label: "Updates, read progress on the work", defaultOn: true },
  { key: "billing", label: "Billing, view invoices and statements", defaultOn: false },
  {
    key: "integrations",
    label: "Integrations, connect their own calendar and email",
    defaultOn: false,
  },
  {
    key: "people",
    label: "People & Access, see everyone on this account",
    defaultOn: false,
  },
] as const;

/** Every key this screen can grant, for reading a request's asked-for list. */
export const ACCESS_AREA_KEYS: string[] = ACCESS_AREAS.map((area) => area.key);

/**
 * The membership role behind a grant.
 *
 * "View only" is not a role — it is an Additional Member whose permissions
 * grant nothing but sight, which is what `permissions.view_only` carries.
 * The other four are the enum's own values.
 */
export function roleFor(grant: string) {
  if (grant === "authorized_user") return "authorized_user";
  if (grant === "billing_contact") return "billing_contact";
  if (grant === "dependent") return "dependent";
  return "additional_member";
}

/**
 * A Dependent is on the account and cannot sign in.
 *
 * The portal says so where it offers the role, so granting one must not open a
 * login or send an invitation — otherwise the words on the two screens
 * describe different things.
 */
export function grantHasLogin(grant: string) {
  return grant !== "dependent";
}

import type { NavItem } from "@/base/components/Sidebar";
import { ALL_AREAS } from "@/client-portal/lib/access";
import type { AreaAccess, PortalArea } from "@/client-portal/types";

/**
 * SRS 13.2.2 — Home, Requests, Calendar, Messages, Updates, Forms, Documents,
 * Billing, Integrations, and now Tasks.
 *
 * Tasks was deliberately absent, on 13.2.3's reasoning that client tasks,
 * approvals, confirmations, forms and uploads all surface through Home →
 * Action Needed. That holds for a task that *is* an action, and it left a real
 * hole beside it: whitbyos/044 lets a Task be named straight to a client
 * account with no Request, and such a task appeared nowhere — the Request
 * screen drops it for having no Request, and Action Needed carries only the
 * ones waiting on the client rather than the work in progress they were told
 * about. The item here is where those are read.
 *
 * `area` is the permission an item needs. Only two items go without one, and
 * neither is a gap: Home shows its reader nothing but the areas they already
 * hold, and Profile & Settings is how a person manages their own account —
 * their password, their notifications, their own contact details — which no
 * grant gives them and none can take away. Everything else, Integrations
 * included, is something the professional decided on 2.1.2.1.
 */
/*
 * Icons and groups, which this rail had neither of.
 *
 * `NavItem` has carried both for as long as Whitby has used them, and the
 * portal set neither — so the client's rail was ten words in a column beside a
 * professional's rail of eighteen labelled, grouped, illustrated rows. The
 * glyph for a thing is the same glyph on both sides: Requests is ☰ in both
 * rails, Documents is ❐ in both, and a client who is shown a screenshot by
 * their attaché is looking at the same mark.
 *
 * The groups are Whitby's own three, minus the ones with nothing in them here.
 * Home, Billing, Integrations and Settings sit outside any group, as Whitby's
 * equivalents do — a heading over a single row is a heading that earns nothing.
 *
 * Grouping matters more here than the count suggests: an item a client cannot
 * open is dropped entirely (see `navFor`), so this rail is between two and ten
 * rows depending on what was granted, and the headings are what stop a
 * four-item rail reading as an offcut of a longer one.
 */
const ITEMS: (NavItem & { area?: PortalArea })[] = [
  { href: "/client-portal", label: "Home", icon: "⌂" },

  { href: "/client-portal/requests", label: "Requests", icon: "☰", area: "requests", group: "Work" },
  // Gated on Requests rather than an area of its own — see AREA_FOR_SECTION in
  // routes.tsx. Every client-visible task, whichever Request it belongs to and
  // whether it belongs to one at all: the Request's own Tasks tab is where one
  // Request's work is read, and this is where the client's own queue is.
  { href: "/client-portal/tasks", label: "Tasks", icon: "☑", area: "requests", group: "Work" },
  { href: "/client-portal/calendar", label: "Calendar", icon: "▦", area: "calendar", group: "Work" },

  { href: "/client-portal/messages", label: "Messages", icon: "✉", area: "messages", group: "Communication" },
  { href: "/client-portal/updates", label: "Updates", icon: "◒", area: "updates", group: "Communication" },

  { href: "/client-portal/forms", label: "Forms", icon: "▧", area: "forms", group: "Content" },
  { href: "/client-portal/documents", label: "Documents", icon: "❐", area: "documents", group: "Content" },

  { href: "/client-portal/billing", label: "Billing", icon: "◧", area: "billing" },
  {
    href: "/client-portal/integrations",
    label: "Integrations",
    icon: "⇄",
    area: "integrations",
  },

  // TEMPORARY — Profile & Settings belongs under the avatar menu (SRS 13.2.4),
  // not in the main nav. Base's Sidebar renders a static user row with no menu
  // slot, so this keeps the six settings pages reachable. Remove this entry once
  // Laiba adds an avatar menu to `base/components/Sidebar.tsx`.
  //
  // The bare /settings rather than /settings/profile, which opens the same
  // pane. The rail marks an item current when the address is it or under it,
  // so with /settings/profile here People & Access and Security matched nothing
  // but Home's /client-portal, and the rail lit Home while you were in Settings.
  { href: "/client-portal/settings", label: "Profile & Settings", icon: "⚙" },
];

/**
 * The nav as a client with full access sees it.
 *
 * Kept as a plain array because the product layout imports every product's nav
 * at module scope, and three of the four are static. `navFor` is what the
 * layout actually renders for this one.
 */
export const NAV: NavItem[] = ITEMS.map((item) => toNavItem(item));

/**
 * The nav this particular client can use.
 *
 * An item they cannot open is left out rather than disabled: a greyed row is a
 * standing reminder of something they were refused, on every screen, forever.
 * `routes.tsx` refuses the address as well, so removing the link is a courtesy
 * and not the enforcement.
 */
export function navFor(
  areas: AreaAccess = ALL_AREAS,
  /**
   * Which screens have something waiting on this person.
   *
   * A form sent back for correction, or a message nobody has read, is only
   * discovered by opening the screen it is on — and a client who opens the
   * portal to do one thing does not open the other eight. The dot is what
   * carries it out to where they are standing.
   */
  waiting: Partial<Record<PortalArea, boolean>> = {},
): NavItem[] {
  return ITEMS.filter((item) => !item.area || areas[item.area]).map((item) =>
    toNavItem(item, item.area ? Boolean(waiting[item.area]) : false),
  );
}

/** Drops `area`, which is this file's bookkeeping and not part of a nav item. */
function toNavItem(
  { href, label, icon, group }: (typeof ITEMS)[number],
  attention = false,
): NavItem {
  const item: NavItem = { href, label, icon, group };
  return attention ? { ...item, attention } : item;
}

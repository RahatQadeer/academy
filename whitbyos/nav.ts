import type { NavItem } from "@/base/components/Sidebar";

/**
 * Whitby's navigation, grouped as the updated Professional Figma shows it.
 *
 * The earlier flat list of 17 (SRS §5.1.1) is still all here — the design adds
 * collapsible headings over it, plus Work Plans as an eighteenth item. Grouping
 * is what §2.2 asks for: a rail that stays lean and collapsible rather than
 * growing forever.
 *
 * Home, Integrations and Settings sit outside any group.
 *
 * Workspace Overview is not among them. It is not a screen inside a workspace
 * — it is the screen you choose one on — and the switcher at the top of the
 * rail already opens it under "Workspaces". A nav item for it sat in
 * the list of places to go *within* the workspace it takes you out of.
 *
 * Companies still have no slot of their own — they live inside Contacts
 * (§5.1.2). Tasks and Calendar stay global as well as nested in a Request
 * (§5.1.3).
 */
/**
 * The nav with a dot on whatever is holding something for the professional.
 *
 * `NAV` stays exactly as it was, because three other products import it at
 * module scope and none of them wants a query run to render a sidebar.
 */
export function navWith(waiting: {
  forms?: boolean;
  clients?: boolean;
  /** How much has been said to this person that they have not read. */
  messages?: number;
  /** One client workspace is open, so the rail's Clients is about that one. */
  oneClient?: boolean;
  /** Hide client-specific items when the organization does not use Client Workspaces. */
  usesClientWorkspaces?: boolean;
}): NavItem[] {
  const items =
    waiting.usesClientWorkspaces === false
      ? NAV.filter((item) => item.href !== "/whitbyos/clients")
      : NAV;

  return items.map((item) => {
    /* The one item that says how many rather than only that there is
       something: a message is a person waiting for an answer, and three of
       them is a different morning from one. */
    if (item.href === "/whitbyos/messages" && (waiting.messages ?? 0) > 0) {
      return { ...item, attention: true, count: waiting.messages };
    }
    if (item.href === "/whitbyos/clients" && waiting.oneClient) {
      return { ...item, label: "Client", attention: waiting.clients || undefined };
    }
    if (item.href === "/whitbyos/forms" && waiting.forms) {
      return { ...item, attention: true };
    }
    // A client has asked for somebody to be given access, and the screen that
    // answers it is inside one client.
    if (item.href === "/whitbyos/clients" && waiting.clients) {
      return { ...item, attention: true };
    }
    return item;
  });
}

export const NAV: NavItem[] = [
  { href: "/whitbyos", label: "Home", icon: "⌂" },

  /*
   * Work first, then who the work is for.
   *
   * The client's own ordering, and it is the right way round: somebody opens
   * this product to get something done, and reaches for a client record
   * because of a piece of work rather than the other way about.
   */
  { href: "/whitbyos/requests", label: "Requests", icon: "☰", group: "Work" },
  { href: "/whitbyos/work-plans", label: "Work Plans", icon: "❖", group: "Work" },
  { href: "/whitbyos/playbooks", label: "Playbooks", icon: "▤", group: "Work" },
  { href: "/whitbyos/tasks", label: "Tasks", icon: "☑", group: "Work" },
  { href: "/whitbyos/calendar", label: "Calendar", icon: "▦", group: "Work" },
  /* Forms sat under Content with Documents and the Knowledge Base, which is
     where a form lives rather than what it is for. A form is how a piece of
     work gets what it needs from somebody, so it belongs beside the work. */
  { href: "/whitbyos/forms", label: "Forms", icon: "▧", group: "Work" },

  { href: "/whitbyos/clients", label: "Clients", icon: "◔", group: "Relationships" },
  { href: "/whitbyos/contacts", label: "Contacts", icon: "⚇", group: "Relationships" },
  { href: "/whitbyos/providers", label: "Providers", icon: "◫", group: "Relationships" },
  /* The firm's own people, which were reachable only from inside Settings.
     They are a relationship the same as a client is, and the screen already
     exists: §11.2.3's Team & Users. */
  { href: "/whitbyos/settings/team", label: "Team Members", icon: "⚈", group: "Relationships" },

  /* "Communication" was one half of what this is. Updates are written to be
     read and answered, so the pair is people working together, not a channel. */
  { href: "/whitbyos/messages", label: "Messages", icon: "✉", group: "Collaboration" },
  { href: "/whitbyos/updates", label: "Updates", icon: "◒", group: "Collaboration" },

  /*
   * Content and Reporting were two headings over one idea.
   *
   * What the firm knows, and what it can say about what it knows: a document,
   * an article, a chart and a report are all the same act of looking things
   * up. Two groups of two and three made the rail longer without making it
   * easier to read.
   */
  { href: "/whitbyos/documents", label: "Documents", icon: "❐", group: "Information" },
  { href: "/whitbyos/knowledge", label: "Knowledge", icon: "▣", group: "Information" },
  { href: "/whitbyos/insights", label: "Insights", icon: "◈", group: "Information" },
  { href: "/whitbyos/reports", label: "Reports", icon: "▥", group: "Information" },

  /*
   * Below the line: the other products, and the plumbing.
   *
   * Everything above is this workspace's own work. These three are not: two
   * are separate products the same account reaches, and the third is what
   * this one is wired to. The rail draws a rule above whatever follows its
   * last group, so the divider the design asks for is already there.
   */
  { href: "/academy", label: "Academy", icon: "◇" },
  { href: "/partner-center", label: "Partners", icon: "◍" },
  { href: "/whitbyos/integrations", label: "Integrations", icon: "⇄" },
  /*
   * The workspace's settings, not the firm's.
   *
   * This rail is everything about one workspace, so Settings on it is how
   * that workspace keeps its work — its time zone, what it tells you about,
   * what it has billed, what it has put away. The organization's own settings
   * are the firm's whether or not a workspace is open, and are opened from
   * the cog on Workspace Overview.
   */
  { href: "/whitbyos/settings/workspace", label: "Settings", icon: "⚙" },
];

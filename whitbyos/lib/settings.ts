import { getWorkspaceLogoUrl } from "@/base/lib/logo";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { NOTIFICATION_EVENTS, ROLE_LABELS } from "@/whitbyos/lib/settings-vocab";

export type SettingsProfile = {
  userId: string;
  fullName: string;
  email: string;
  roleLabel: string;
  avatarUrl: string | null;
  initials: string;
  workspaceName: string;
  /** Everyone else still active here, which decides what deleting costs. */
  teammateCount: number;
  clientCount: number;
  openRequestCount: number;
};

/**
 * Screen 17 — the Profile tab, and what the account is attached to.
 *
 * The counts are not decoration. Deleting the only account in a workspace with
 * live clients is a different act from deleting one of six, and the screen has
 * to be able to say which one this is before anyone presses anything.
 */
export async function getSettingsProfile(): Promise<SettingsProfile | null> {
  const profile = await getSessionProfile();
  const workspaceId = await getCurrentWorkspaceId();
  if (!profile || !workspaceId) return null;

  const supabase = await createClient();

  const [{ data: user }, { data: workspace }, { data: members }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, preferred_name, email, avatar_url")
      .eq("id", profile.user.id)
      .maybeSingle(),
    supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),
  ]);

  const [{ count: clientCount }, { count: openRequestCount }] = await Promise.all([
    supabase
      .from("whitbyos_clients")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("whitbyos_requests")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .not("status", "in", '("completed","cancelled","closed")'),
  ]);

  const mine = (members ?? []).find((row) => row.user_id === profile.user.id);
  const fullName =
    (user?.full_name as string) || (user?.preferred_name as string) || "";
  const email = (user?.email as string) || "";

  return {
    userId: profile.user.id,
    fullName,
    email,
    roleLabel: ROLE_LABELS[(mine?.role as string) ?? ""] ?? "Member",
    avatarUrl: (user?.avatar_url as string | null) ?? null,
    initials: initialsOf(fullName || email),
    workspaceName: (workspace?.name as string) || "your workspace",
    teammateCount: Math.max((members ?? []).length - 1, 0),
    clientCount: clientCount ?? 0,
    openRequestCount: openRequestCount ?? 0,
  };
}

function initialsOf(name: string) {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}


export type WorkspaceSettings = {
  id: string;
  name: string;
  urlSlug: string;
  logoUrl: string | null;
  timezone: string;
  currency: string;
  classifications: string[];
  /** Null where the workspace has never chosen — not the same as choosing none. */
  portalDefaultAreas: string[] | null;
  /** False closes the portal to every client of this workspace. */
  portalEnabled: boolean;
  /** When false, Clients nav and client-scoped restrictions are hidden. */
  usesClientWorkspaces: boolean;
};

/** Screen 17.1. Name, URL and time zone are base; the rest is Whitby's own. */
export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();

  const [{ data: workspace }, { data: settings }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, url_slug, timezone, logo_url")
      .eq("id", workspaceId)
      .maybeSingle(),
    supabase
      .from("whitbyos_workspace_settings")
      .select(
        "default_currency, client_classifications, portal_default_areas, portal_enabled, uses_client_workspaces",
      )
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);

  if (!workspace) return null;

  return {
    id: workspace.id as string,
    name: (workspace.name as string) ?? "",
    urlSlug: (workspace.url_slug as string) ?? "",
    // Signed here rather than in the page: the bucket is private and the
    // stored value is a path.
    logoUrl: await getWorkspaceLogoUrl(workspace.logo_url as string | null),
    timezone: (workspace.timezone as string) ?? "America/New_York",
    currency: (settings?.default_currency as string) ?? "USD",
    classifications:
      (settings?.client_classifications as string[]) ?? [
        "Individual",
        "Family",
        "Household",
        "Company",
        "Organization",
      ],
    /* Null is "never chosen", which keeps the built-in list rather than
       meaning nobody gets anything. */
    portalDefaultAreas: Array.isArray(settings?.portal_default_areas)
      ? (settings?.portal_default_areas as string[])
      : null,
    // Absence is openness: a workspace with no row has never closed anything.
    portalEnabled: settings?.portal_enabled !== false,
    usesClientWorkspaces: settings?.uses_client_workspaces !== false,
  };
}

export type TeamMember = {
  userId: string | null;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  status: "active" | "invited" | "expired";
  initials: string;
  isSelf: boolean;
  /** Whether there is a photo to fetch — an invitee has no account, so never. */
  hasPhoto: boolean;
  /** Set only for someone who has not accepted, so it can be sent again. */
  invitationEmail: string | null;
};

/**
 * Screen 17.2 — everyone in the workspace, whether or not they have arrived.
 *
 * Members and outstanding invitations are one list because the export draws
 * them as one: Sam Okafor sits between two Active people with an Invited pill.
 * A person who has not accepted has no account yet and so no row in `users` —
 * they exist only as an invitation, which is where their name and role come
 * from.
 */
export async function listTeam(): Promise<TeamMember[]> {
  const workspaceId = await getCurrentWorkspaceId();
  const profile = await getSessionProfile();
  if (!workspaceId || !profile) return [];

  const supabase = await createClient();

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("user_id, role, status, created_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("created_at"),
    supabase
      .from("invitations")
      .select("invitee_email, invitee_name, role_or_relationship, status, expires_at, sent_at")
      .eq("context_type", "team_member")
      .eq("context_id", workspaceId)
      .eq("status", "pending")
      .order("sent_at", { ascending: false }),
  ]);

  const ids = (members ?? []).map((row) => row.user_id as string);

  const people = new Map<string, { name: string; email: string; hasPhoto: boolean }>();
  if (ids.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, preferred_name, email, avatar_url")
      .in("id", ids);

    for (const row of users ?? []) {
      people.set(row.id as string, {
        name:
          (row.preferred_name as string) ||
          (row.full_name as string) ||
          (row.email as string) ||
          "Teammate",
        email: (row.email as string) ?? "",
        hasPhoto: Boolean(row.avatar_url),
      });
    }
  }

  const joined: TeamMember[] = (members ?? []).map((row) => {
    const userId = row.user_id as string;
    const person = people.get(userId);
    const role = (row.role as string) ?? "viewer";

    return {
      userId,
      name: person?.name ?? "Teammate",
      email: person?.email ?? "",
      role,
      roleLabel: ROLE_LABELS[role] ?? "Member",
      status: "active",
      initials: initialsOf(person?.name ?? person?.email ?? "?"),
      isSelf: userId === profile.user.id,
      hasPhoto: person?.hasPhoto ?? false,
      invitationEmail: null,
    };
  });

  const already = new Set(joined.map((row) => row.email.toLowerCase()));
  const seen = new Set<string>();

  const waiting: TeamMember[] = [];
  for (const row of invitations ?? []) {
    const email = String(row.invitee_email ?? "").trim();
    const key = email.toLowerCase();

    // Someone who accepted is already above; a second invitation to the same
    // address is the same person waiting, not two of them.
    if (!email || already.has(key) || seen.has(key)) continue;
    seen.add(key);

    const role = (row.role_or_relationship as string) ?? "viewer";
    const lapsed = row.expires_at ? new Date(row.expires_at as string) < new Date() : false;

    waiting.push({
      userId: null,
      name: (row.invitee_name as string) || email,
      email,
      role,
      roleLabel: ROLE_LABELS[role] ?? "Member",
      status: lapsed ? "expired" : "invited",
      initials: initialsOf((row.invitee_name as string) || email),
      isSelf: false,
      hasPhoto: false,
      invitationEmail: email,
    });
  }

  return [...joined, ...waiting];
}

/**
 * Screen 17.3. Only what someone has switched off is stored, so anything
 * missing is on — which is how the export draws a new account.
 */
export async function getNotificationPrefs(): Promise<Record<string, boolean>> {
  const workspaceId = await getCurrentWorkspaceId();
  const profile = await getSessionProfile();

  const prefs: Record<string, boolean> = {};
  for (const event of NOTIFICATION_EVENTS) prefs[`${event.channel}:${event.key}`] = true;

  if (!workspaceId || !profile) return prefs;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_notification_prefs")
    .select("event_type, channel, enabled")
    .eq("user_id", profile.user.id)
    .eq("workspace_id", workspaceId);

  for (const row of data ?? []) {
    prefs[`${row.channel}:${row.event_type}`] = Boolean(row.enabled);
  }

  return prefs;
}

export type BillingSummary = {
  seatsUsed: number;
  /** Which plan the workspace is on. 17.4 marks it "Current plan". */
  plan: string;
  /** Whether this deployment can actually take money. */
  connected: boolean;
  /** What Stripe says about the subscription, where there is one. */
  status: string | null;
  renewsAt: string | null;
  startedAt: string | null;
  trialEndsAt: string | null;
  cancelling: boolean;
  hasSubscription: boolean;
  team: { name: string; roleLabel: string }[];
};

/**
 * Screen 17.4.
 *
 * The export fills this in — a plan name, a renewal date, an AI credit balance
 * — and every one of those figures belongs to Stripe (§11.1.5), which is not
 * connected in any environment. So the rows are drawn and each says where its
 * answer will come from, rather than showing a number nobody can stand behind.
 *
 * Seats are the exception: that is a count of this workspace's own members, and
 * it is real.
 */
export async function getBillingSummary(): Promise<BillingSummary> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return {
      seatsUsed: 0,
      plan: "trial",
      connected: false,
      status: null,
      renewsAt: null,
      startedAt: null,
      trialEndsAt: null,
      cancelling: false,
      hasSubscription: false,
      team: [],
    };
  }

  const { getCurrentWorkspacePlan } = await import("@/whitbyos/lib/workspace");
  const { stripeConfigured } = await import("@/whitbyos/lib/stripe/server");
  const supabase = await createClient();

  const [team, plan, { data: workspace }] = await Promise.all([
    listTeam(),
    getCurrentWorkspacePlan(),
    supabase
      .from("workspaces")
      .select(
        "stripe_subscription_id, subscription_status, current_period_end, cancel_at_period_end, subscription_started_at, trial_ends_at",
      )
      .eq("id", workspaceId)
      .maybeSingle(),
  ]);

  return {
    seatsUsed: team.filter((row) => row.status === "active").length,
    plan,
    connected: stripeConfigured(),
    status: (workspace?.subscription_status as string | null) ?? null,
    renewsAt: (workspace?.current_period_end as string | null) ?? null,
    startedAt: (workspace?.subscription_started_at as string | null) ?? null,
    trialEndsAt: (workspace?.trial_ends_at as string | null) ?? null,
    cancelling: Boolean(workspace?.cancel_at_period_end),
    hasSubscription: Boolean(workspace?.stripe_subscription_id),
    team: team
      .filter((row) => row.status === "active")
      .map((row) => ({ name: row.name, roleLabel: row.roleLabel })),
  };
}

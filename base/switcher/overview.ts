import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";

/**
 * Screen 0.01 — the figure each product card carries, and the panel behind it.
 *
 * Counts are read from the tables that already hold them. The switcher sits
 * above a single workspace, so Whitby figures are summed across every
 * workspace the professional belongs to.
 */

export type ProductFigure = {
  figure: string;
  unit: string;
  trend: string;
  direction: "up" | "down" | "flat" | null;
};

export type GlanceStat = {
  value: string;
  label: string;
  trend: string;
  direction: "up" | "down" | "flat";
};

export type GlanceRequest = {
  id: string;
  title: string;
  client: string;
  status: string;
  colour: string;
};

export type GlanceCourse = {
  name: string;
  progress: number;
};

export type SwitcherOverview = {
  figures: Record<string, ProductFigure>;
  whitby: {
    stats: GlanceStat[];
    weeks: number[];
    weekLabels: string[];
    byStatus: { label: string; count: number; colour: string }[];
    recent: GlanceRequest[];
    households: string[];
  };
  portal: { enabled: number; workspaces: number; signInsThisWeek: number };
  academy: { inProgress: number; enrolled: number; courses: GlanceCourse[] };
  partner: { status: string | null; referrals: number };
};

const CLOSED = new Set(["complete", "completed", "closed", "cancelled", "done"]);

const STATUS_COLOURS: Record<string, string> = {
  running: "#2383e2",
  open: "#2383e2",
  waiting: "#e0a940",
  not_started: "#c4c4c0",
  blocked: "#c2382f",
  approval: "#8a6f3e",
  at_risk: "#c2382f",
  manual: "#6b4fa8",
};

function movement(now: number, before: number): ProductFigure["direction"] {
  if (now > before) return "up";
  if (now < before) return "down";
  return "flat";
}

function trendWords(now: number, before: number, period: string) {
  const change = now - before;
  if (change === 0) return `Unchanged ${period}`;
  return `${change > 0 ? "▲" : "▼"} ${Math.abs(change)} ${period}`;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function labelStatus(status: string) {
  return status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Partner profile lifecycle — not Academy "enrolled". */
function partnerStatusLabel(status: string) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "applied":
      return "Applied";
    case "under_review":
      return "Under review";
    case "approved":
      return "Approved";
    case "active":
      return "Active";
    case "declined":
      return "Declined";
    default:
      return labelStatus(status);
  }
}

export const EMPTY_OVERVIEW: SwitcherOverview = {
  figures: {},
  whitby: { stats: [], weeks: [], weekLabels: [], byStatus: [], recent: [], households: [] },
  portal: { enabled: 0, workspaces: 0, signInsThisWeek: 0 },
  academy: { inProgress: 0, enrolled: 0, courses: [] },
  partner: { status: null, referrals: 0 },
};

export async function getSwitcherOverview(): Promise<SwitcherOverview> {
  const profile = await getSessionProfile();
  const workspaceIds = (profile?.workspaces ?? []).map((row) => row.id).filter(Boolean);
  if (!profile || workspaceIds.length === 0) return EMPTY_OVERVIEW;

  const supabase = await createClient();
  const now = new Date();
  const today = startOfDay(now);
  const todayKey = today.toISOString().slice(0, 10);
  const quarterAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [clientsResult, requestsResult, tasksResult, academyResult, partner] = await Promise.all([
    supabase
      .from("whitbyos_clients")
      .select("id, name, created_at, archived_at")
      .in("workspace_id", workspaceIds),
    supabase
      .from("whitbyos_requests")
      .select(
        "id, title, status, created_at, closed_at, target_date, updated_at, client:whitbyos_clients!client_id (name)",
      )
      .in("workspace_id", workspaceIds)
      .order("updated_at", { ascending: false }),
    supabase
      .from("whitbyos_tasks")
      .select("id, status, due_date")
      .in("workspace_id", workspaceIds),
    supabase
      .from("academy_enrollments")
      .select("id, status, progress_percent, academy_programs ( name )")
      .eq("user_id", profile.user.id)
      .order("enrolled_at", { ascending: false }),
    resolvePartner(profile.user, profile.entitlements),
  ]);

  const clients = (clientsResult.data ?? []).filter((row) => !row.archived_at);
  const clientIds = clients.map((row) => row.id as string);
  const newThisQuarter = clients.filter(
    (row) => String(row.created_at ?? "") >= quarterAgo,
  ).length;

  const [{ data: memberRows }, portalResult, referralResult] = await Promise.all([
    clientIds.length
      ? supabase
          .from("whitbyos_client_members")
          .select("client_id, portal_access")
          .in("client_id", clientIds)
      : Promise.resolve({ data: [] as { client_id: string; portal_access: boolean }[] }),
    supabase
      .from("client_portal_identities")
      .select("user_id, user:users!user_id (last_login_at)")
      .limit(500),
    partner?.profile?.id
      ? supabase
          .from("partner_referrals")
          .select("id", { count: "exact", head: true })
          .eq("partner_profile_id", partner.profile.id)
      : Promise.resolve({ count: 0 }),
  ]);

  const requests = requestsResult.data ?? [];
  const open = requests.filter((row) => !CLOSED.has(String(row.status).toLowerCase()));
  const openLastWeek = requests.filter((row) => {
    if (String(row.created_at ?? "") > weekAgo) return false;
    const closed = row.closed_at ? String(row.closed_at) : null;
    return closed === null || closed > weekAgo;
  }).length;

  const overdue = open.filter((row) => {
    const due = row.target_date as string | null;
    if (!due) return false;
    return startOfDay(new Date(due)).getTime() < today.getTime();
  }).length;

  const tasks = tasksResult.data ?? [];
  const dueToday = tasks.filter((row) => {
    if (CLOSED.has(String(row.status).toLowerCase())) return false;
    return String(row.due_date ?? "").slice(0, 10) === todayKey;
  }).length;

  const portalsOn = new Set(
    (memberRows ?? [])
      .filter((row) => row.portal_access && clientIds.includes(row.client_id as string))
      .map((row) => row.client_id as string),
  ).size;

  const signedInThisWeek = (portalResult.data ?? []).filter((row) => {
    const linked = row.user as { last_login_at?: string | null }[] | { last_login_at?: string | null } | null;
    const user = Array.isArray(linked) ? linked[0] : linked;
    return String(user?.last_login_at ?? "") >= weekAgo;
  }).length;

  const enrolments = academyResult.data ?? [];
  const courses: GlanceCourse[] = enrolments.map((row) => {
    const program = firstOf(
      row.academy_programs as { name?: string }[] | { name?: string } | null,
    );
    return {
      name: program?.name?.trim() || "Untitled programme",
      progress: Math.max(0, Math.min(100, Number(row.progress_percent ?? 0))),
    };
  });
  const inProgress = enrolments.filter((row) => {
    const status = String(row.status ?? "").toLowerCase();
    return status === "in_progress" || status === "enrolled";
  }).length;

  const weeks: number[] = [];
  const weekLabels: string[] = [];
  for (let index = 7; index >= 0; index -= 1) {
    const edge = new Date(now.getTime() - index * 7 * 86_400_000);
    weekLabels.push(edge.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    const stamp = edge.toISOString();
    weeks.push(
      requests.filter((row) => {
        if (String(row.created_at ?? "") > stamp) return false;
        const closed = row.closed_at ? String(row.closed_at) : null;
        return closed === null || closed > stamp;
      }).length,
    );
  }

  const counts = new Map<string, number>();
  for (const row of open) {
    const status = String(row.status).toLowerCase();
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  const recent: GlanceRequest[] = open.slice(0, 5).map((row) => {
    const status = String(row.status).toLowerCase();
    const client = firstOf(row.client as { name?: string }[] | { name?: string } | null);
    return {
      id: row.id as string,
      title: (row.title as string) || "Untitled request",
      client: client?.name?.trim() || "No client",
      status: labelStatus(status),
      colour: STATUS_COLOURS[status] ?? "#8a8a86",
    };
  });

  // Real partner_profiles.status only — never invent "Enrolled" for bare access.
  const partnerStatus =
    partner?.profile?.status ?? (partner ? "not_started" : null);

  return {
    figures: {
      whitbyos: {
        figure: String(clients.length),
        unit: clients.length === 1 ? "active workspace" : "active workspaces",
        trend: trendWords(clients.length, clients.length - newThisQuarter, "this quarter"),
        direction: newThisQuarter > 0 ? "up" : "flat",
      },
      client_portal: {
        figure: String(portalsOn),
        unit: `portal${portalsOn === 1 ? "" : "s"} enabled, of ${clients.length} workspace${clients.length === 1 ? "" : "s"}`,
        trend:
          signedInThisWeek > 0
            ? `${signedInThisWeek} client sign-in${signedInThisWeek === 1 ? "" : "s"} this week`
            : "No client sign-ins this week",
        direction: signedInThisWeek > 0 ? "up" : null,
      },
      academy: {
        figure: inProgress > 0 ? String(inProgress) : enrolments.length > 0 ? "0" : "Not started",
        unit:
          inProgress > 0
            ? inProgress === 1
              ? "course in progress"
              : "courses in progress"
            : enrolments.length > 0
              ? "courses in progress"
              : "enrol to begin",
        trend:
          enrolments.length > 0
            ? `${enrolments.length} course${enrolments.length === 1 ? "" : "s"} enrolled`
            : "Professional education for coordination",
        direction: null,
      },
      partner_center: {
        figure: partnerStatus
          ? partnerStatusLabel(partnerStatus)
          : "Not enrolled",
        unit: partner?.profile ? "partner status" : "join to start earning",
        trend: "Earn referral commission on introductions",
        direction: null,
      },
    },
    whitby: {
      stats: [
        {
          value: String(clients.length),
          label: "Workspaces",
          trend: trendWords(clients.length, clients.length - newThisQuarter, "this quarter"),
          direction: newThisQuarter > 0 ? "up" : "flat",
        },
        {
          value: String(open.length),
          label: "Active requests",
          trend: trendWords(open.length, openLastWeek, "vs last week"),
          direction: movement(open.length, openLastWeek) ?? "flat",
        },
        {
          value: String(overdue),
          label: "Overdue",
          trend: overdue > 0 ? "Past target date" : "None overdue",
          direction: overdue > 0 ? "down" : "flat",
        },
        {
          value: String(dueToday),
          label: "Tasks due today",
          trend: dueToday > 0 ? "On today's list" : "Nothing due today",
          direction: "flat",
        },
      ],
      weeks,
      weekLabels,
      byStatus: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({
          label: labelStatus(status),
          count,
          colour: STATUS_COLOURS[status] ?? "#8a8a86",
        })),
      recent,
      households: clients
        .map((row) => String(row.name ?? "").trim())
        .filter(Boolean)
        .slice(0, 8),
    },
    portal: {
      enabled: portalsOn,
      workspaces: clients.length,
      signInsThisWeek: signedInThisWeek,
    },
    academy: { inProgress, enrolled: enrolments.length, courses },
    partner: {
      status: partnerStatus,
      referrals: referralResult.count ?? 0,
    },
  };
}

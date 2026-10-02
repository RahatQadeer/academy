import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { photosFor } from "@/whitbyos/lib/people-photos";

/**
 * What screen 1's widgets show.
 *
 * The dashboard used to be three counts and one table of Requests. The export
 * draws four counts and seven widgets, three in the wide column and the rest
 * in the rail, so this is where the rest of them come from. Every figure is
 * counted at read time from the work itself, the rule §6.6.10 sets: a number
 * kept on the side drifts the moment anything changes.
 */

const CLOSED = new Set(["complete", "completed", "closed", "cancelled", "done"]);

export type OutstandingRow = {
  id: string;
  title: string;
  client: string;
  /**
   * Whose it is, not just what they are called.
   *
   * Workspace Overview opens the client workspace an item belongs to on the
   * way to the item, so a name is not enough — two clients can share one.
   */
  clientId: string | null;
  /** "3d overdue", "Waiting on you", the words beside the row in the export. */
  note: string;
  tone: "danger" | "warning";
};

export type OverdueTaskRow = {
  id: string;
  title: string;
  context: string;
  requestId: string | null;
};

export type FeedRow = {
  id: string;
  /** Whoever wrote it, shortened. "MS" was hardcoded on every message. */
  initials: string;
  /** Their photograph, where they have added one. */
  photo?: string | null;
  /** Whitby's own square mark rather than a person's round one. */
  whitby: boolean;
  text: string;
  context: string;
  at: string;
  href: string | null;
};

export type WeekRow = { id: string; day: string; title: string; at: string };

export type ProviderRow = { id: string; name: string; note: string };

/** One day of the fortnight ahead, and what falls due on it. */
export type LoadRow = {
  /** "Thu", under the column. */
  label: string;
  /** "Thu 18 Sep", on hover. */
  full: string;
  count: number;
  today: boolean;
  /** Everything behind, stacked on the first column rather than lost. */
  late?: boolean;
};

export type HomeWidgets = {
  /** 1's four counts, in its order. */
  activeRequests: number;
  overdueItems: number;
  tasksDueToday: number;
  /**
   * How many client workspaces the firm has — or, with one of them open,
   * how many tasks are unfinished in it.
   *
   * "1 Workspace" is true and says nothing. The tile keeps its place
   * and its shape; what it counts follows what the rest of the screen is
   * about. `scopedToOneClient` is how the screen knows which it is holding.
   */
  clientWorkspaces: number;
  scopedToOneClient: boolean;

  outstanding: OutstandingRow[];
  overdueTasks: OverdueTaskRow[];
  feed: FeedRow[];
  thisWeek: WeekRow[];
  /** What is due each day for a fortnight, late first — Home's one chart. */
  load: LoadRow[];
  insights: { completedThisMonth: number; avgTurnaround: string; activeRequests: number };
  teamActivity: FeedRow[];
  providers: ProviderRow[];
};

const EMPTY: HomeWidgets = {
  activeRequests: 0,
  overdueItems: 0,
  tasksDueToday: 0,
  clientWorkspaces: 0,
  scopedToOneClient: false,
  outstanding: [],
  overdueTasks: [],
  feed: [],
  thisWeek: [],
  load: [],
  insights: {
    completedThisMonth: 0,
    avgTurnaround: "Nothing closed this month",
    activeRequests: 0,
  },
  teamActivity: [],
  providers: [],
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** How many whole days ago a date was. Negative means it is still ahead. */
function daysBehind(value: string | null) {
  if (!value) return null;
  const due = startOfDay(new Date(value));
  const today = startOfDay(new Date());
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
}

/** "Mon 24", the label the export puts down the left of This Week. */
function dayLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Home, for whoever's work is open.
 *
 * `openClient` is a parameter rather than something read inside, because this
 * is called from two screens that want opposite things: Home wants the client
 * whose workspace is open, and Workspace Overview — the screen that choice is
 * made on — wants every client at once. A function that read the cookie itself
 * could not serve the second, which is the screen you go to precisely to get
 * above the first.
 */
export async function getHomeWidgets(
  openClient?: string | null,
): Promise<HomeWidgets> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return EMPTY;

  const supabase = await createClient();

  /**
   * Narrowed after the read rather than in it.
   *
   * These are a workspace's own rows and there are not many; adding a filter
   * to each query means adding it to six builders whose types do not survive
   * being passed through a helper. One predicate, applied to what comes back,
   * is the same answer and one place to be wrong.
   */
  const ours = <T extends { client_id?: string | null }>(rows: T[] | null) =>
    (rows ?? []).filter((row) => !openClient || row.client_id === openClient);
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = startOfDay(now).toISOString().slice(0, 10);

  const [requestsResult, tasksResult, clientsResult, eventsResult, messagesResult, updatesResult, providersResult] =
    await Promise.all([
      supabase
        .from("whitbyos_requests")
        .select(
          "id, title, status, target_date, created_at, closed_at, client_id, client:whitbyos_clients!client_id (name)",
        )
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("whitbyos_tasks")
        .select(
          "id, title, status, due_date, request_id, client_id, request:whitbyos_requests!request_id (title)",
        )
        .eq("workspace_id", workspaceId)
        .order("due_date", { ascending: true }),
      supabase
        .from("whitbyos_clients")
        .select("id, archived_at")
        .eq("workspace_id", workspaceId),
      supabase
        .from("whitbyos_calendar_events")
        .select("id, title, start_at, client_id")
        .eq("workspace_id", workspaceId)
        .gte("start_at", now.toISOString())
        .lte("start_at", weekAhead.toISOString())
        .order("start_at", { ascending: true })
        .limit(5),
      supabase
        .from("whitbyos_messages")
        .select(
          "id, body, created_at, request_id, client_id, sender_type, sender_id, request:whitbyos_requests!request_id (title)",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("whitbyos_updates")
        .select("id, headline, body, published_at, created_at, request_id, request:whitbyos_requests!request_id (title)")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(6),
      supabase
        .from("whitbyos_providers")
        .select("id, outreach_status, next_follow_up_date, last_contact_date, contact:contacts!contact_id (full_name)")
        .eq("workspace_id", workspaceId)
        .is("archived_at", null)
        .limit(20),
    ]);

  const requests = ours(requestsResult.data);
  const openRequests = requests.filter((row) => !CLOSED.has(String(row.status).toLowerCase()));

  const tasks = ours(tasksResult.data);
  const openTasks = tasks.filter((row) => !CLOSED.has(String(row.status).toLowerCase()));

  // Screen 1's "Outstanding & Overdue": what has stopped, worst first. An
  // overdue Request outranks one merely waiting, because one of them has a
  // date that has already passed.
  const outstanding: OutstandingRow[] = openRequests
    .map((row) => {
      const late = daysBehind(row.target_date as string | null);
      const waiting = String(row.status).toLowerCase() === "waiting";
      const client = firstOf(row.client as unknown as { name: string }[] | { name: string } | null);

      if (late !== null && late > 0) {
        return {
          id: row.id as string,
          title: row.title as string,
          client: client?.name ?? "No client",
          clientId: (row.client_id as string | null) ?? null,
          note: `Overdue by ${late} ${late === 1 ? "day" : "days"}`,
          tone: "danger" as const,
          rank: 1000 + late,
        };
      }
      if (waiting) {
        return {
          id: row.id as string,
          title: row.title as string,
          client: client?.name ?? "No client",
          clientId: (row.client_id as string | null) ?? null,
          note: "Waiting on you",
          tone: "warning" as const,
          rank: 500,
        };
      }
      return null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 4)
    .map(({ rank: _rank, ...row }) => row);

  const overdueTasks: OverdueTaskRow[] = openTasks
    .filter((row) => {
      const late = daysBehind(row.due_date as string | null);
      return late !== null && late > 0;
    })
    .slice(0, 4)
    .map((row) => {
      const request = firstOf(row.request as unknown as { title: string }[] | { title: string } | null);
      return {
        id: row.id as string,
        title: row.title as string,
        context: request?.title ?? "No request",
        requestId: (row.request_id as string | null) ?? null,
      };
    });

  const tasksDueToday = openTasks.filter(
    (row) => String(row.due_date ?? "").slice(0, 10) === today,
  ).length;

  const overdueItems =
    openRequests.filter((row) => {
      const late = daysBehind(row.target_date as string | null);
      return late !== null && late > 0;
    }).length +
    openTasks.filter((row) => {
      const late = daysBehind(row.due_date as string | null);
      return late !== null && late > 0;
    }).length;

  /*
   * Who wrote each message, and their face.
   *
   * Every row on this feed drew "MS" — not an abbreviation of anything, a
   * literal, on a screen whose whole job is to say what has just happened and
   * who it came from. The senders are a mix of the firm's own people and
   * clients' contacts, which is two tables and two places a photograph can
   * live; `photosFor` already knows both.
   */
  const senders = ours(messagesResult.data);
  const senderNames = new Map<string, string>();

  const userSenders = [
    ...new Set(
      senders.filter((row) => row.sender_type === "user").map((row) => row.sender_id as string),
    ),
  ];
  const contactSenders = [
    ...new Set(
      senders.filter((row) => row.sender_type === "contact").map((row) => row.sender_id as string),
    ),
  ];

  let senderPhotos = new Map<string, string>();

  if (userSenders.length > 0 || contactSenders.length > 0) {
    const [{ data: senderUsers }, { data: senderContacts }, photos] = await Promise.all([
      userSenders.length
        ? supabase.from("users").select("id, full_name, preferred_name").in("id", userSenders)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null; preferred_name: string | null }[] }),
      contactSenders.length
        ? supabase
            .from("contacts")
            .select("id, first_name, last_name, preferred_name")
            .in("id", contactSenders)
        : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; preferred_name: string | null }[] }),
      photosFor(supabase, { userIds: userSenders, contactIds: contactSenders }),
    ]);

    for (const row of senderUsers ?? []) {
      senderNames.set(
        row.id as string,
        (row.preferred_name as string) || (row.full_name as string) || "Teammate",
      );
    }
    for (const row of senderContacts ?? []) {
      senderNames.set(
        row.id as string,
        (row.preferred_name as string) ||
          [row.first_name, row.last_name].filter(Boolean).join(" ") ||
          "Contact",
      );
    }

    senderPhotos = photos;
  }

  // Messages and Updates are one feed on this screen, newest first, which is
  // what "Recent Messages & Updates" means.
  const feed: FeedRow[] = [
    ...senders.map((row) => {
      const request = firstOf(row.request as unknown as { title: string }[] | { title: string } | null);
      const who = senderNames.get(row.sender_id as string) ?? "Unknown";
      return {
        id: `m-${row.id}`,
        initials: initialsOf(who),
        photo: senderPhotos.get(row.sender_id as string) ?? null,
        whitby: false,
        text: String(row.body ?? "").slice(0, 120),
        context: request?.title ?? "No request",
        at: row.created_at as string,
        href: row.request_id ? `/whitbyos/requests/${row.request_id}` : "/whitbyos/messages",
      };
    }),
    ...(updatesResult.data ?? []).map((row) => {
      const request = firstOf(row.request as unknown as { title: string }[] | { title: string } | null);
      return {
        id: `u-${row.id}`,
        initials: "W",
        whitby: true,
        text: (row.headline as string | null) || String(row.body ?? "").slice(0, 120),
        context: request?.title ?? "No request",
        at: (row.published_at as string) ?? (row.created_at as string),
        href: row.request_id ? `/whitbyos/requests/${row.request_id}` : "/whitbyos/updates",
      };
    }),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 3);

  const thisWeek: WeekRow[] = ours(eventsResult.data)
    .slice(0, 3)
    .map((row) => ({
      id: row.id as string,
      day: dayLabel(row.start_at as string),
      title: row.title as string,
      at: row.start_at as string,
    }));

  /*
   * What is coming, by day.
   *
   * Counts say how much; they cannot say when it lands, and "3 tasks due
   * today" beside "5 open" leaves the shape of the week unsaid — four of them
   * on Thursday is a different week from one a day. Read off the tasks already
   * in hand, so the chart costs nothing.
   *
   * The first column is everything already behind. Dropping it would draw a
   * fortnight that looks clear while the backlog sits outside the picture.
   */
  const load: LoadRow[] = [
    {
      label: "Late",
      full: "Already past its date",
      late: true,
      today: false,
      count: openTasks.filter((row) => (daysBehind(row.due_date as string | null) ?? -1) > 0)
        .length,
    },
  ];

  for (let ahead = 0; ahead < 14; ahead += 1) {
    const day = startOfDay(new Date());
    day.setDate(day.getDate() + ahead);
    const stamp = day.toISOString().slice(0, 10);

    load.push({
      label:
        ahead === 0
          ? "Today"
          : day.toLocaleDateString("en-GB", { weekday: "narrow" }),
      full: day.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      today: ahead === 0,
      count: openTasks.filter((row) => String(row.due_date ?? "").slice(0, 10) === stamp)
        .length,
    });
  }

  const closedThisMonth = requests.filter((row) => {
    if (!CLOSED.has(String(row.status).toLowerCase())) return false;
    const closed = row.closed_at ? new Date(row.closed_at as string) : null;
    return closed !== null && closed >= monthStart;
  });

  const turnarounds = closedThisMonth
    .map((row) => {
      if (!row.closed_at || !row.created_at) return null;
      const days =
        (new Date(row.closed_at as string).getTime() -
          new Date(row.created_at as string).getTime()) /
        86_400_000;
      return days >= 0 ? days : null;
    })
    .filter((value): value is number => value !== null);

  /*
   * How long a Request took, averaged over the ones closed this month.
   *
   * With none closed there is nothing to average, and the line used to say
   * "Not enough yet" — which reads as a thing the product has not finished
   * building rather than as an answer. It says which month and why instead.
   *
   * The average is over this month on purpose, and the line above it says so,
   * because a figure drawn from the whole history of the firm answers a
   * different question from the one the widget is asking.
   */
  const insights = {
    completedThisMonth: closedThisMonth.length,
    avgTurnaround:
      turnarounds.length === 0
        ? "Nothing closed this month"
        : `${(turnarounds.reduce((sum, value) => sum + value, 0) / turnarounds.length).toFixed(1)} days`,
    activeRequests: openRequests.length,
  };

  const requestTitles = new Map(requests.map((row) => [row.id as string, row.title as string]));

  const { data: timeline } = await supabase
    .from("whitbyos_timeline_events")
    .select("id, event_type, description, created_at, request_id")
    .in("request_id", requests.length > 0 ? requests.map((row) => row.id as string) : ["none"])
    .order("created_at", { ascending: false })
    .limit(3);

  const teamActivity: FeedRow[] = (timeline ?? []).map((row) => ({
    id: row.id as string,
    initials: initialsOf(String(row.event_type ?? "Event").replace(/_/g, " ")),
    whitby: false,
    text: (row.description as string | null) || String(row.event_type ?? "").replace(/_/g, " "),
    context: requestTitles.get(row.request_id as string) ?? "No request",
    at: row.created_at as string,
    href: row.request_id ? `/whitbyos/requests/${row.request_id}` : null,
  }));

  // A provider needs outreach when the date somebody set for following up has
  // arrived, or when nobody has ever recorded contacting them.
  const providers: ProviderRow[] = (providersResult.data ?? [])
    .filter((row) => {
      const due = daysBehind(row.next_follow_up_date as string | null);
      return (due !== null && due >= 0) || !row.last_contact_date;
    })
    .slice(0, 3)
    .map((row) => {
      const contact = firstOf(
        row.contact as unknown as { full_name: string }[] | { full_name: string } | null,
      );
      const due = daysBehind(row.next_follow_up_date as string | null);
      return {
        id: row.id as string,
        name: contact?.full_name ?? "Unnamed provider",
        note:
          due !== null && due > 0
            ? `Follow-up ${due} ${due === 1 ? "day" : "days"} late`
            : due === 0
              ? "Follow up today"
              : "Never contacted",
      };
    });

  return {
    activeRequests: openRequests.length,
    overdueItems,
    tasksDueToday,
    clientWorkspaces: openClient
      ? openTasks.length
      : (clientsResult.data ?? []).filter((row) => !row.archived_at).length,
    scopedToOneClient: Boolean(openClient),
    outstanding,
    overdueTasks,
    feed,
    thisWeek,
    load,
    insights,
    teamActivity,
    providers,
  };
}

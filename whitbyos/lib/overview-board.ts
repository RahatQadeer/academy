import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { listDocuments } from "@/whitbyos/lib/documents";
import { listConsiderations } from "@/whitbyos/lib/insights";
import { photosFor } from "@/whitbyos/lib/people-photos";

/**
 * The organisation at a glance, for the screen Whitby opens on.
 *
 * Deliberately *not* scoped to the open client workspace. Every other screen
 * in the product answers to that choice; this one is where the choice is made,
 * and its whole job is the question you cannot answer from inside one
 * workspace — what across the firm is waiting, late, or has just moved.
 *
 * So the queries here take the firm and nothing else, and none of them may go
 * through the list helpers, which now read the open client and would quietly
 * narrow this screen to whichever workspace was last opened.
 *
 * Counts and three rows apiece. Three, because this is a screen somebody opens
 * when something has gone wrong and they need to know where to look, not a
 * second inbox — every card says where the rest of it lives.
 */

export type BoardRow = {
  id: string;
  title: string;
  /** The line under it: whose, or when, or what state it is in. */
  note: string;
  at: string | null;
  href: string;
  /**
   * Which client workspace it lives in.
   *
   * This screen shows every client at once, so opening a row has to open its
   * workspace on the way — otherwise somebody lands on one client's task with
   * another client's name in the rail. Null where a row has no client, which
   * leaves the current choice alone rather than widening it.
   */
  clientId: string | null;
  /** Whoever wrote it, where they have added a photograph. */
  photo?: string | null;
};

export type TaskRow = BoardRow & {
  /** How late, in days. Negative is still ahead; null has no date at all. */
  late: number | null;
  done: boolean;
};

export type EventRow = {
  id: string;
  title: string;
  /** "Mon 21 Sep", drawn down the left of the row. */
  day: string;
  /** "09:30", or null for something with no time of day. */
  time: string | null;
  at: string;
  soon: boolean;
};

/** One day of the fortnight ahead, and what falls due on it. */
export type DayRow = {
  label: string;
  full: string;
  count: number;
  today: boolean;
  late?: boolean;
};

export type OverviewBoard = {
  documents: { total: number; needsAttention: number; latest: BoardRow[] };
  forms: { total: number; awaiting: number; needsReview: number };
  updates: BoardRow[];
  messages: BoardRow[];
  tasks: {
    open: number;
    late: number;
    dueToday: number;
    dueThisWeek: number;
    dueThisMonth: number;
    rows: TaskRow[];
  };
  events: EventRow[];
  /** Screen 14's own counts, which are considerations and nothing invented. */
  insights: { open: number; risk: number; stale: number; top: BoardRow[] };
  /** Twelve months of requests, oldest first — what was taken on and what closed. */
  trend: MonthRow[];
  /** The fortnight ahead, a column a day, with everything late on the first. */
  load: DayRow[];
};

export type MonthRow = {
  /** "Apr", down the axis. */
  label: string;
  opened: number;
  closed: number;
};

const EMPTY: OverviewBoard = {
  documents: { total: 0, needsAttention: 0, latest: [] },
  forms: { total: 0, awaiting: 0, needsReview: 0 },
  updates: [],
  messages: [],
  tasks: { open: 0, late: 0, dueToday: 0, dueThisWeek: 0, dueThisMonth: 0, rows: [] },
  events: [],
  insights: { open: 0, risk: 0, stale: 0, top: [] },
  trend: [],
  load: [],
};

/**
 * The twelve months ending with this one, as keys and labels.
 *
 * A year is what a growth chart is read as. Shorter runs look like a wobble.
 */
function lastTwelveMonths() {
  const months: { key: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setDate(1);

  for (let back = 11; back >= 0; back -= 1) {
    const month = new Date(cursor);
    month.setMonth(month.getMonth() - back);
    months.push({
      key: `${month.getFullYear()}-${month.getMonth()}`,
      label: month.toLocaleDateString("en-GB", { month: "short" }),
    });
  }

  return months;
}

/** Which of those buckets a timestamp falls in, or null if it is older. */
function monthKey(value: string | null): string | null {
  if (!value) return null;
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return null;
  return `${when.getFullYear()}-${when.getMonth()}`;
}

/** A task nobody has to do anything about any more. */
const TASK_DONE = new Set(["complete", "completed", "done", "cancelled"]);

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole days between a due date and today. Negative means it is still ahead. */
function daysLate(value: string | null): number | null {
  if (!value) return null;
  const due = startOfDay(new Date(value));
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((startOfDay(new Date()).getTime() - due.getTime()) / 86_400_000);
}

/** A submission is back and nobody has ruled on it yet. */
const WAITING_ON_US = new Set(["submitted", "in_review", "needs_review"]);
/** It has gone out and the client has not answered. */
const WAITING_ON_THEM = new Set(["awaiting", "sent", "correction_requested"]);

/**
 * The one document status that is a job rather than a fact.
 *
 * `DocumentStatus` has four: current, action_needed, completed, archived.
 * Expiry and the signing round trip both resolve into `action_needed` before
 * they get here, so naming them separately would be naming states the type
 * does not have.
 */
const NEEDS_DOING = new Set<string>(["action_needed"]);

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getOverviewBoard(): Promise<OverviewBoard> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return EMPTY;

  const supabase = await createClient();

  // The forms this firm owns, so submissions can be counted without joining
  // through a table a client policy also reads.
  const { data: forms } = await supabase
    .from("whitbyos_forms")
    .select("id")
    .eq("workspace_id", workspaceId);

  const formIds = (forms ?? []).map((row) => row.id as string);

  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 14);

  const [
    documentList,
    submissions,
    updates,
    messages,
    tasks,
    events,
    considerations,
    requestHistory,
  ] = await Promise.all([
    /*
     * Through the list helper, not a query of its own.
     *
     * `documents` has no workspace and no client on it: a document belongs to
     * whatever it hangs off, through `context_type`/`context_id`, and turning
     * that into "whose is this" takes three lookups. `listDocuments` already
     * does exactly that and does not read the open client, so calling it here
     * is both correct and a fourth query this file does not have to own.
     */
    listDocuments({}),
    formIds.length
      ? supabase
          .from("whitbyos_form_submissions")
          .select("id, status")
          .in("form_id", formIds)
      : Promise.resolve({ data: [] as { status: string }[] }),
    supabase
      .from("whitbyos_updates")
      .select(
        "id, headline, published_at, request:whitbyos_requests!request_id (title, workspace_id, client_id)",
      )
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(12),
    supabase
      .from("whitbyos_messages")
      .select(
        "id, body, created_at, thread_id, client_id, sender_type, sender_id, client:whitbyos_clients!client_id (name)",
      )
      .eq("workspace_id", workspaceId)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(6),
    /*
     * The tasks, read directly.
     *
     * `listTasks` now narrows to the open client workspace, which is the one
     * thing this screen must not do — it is where that choice is made.
     */
    supabase
      .from("whitbyos_tasks")
      .select(
        "id, title, status, due_date, client_id, client:whitbyos_clients!client_id (name), request:whitbyos_requests!request_id (title)",
      )
      .eq("workspace_id", workspaceId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(80),
    supabase
      .from("whitbyos_calendar_events")
      .select("id, title, start_at, all_day")
      .eq("workspace_id", workspaceId)
      .gte("start_at", new Date().toISOString())
      .lte("start_at", weekAhead.toISOString())
      .order("start_at", { ascending: true })
      .limit(5),
    // Screen 14's own figures, so a card here can never disagree with the
    // screen it links to.
    listConsiderations({ scoped: false }),
    /*
     * Every Request this firm has ever taken, with the two dates that matter.
     * Two columns and no joins, so reading them all back is cheaper than six
     * counted queries — and the bucketing has to happen in this timezone
     * anyway, which SQL would have to be told and JavaScript already knows.
     */
    supabase
      .from("whitbyos_requests")
      .select("id, created_at, closed_at")
      .eq("workspace_id", workspaceId),
  ]);

  const months = lastTwelveMonths();
  const opened = new Map(months.map((month) => [month.key, 0]));
  const closed = new Map(months.map((month) => [month.key, 0]));

  for (const row of requestHistory.data ?? []) {
    const born = monthKey(row.created_at as string | null);
    if (born && opened.has(born)) opened.set(born, opened.get(born)! + 1);

    const ended = monthKey(row.closed_at as string | null);
    if (ended && closed.has(ended)) closed.set(ended, closed.get(ended)! + 1);
  }

  const openTasks = (tasks.data ?? []).filter(
    (row) => !TASK_DONE.has(String(row.status).toLowerCase()),
  );

  /*
   * Who wrote the last three messages, and their faces. Senders are a mix of
   * the firm's own people and clients' contacts — two tables, and two places a
   * photograph can live. `photosFor` knows both.
   */
  const recent = (messages.data ?? []).slice(0, 3);
  const senderPhotos = await photosFor(supabase, {
    userIds: recent
      .filter((row) => row.sender_type === "user")
      .map((row) => row.sender_id as string),
    contactIds: recent
      .filter((row) => row.sender_type === "contact")
      .map((row) => row.sender_id as string),
  });

  /*
   * What lands when, across every client.
   *
   * The counts say how much is open; they cannot say that four of it arrives
   * on one Thursday. Read off the tasks already in hand, so it costs nothing,
   * and the first column is everything already behind — a fortnight drawn
   * without the backlog looks clear while the backlog sits outside it.
   */
  const load: DayRow[] = [
    {
      label: "Late",
      full: "Already past its date",
      late: true,
      today: false,
      count: openTasks.filter((row) => (daysLate(row.due_date as string | null) ?? -1) > 0)
        .length,
    },
  ];

  for (let ahead = 0; ahead < 14; ahead += 1) {
    const day = startOfDay(new Date());
    day.setDate(day.getDate() + ahead);
    const stamp = day.toISOString().slice(0, 10);

    load.push({
      label: ahead === 0 ? "Today" : day.toLocaleDateString("en-GB", { weekday: "narrow" }),
      full: day.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      today: ahead === 0,
      count: openTasks.filter((row) => String(row.due_date ?? "").slice(0, 10) === stamp).length,
    });
  }

  const insights = considerations.ok
    ? considerations
    : { counts: { open: 0, risk: 0, stale: 0 }, rows: [] as { id: string }[] };

  const documents = documentList.ok ? documentList.rows : [];

  return {
    documents: {
      total: documents.length,
      // A document that has expired, is about to, or is waiting on a signature
      // is one somebody has to do something about. The rest are just filed.
      needsAttention: documents.filter((row) => NEEDS_DOING.has(row.status)).length,
      latest: documents.slice(0, 3).map((row) => ({
        id: row.id as string,
        title: row.title || "Untitled",
        note: row.linkedTo ?? "Not linked",
        at: row.updated_at,
        href: "/whitbyos/documents",
        clientId: row.clientId,
      })),
    },

    forms: {
      total: (submissions.data ?? []).length,
      awaiting: (submissions.data ?? []).filter((row) =>
        WAITING_ON_THEM.has(String(row.status)),
      ).length,
      needsReview: (submissions.data ?? []).filter((row) =>
        WAITING_ON_US.has(String(row.status)),
      ).length,
    },

    updates: (updates.data ?? [])
      // `whitbyos_updates` has no workspace of its own; it belongs to one
      // through its Request, so the filter has to happen after the read.
      .filter(
        (row) =>
          firstOf(row.request as unknown as { workspace_id?: string } | null)
            ?.workspace_id === workspaceId,
      )
      .slice(0, 3)
      .map((row) => ({
        id: row.id as string,
        title: (row.headline as string) || "Update",
        note:
          firstOf(row.request as unknown as { title: string } | null)?.title ??
          "No request",
        at: (row.published_at as string | null) ?? null,
        href: "/whitbyos/updates",
        clientId:
          firstOf(row.request as unknown as { client_id: string | null } | null)
            ?.client_id ?? null,
      })),

    messages: recent.map((row) => ({
      id: row.id as string,
      title: (row.body as string)?.trim() || "Attachment",
      note:
        firstOf(row.client as unknown as { name: string } | null)?.name ?? "No client",
      at: (row.created_at as string | null) ?? null,
      href: `/whitbyos/messages?thread=${row.thread_id as string}`,
      clientId: (row.client_id as string | null) ?? null,
      photo: senderPhotos.get(row.sender_id as string) ?? null,
    })),

    tasks: {
      open: openTasks.length,
      late: openTasks.filter((row) => (daysLate(row.due_date as string | null) ?? -1) > 0)
        .length,
      dueToday: openTasks.filter((row) => daysLate(row.due_date as string | null) === 0)
        .length,
      dueThisWeek: openTasks.filter((row) => {
        const late = daysLate(row.due_date as string | null);
        return late !== null && late <= 0 && late >= -6;
      }).length,
      dueThisMonth: openTasks.filter((row) => {
        const raw = row.due_date as string | null;
        if (!raw) return false;
        const due = new Date(raw);
        if (Number.isNaN(due.getTime())) return false;
        const now = new Date();
        return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
      }).length,
      // Late first, then what is due soonest — which is the order somebody
      // reads a list like this in anyway.
      rows: openTasks
        .map((row) => {
          const late = daysLate(row.due_date as string | null);
          return {
            id: row.id as string,
            title: (row.title as string) || "Untitled task",
            note:
              firstOf(row.client as unknown as { name: string } | null)?.name ??
              firstOf(row.request as unknown as { title: string } | null)?.title ??
              "No client",
            at: (row.due_date as string | null) ?? null,
            href: `/whitbyos/tasks/${row.id as string}`,
            clientId: (row.client_id as string | null) ?? null,
            late,
            done: false,
          };
        })
        .sort((a, b) => (b.late ?? -9999) - (a.late ?? -9999))
        .slice(0, 5),
    },

    events: (events.data ?? []).map((row) => {
      const at = row.start_at as string;
      const when = new Date(at);
      const hours = (when.getTime() - Date.now()) / 3_600_000;

      return {
        id: row.id as string,
        title: (row.title as string) || "Untitled",
        day: when.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        time: row.all_day
          ? null
          : when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        at,
        // Inside a day. What "soon" means on a screen read in a hurry.
        soon: hours <= 24,
      };
    }),

    insights: {
      open: insights.counts.open,
      risk: insights.counts.risk,
      stale: insights.counts.stale,
      top: (insights.rows as never[]).slice(0, 2).map((row: never) => {
        const item = row as unknown as {
          id: string;
          body: string;
          requestTitle: string | null;
          createdAt: string;
        };
        return {
          id: item.id,
          title: item.body,
          note: item.requestTitle ?? "No request",
          at: item.createdAt,
          href: "/whitbyos/insights",
          clientId: null,
        };
      }),
    },

    load,

    trend: months.map((month) => ({
      label: month.label,
      opened: opened.get(month.key) ?? 0,
      closed: closed.get(month.key) ?? 0,
    })),
  };
}

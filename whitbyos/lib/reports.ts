import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

/** 15.1's Report type, and the tabs 15 filters by. */
export const REPORT_TYPES = [
  { value: "client_summary", label: "Client Summary" },
  { value: "activity", label: "Activity Log" },
  { value: "financial", label: "Financial Overview" },
];

/**
 * The colour each kind wears, so a list of them can be read down.
 *
 * Three rows all called "Rohail Khan — Client Summary" are told apart by
 * their date and nothing else; a tinted kind at least says at a glance
 * which of them are summaries and which are activity logs. Scheduled is
 * not a kind — it is a report that has not happened yet — so it wears the
 * waiting colour rather than one of these.
 */
export const REPORT_TONES: Record<string, { bg: string; fg: string }> = {
  client_summary: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  activity: { bg: "var(--module-academy-bg)", fg: "var(--module-academy-fg)" },
  financial: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
};

export function typeTone(value: string | null) {
  return (
    REPORT_TONES[value ?? ""] ?? {
      bg: "var(--surface-active)",
      fg: "var(--text-secondary)",
    }
  );
}

export function typeLabel(value: string | null) {
  return REPORT_TYPES.find((row) => row.value === value)?.label ?? "Report";
}

/** One task on 15.3c, under the stream it belongs to. */
export type TaskLine = {
  title: string;
  status: string;
  dueDate: string | null;
  owner: string | null;
  /**
   * Index, within its own stream's `taskLines`, of the task this one waits on
   * — what 15.3c's "Show dependencies" joins up. Null when it waits on nothing,
   * or on a task in another stream, which no line on this chart could reach.
   */
  dependsOn: number | null;
};

export type StreamLine = {
  name: string;
  tasks: number;
  /** Percent complete. */
  complete: number;
  status: string;
  /** 15.3b's chips, which are counts and not a percentage. */
  done: number;
  running: number;
  planned: number;
  blockedTasks: number;
  blocked: boolean;
  /**
   * 15.3c lays the streams out between these. Null only where neither the
   * stream, its plan, nor any of its tasks carries a date.
   */
  startDate: string | null;
  targetDate: string | null;
  /** True when the span above came from the tasks rather than being set. */
  datesFromTasks: boolean;
  nextAction: string | null;
  owner: string | null;
  /** Which Work Plan it belongs to — several can name a stream the same thing. */
  plan: string | null;
  /** 15.3c opens a stream to show these. */
  taskLines: TaskLine[];
};

/** One week's column on 15.3's throughput chart. */
export type WeekBar = {
  label: string;
  done: number;
  running: number;
  blocked: number;
  /**
   * Due this week and not started. The reference has three series because its
   * data has none of these; two thirds of the tasks here are these, and with
   * three series they fell through every one and left the chart empty.
   */
  planned: number;
  /** Tasks complete by the end of this week — the burn-up line. */
  cumulative: number;
  /**
   * The three sparklines on 15.3's cards, for the tasks closed in this week.
   * Null where nothing closed, so the line breaks rather than dropping to zero
   * and reading as a week everything went wrong.
   */
  onTimeRate: number | null;
  cycleDays: number | null;
  /** Streams whose every task was closed by the end of this week. */
  streamsDone: number;
};

/** 15.3's four figures across the top. */
export type ReportMetrics = {
  tasksDone: number;
  tasksTotal: number;
  /** Closed inside the report's own period, which is what "this period" means. */
  closedInPeriod: number;
  /** Of the tasks that have both a due date and a completion, how many were on time. */
  onTime: number;
  onTimeOf: number;
  /** Days from a task being raised to being closed, averaged. Null if none were. */
  avgCycleDays: number | null;
  streamsDone: number;
  streamsTotal: number;
};

export type ReportContents = {
  summary?: string;
  streams?: StreamLine[];
  requests?: { completed: number; running: number; notStarted: number };
  metrics?: ReportMetrics;
  weeks?: WeekBar[];
};

export type ReportRow = {
  id: string;
  title: string;
  type: string;
  clientName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  sharedWithClient: boolean;
  scheduledFor: string | null;
  generatedAt: string | null;
  contents: ReportContents;
};

/**
 * A report's contents are stored JSON, and the shape has grown — 15.3b and
 * 15.3c needed counts, dates, an owner and the tasks themselves, none of which
 * a report generated before them holds.
 *
 * So what comes out of the column is filled in rather than trusted. An older
 * report keeps saying exactly what it said when it was written; it simply says
 * nothing about the things nobody captured, instead of crashing the screen that
 * expects them.
 */
function readContents(value: unknown): ReportContents {
  const raw = (value ?? {}) as ReportContents;

  return {
    ...raw,
    weeks: (raw.weeks ?? []).map((week) => ({
      ...week,
      onTimeRate: week.onTimeRate ?? null,
      cycleDays: week.cycleDays ?? null,
      streamsDone: week.streamsDone ?? 0,
      planned: week.planned ?? 0,
    })),
    streams: (raw.streams ?? []).map((row) => ({
      name: row.name,
      status: row.status,
      tasks: row.tasks ?? 0,
      complete: row.complete ?? 0,
      done: row.done ?? 0,
      running: row.running ?? 0,
      planned: row.planned ?? 0,
      blockedTasks: row.blockedTasks ?? 0,
      blocked: row.blocked ?? false,
      startDate: row.startDate ?? null,
      targetDate: row.targetDate ?? null,
      datesFromTasks: row.datesFromTasks ?? false,
      nextAction: row.nextAction ?? null,
      owner: row.owner ?? null,
      plan: row.plan ?? null,
      taskLines: (row.taskLines ?? []).map((task) => ({
        ...task,
        dependsOn: task.dependsOn ?? null,
      })),
    })),
  };
}

export type ReportsResult =
  | {
      ok: true;
      rows: ReportRow[];
      counts: { thisMonth: number; scheduled: number; shared: number };
    }
  | { ok: false; error: string };

/** Screen 15 — the Reports overview. */
export async function listReports(): Promise<ReportsResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return { ok: true, rows: [], counts: { thisMonth: 0, scheduled: 0, shared: 0 } };
  }

  const supabase = await createClient();

  /*
   * Only the open client's, when one is open.
   *
   * This listed every report in the firm with the client's name printed on
   * each row, inside a workspace somebody had deliberately narrowed to one
   * client — and a report is a client-facing document, so the names on those
   * rows are the ones that must not be read across. The column was already
   * being selected; nothing had ever filtered on it.
   *
   * A report with no client is the firm's own and stays: it belongs to
   * nobody, so it is nobody's to be kept from.
   */
  const openClient = await getOpenClientId();

  let query = supabase
    .from("whitbyos_reports")
    .select(
      "id, title, type, client_id, period_start, period_end, contents, shared_with_client, scheduled_for, generated_at, created_at, client:whitbyos_clients!client_id (name)",
    )
    .eq("workspace_id", workspaceId);

  if (openClient) query = query.or(`client_id.eq.${openClient},client_id.is.null`);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const rows: ReportRow[] = (data ?? []).map((row) => {
    const client = row.client as unknown as { name: string } | { name: string }[] | null;
    return {
      id: row.id as string,
      title: readTitle(row.title as string),
      type: (row.type as string) ?? "client_summary",
      clientName: (Array.isArray(client) ? client[0]?.name : client?.name) ?? null,
      periodStart: (row.period_start as string | null) ?? null,
      periodEnd: (row.period_end as string | null) ?? null,
      sharedWithClient: Boolean(row.shared_with_client),
      scheduledFor: (row.scheduled_for as string | null) ?? null,
      generatedAt: (row.generated_at as string | null) ?? null,
      contents: readContents(row.contents),
    };
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return {
    ok: true,
    rows,
    counts: {
      thisMonth: rows.filter(
        (row) => row.generatedAt && new Date(row.generatedAt) >= monthStart,
      ).length,
      scheduled: rows.filter((row) => !row.generatedAt && row.scheduledFor).length,
      shared: rows.filter((row) => row.sharedWithClient).length,
    },
  };
}

/**
 * The separator a report's name was written with, before it was a colon.
 *
 * `generateReport` builds `${clientName}: ${typeLabel(type)}`, but rows
 * written before that still read "Rohail Khan — Client Summary". Mended
 * where the row is read rather than in the table, because this function is
 * the only thing in the product that reads `whitbyos_reports` — the detail
 * screen comes through it too, and the portal does not read reports at all.
 * So there is no second surface for the old spelling to survive on, and a
 * migration would be a write to the database to change what one line
 * changes here.
 *
 * Only ` — ` with a space either side, which is the shape the old template
 * left. A dash inside a client's own name is not written that way.
 */
function readTitle(title: string) {
  return title.replace(/ — /g, ": ");
}

/** Screen 15.3 — one report, exactly as it was generated. */
export async function getReport(reportId: string): Promise<ReportRow | null> {
  const result = await listReports();
  if (!result.ok) return null;
  return result.rows.find((row) => row.id === reportId) ?? null;
}

/**
 * 15.3's "Task throughput by week", and the burn-up drawn over it.
 *
 * A task lands in the week it was closed, or — if it is still open — the week
 * it is due, which is where the work is expected to fall. One with neither
 * date is in no week and is left out of the columns rather than dropped into
 * the first one.
 */
function weeklyBars(
  tasks: {
    status: string;
    dueDate: string | null;
    createdAt: string | null;
    completedAt: string | null;
  }[],
  /** Each stream's last completion, or null while any of its tasks is open. */
  streamDone: (string | null)[],
  from: string | null,
  to: string | null,
): WeekBar[] {
  if (!from || !to) return [];

  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  // Monday on or before the start, so the columns are the weeks people keep.
  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() - ((start.getDay() + 6) % 7),
  );

  const bars: WeekBar[] = [];
  // Tasks closed before the period opened are not in any of its columns, but
  // they are done — starting the line at zero made the burn-up say nothing had
  // been closed on a report whose own first card said eleven had.
  let running = tasks.filter(
    (task) => task.completedAt && task.completedAt.slice(0, 10) < from,
  ).length;

  while (cursor <= end && bars.length < 60) {
    const openedOn = new Date(cursor);
    const closesOn = new Date(cursor);
    closesOn.setDate(closesOn.getDate() + 7);

    const week = tasks.filter((task) => {
      const day = task.completedAt ?? task.dueDate;
      if (!day) return false;
      const at = new Date(day.slice(0, 10)).getTime();
      return at >= openedOn.getTime() && at < closesOn.getTime();
    });

    const closed = week.filter((task) => task.completedAt);
    running += closed.length;

    // Counted from everything closed up to the end of this week, not only in
    // it. A week where two tasks closed and one was late is not a 50% on-time
    // rate for the project, and the card above the line reads every task ever
    // closed — so the line ends exactly on the number it is drawn under.
    const soFar = tasks.filter(
      (task) => task.completedAt && new Date(task.completedAt.slice(0, 10)) < closesOn,
    );
    const timed = soFar.filter((task) => task.dueDate);
    const cycles = soFar
      .filter((task) => task.createdAt)
      .map(
        (task) =>
          (new Date(task.completedAt!).getTime() - new Date(task.createdAt!).getTime()) /
          86_400_000,
      )
      .filter((days) => days >= 0);

    const done = closed.length;

    bars.push({
      onTimeRate:
        timed.length === 0
          ? null
          : Math.round(
              (timed.filter(
                (task) => task.completedAt!.slice(0, 10) <= task.dueDate!.slice(0, 10),
              ).length /
                timed.length) *
                100,
            ),
      cycleDays:
        cycles.length === 0
          ? null
          : Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) / 10,
      streamsDone: streamDone.filter(
        (day) => day !== null && new Date(day.slice(0, 10)).getTime() < closesOn.getTime(),
      ).length,
      label: openedOn.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      done,
      running: week.filter(
        (task) =>
          !task.completedAt &&
          !["not_started", "planned", "blocked", "waiting", ""].includes(task.status),
      ).length,
      blocked: week.filter(
        (task) => !task.completedAt && ["blocked", "waiting"].includes(task.status),
      ).length,
      planned: week.filter(
        (task) => !task.completedAt && ["not_started", "planned", ""].includes(task.status),
      ).length,
      cumulative: running,
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return bars;
}

/**
 * What a Client Summary says, worked out at the moment it is generated.
 *
 * Read once and stored, never re-derived: a report is a statement about a
 * period that someone may already have sent to a client, and recomputing it
 * later from live rows would rewrite what they read.
 */
export async function buildContents(
  clientId: string | null,
  workspaceId: string,
  /** The period the report covers — the weekly columns are cut against it. */
  from: string | null,
  to: string | null,
): Promise<ReportContents> {
  const supabase = await createClient();

  let requestQuery = supabase
    .from("whitbyos_requests")
    .select("id, status")
    .eq("workspace_id", workspaceId);

  if (clientId) requestQuery = requestQuery.eq("client_id", clientId);

  const { data: requests } = await requestQuery;
  const requestIds = (requests ?? []).map((row) => row.id as string);

  const counts = { completed: 0, running: 0, notStarted: 0 };
  for (const row of requests ?? []) {
    const status = (row.status as string) ?? "";
    if (["completed", "closed", "complete"].includes(status)) counts.completed += 1;
    else if (status === "not_started") counts.notStarted += 1;
    else counts.running += 1;
  }

  if (requestIds.length === 0) return { streams: [], requests: counts };

  // A stream has a target date but no start of its own, so its bar begins where
  // its plan does — which is the only start either of them records.
  const { data: plans } = await supabase
    .from("whitbyos_workplans")
    .select("id, name, start_date")
    .in("request_id", requestIds);

  const planStart = new Map(
    (plans ?? []).map((row) => [row.id as string, (row.start_date as string | null) ?? null]),
  );
  const planName = new Map(
    (plans ?? []).map((row) => [row.id as string, (row.name as string | null) ?? null]),
  );

  const planIds = (plans ?? []).map((row) => row.id as string);
  if (planIds.length === 0) return { streams: [], requests: counts };

  // `position` is not a column on this table and never was — the whole query
  // failed, PostgREST returned nothing, and every report generated so far has
  // been stored with no streams at all. The Charts view has been empty since it
  // was written, silently, because nothing read the error.
  //
  // The extra columns are what 15.3b and 15.3c draw: the Kanban groups by
  // status and shows what is blocked, and the Timeline lays streams out against
  // their target dates. A report is stored rather than re-derived, so what
  // those screens need has to be captured here or it is not available later.
  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select(
      "id, name, status, sort_order, target_date, blocked, next_action, owner_user_id, workplan_id",
    )
    .in("workplan_id", planIds)
    .order("sort_order");

  const streamIds = (streams ?? []).map((row) => row.id as string);

  type Tally = {
    total: number;
    done: number;
    running: number;
    planned: number;
    blocked: number;
    /** Earliest and latest due date among this stream's tasks, or null. */
    firstDue: string | null;
    lastDue: string | null;
    lines: TaskLine[];
    /** Held only while dependencies are turned from ids into positions. */
    ids: string[];
    waitsOn: (string | null)[];
    /** Completion dates, for working out when a whole stream was finished. */
    closedOn: (string | null)[];
  };
  const tasks = new Map<string, Tally>();
  const people = new Map<string, string>();
  const every: {
    status: string;
    dueDate: string | null;
    createdAt: string | null;
    completedAt: string | null;
  }[] = [];

  if (streamIds.length > 0) {
    const { data: taskRows } = await supabase
      .from("whitbyos_tasks")
      .select("id, workstream_id, title, status, due_date, owner_user_id, dependency_task_id, created_at, completed_at")
      .in("workstream_id", streamIds)
      .order("due_date", { nullsFirst: false });

    for (const task of taskRows ?? []) {
      every.push({
        status: (task.status as string) ?? "",
        dueDate: (task.due_date as string | null) ?? null,
        createdAt: (task.created_at as string | null) ?? null,
        completedAt: (task.completed_at as string | null) ?? null,
      });
    }

    const ownerIds = [
      ...new Set(
        [
          ...(taskRows ?? []).map((row) => row.owner_user_id as string | null),
          ...(streams ?? []).map((row) => row.owner_user_id as string | null),
        ].filter(Boolean) as string[],
      ),
    ];

    if (ownerIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, preferred_name, email")
        .in("id", ownerIds);

      for (const user of users ?? []) {
        people.set(
          user.id as string,
          (user.preferred_name as string) ||
            (user.full_name as string) ||
            (user.email as string) ||
            "Someone",
        );
      }
    }

    for (const task of taskRows ?? []) {
      const key = task.workstream_id as string;
      const entry =
        tasks.get(key) ??
        {
          total: 0,
          done: 0,
          running: 0,
          planned: 0,
          blocked: 0,
          firstDue: null as string | null,
          lastDue: null as string | null,
          lines: [] as TaskLine[],
          ids: [] as string[],
          waitsOn: [] as (string | null)[],
          closedOn: [] as (string | null)[],
        };
      const status = (task.status as string) ?? "";

      entry.total += 1;
      if (["complete", "completed", "done"].includes(status)) entry.done += 1;
      else if (["blocked", "waiting"].includes(status)) entry.blocked += 1;
      else if (["not_started", "planned", ""].includes(status)) entry.planned += 1;
      else entry.running += 1;

      const due = (task.due_date as string | null) ?? null;
      if (due) {
        const day = due.slice(0, 10);
        if (entry.firstDue === null || day < entry.firstDue) entry.firstDue = day;
        if (entry.lastDue === null || day > entry.lastDue) entry.lastDue = day;
      }

      entry.lines.push({
        title: (task.title as string) ?? "Task",
        status,
        dueDate: (task.due_date as string | null) ?? null,
        owner: people.get(task.owner_user_id as string) ?? null,
        // Resolved below, once every line has a position to point at.
        dependsOn: null,
      });

      entry.ids.push(task.id as string);
      entry.waitsOn.push((task.dependency_task_id as string | null) ?? null);
      entry.closedOn.push((task.completed_at as string | null) ?? null);

      tasks.set(key, entry);
    }

    // A dependency is stored as another task's id, but a snapshot has no ids in
    // it — only the list. Turned into a position in that same stream's list, so
    // the chart can join two rows it is already drawing. A task waiting on one
    // in another stream keeps null: there is no row here to point at.
    for (const entry of tasks.values()) {
      entry.waitsOn.forEach((waitsOn, index) => {
        if (!waitsOn) return;
        const at = entry.ids.indexOf(waitsOn);
        if (at >= 0 && at !== index) entry.lines[index]!.dependsOn = at;
      });
    }
  }

  const closed = every.filter((task) => task.completedAt);
  const timed = every.filter((task) => task.completedAt && task.dueDate);
  const cycles = every
    .filter((task) => task.completedAt && task.createdAt)
    .map(
      (task) =>
        (new Date(task.completedAt!).getTime() - new Date(task.createdAt!).getTime()) / 86_400_000,
    )
    .filter((days) => days >= 0);

  const inPeriod = closed.filter((task) => {
    const day = task.completedAt!.slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  });

  const streamRows = streams ?? [];
  // A stream is finished on the day its last task was, which is the only date
  // either of them records for it.
  const streamCompletions = streamRows.map((row) => {
    const entry = tasks.get(row.id as string);
    if (!entry || entry.total === 0 || entry.done !== entry.total) return null;
    const days = entry.closedOn.filter(Boolean) as string[];
    return days.length === 0 ? null : days.sort().at(-1)!;
  });
  const streamsDone = streamCompletions.filter(Boolean).length;

  return {
    requests: counts,
    metrics: {
      tasksDone: closed.length,
      tasksTotal: every.length,
      closedInPeriod: inPeriod.length,
      onTime: timed.filter(
        (task) => task.completedAt!.slice(0, 10) <= task.dueDate!.slice(0, 10),
      ).length,
      onTimeOf: timed.length,
      avgCycleDays:
        cycles.length === 0
          ? null
          : Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) / 10,
      streamsDone,
      streamsTotal: streamRows.length,
    },
    weeks: weeklyBars(every, streamCompletions, from, to),
    streams: (streams ?? []).map((row) => {
      const entry =
        tasks.get(row.id as string) ??
        {
          total: 0,
          done: 0,
          running: 0,
          planned: 0,
          blocked: 0,
          firstDue: null as string | null,
          lastDue: null as string | null,
          lines: [] as TaskLine[],
          ids: [] as string[],
          waitsOn: [] as (string | null)[],
          closedOn: [] as (string | null)[],
        };

      // A stream carries a target date and its plan carries a start, but both
      // are often unset — and the Timeline then had nothing to draw, on every
      // lane, for every report. Its tasks are dated even when it is not, and
      // where the work falls is a fact those due dates already state. Used
      // only to fill a gap: a date set on the stream always wins, and the two
      // are told apart so the screen can say which it is showing.
      const setStart = planStart.get(row.workplan_id as string) ?? null;
      const setTarget = (row.target_date as string | null) ?? null;
      const startDate = setStart ?? entry.firstDue;
      const targetDate = setTarget ?? entry.lastDue;

      return {
        name: row.name as string,
        tasks: entry.total,
        done: entry.done,
        running: entry.running,
        planned: entry.planned,
        blockedTasks: entry.blocked,
        complete: entry.total === 0 ? 0 : Math.round((entry.done / entry.total) * 100),
        status: (row.status as string) ?? "not_started",
        blocked: Boolean(row.blocked),
        startDate,
        targetDate,
        datesFromTasks: (startDate !== null || targetDate !== null) && setStart === null && setTarget === null,
        nextAction: (row.next_action as string | null) ?? null,
        owner: people.get(row.owner_user_id as string) ?? null,
        plan: planName.get(row.workplan_id as string) ?? null,
        taskLines: entry.lines,
      };
    }),
  };
}

import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { cn } from "@/base/lib/cn";
import { getSessionProfile } from "@/base/identity/session";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import { DataTable, type Column } from "@/whitbyos/components/DataTable";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import {
  TASK_SCOPES,
  isTaskScope,
  matchesScope,
  scopeCounts,
  type TaskScope,
} from "@/whitbyos/lib/task-scopes";
import { NewTaskDialog } from "@/whitbyos/tasks/components/NewTaskDialog";
import { ScopeFilter } from "@/whitbyos/tasks/components/ScopeFilter";
import { TaskDetailDialog } from "@/whitbyos/tasks/components/TaskDetailDialog";
import { toggleTaskDone } from "@/whitbyos/tasks/actions";
import { getTask, listRequestOptions,
  listWorkstreamOptions, listTasks, type TaskRow } from "@/whitbyos/lib/tasks";
import { listAssignees } from "@/whitbyos/lib/work-plans";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { TaskCalendar, type CalendarTask } from "@/whitbyos/tasks/components/TaskCalendar";
import { DayTasksDialog } from "@/whitbyos/tasks/components/DayTasksDialog";
import { workspaceTimezone } from "@/whitbyos/lib/calendar";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { matchesSearch } from "@/whitbyos/lib/search";
import {
  dueLabel,
  isDone,
  priorityLabel,
  priorityTone,
  taskStatusLabel,
  taskStatusTone,
} from "@/whitbyos/lib/task-vocab";

const LIST = "/whitbyos/tasks";

function tasksHref(opts: {
  calendar?: boolean;
  month?: string;
  day?: string;
  scope?: TaskScope;
  q?: string;
  show?: number;
}) {
  const query = new URLSearchParams();
  if (opts.calendar) query.set("view", "calendar");
  const month = opts.month?.slice(0, 7);
  if (month) query.set("month", month);
  if (opts.day) query.set("day", opts.day);
  if (opts.scope && opts.scope !== "mine") query.set("scope", opts.scope);
  const q = opts.q?.trim();
  if (q) query.set("q", q);
  if (opts.show) query.set("show", String(opts.show));
  const search = query.toString();
  return search ? `${LIST}?${search}` : LIST;
}

function matchesTask(task: TaskRow, query: string) {
  return matchesSearch(query, [
    task.title,
    task.next_action,
    task.request_title,
    task.clientName,
    task.status,
    taskStatusLabel(task.status),
    task.priority,
    priorityLabel(task.priority),
    ...task.assignees.map((who) => who.name),
  ]);
}

/** How many rows a scope draws before asking whether you want the rest. */
const FIRST = 7;
const NEXT = 25;

/*
 * Five columns, not eight.
 *
 * Linked Request and Next Action were two of the eight, and on a real screen
 * one read "ABC" thirteen times and the other "None recorded" thirteen times:
 * two full columns of width spent on a word nobody needed and a word meaning
 * nothing. Both are worth reading when they say something, so they say it
 * under the task's own title, where they cost no width at all and are gone on
 * the rows that have nothing to add.
 */
const COLUMNS: Column[] = [
  { label: "", width: "22px" },
  { label: "Task", width: "2.6fr" },
  { label: "Assignees", width: "0.8fr" },
  { label: "Priority", width: "0.7fr" },
  { label: "Status", width: "0.9fr" },
  { label: "Due", width: "0.8fr" },
];

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * A task as the month draws it: where it goes, how it reads, and where it
 * opens. Overdue is judged against the workspace's today rather than the
 * browser's, so a firm in Lagos and a laptop in London agree.
 */
/** "2026-09" a month either side, kept as the calendar's own YYYY-MM. */
function shiftMonth(month: string, by: number) {
  const at = new Date(`${month}T00:00:00Z`);
  at.setUTCMonth(at.getUTCMonth() + by);
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "September 2026", written out rather than numbered. */
function monthLabel(month: string) {
  return new Date(`${month}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function asCalendarTask(task: TaskRow, todayIso: string, timezone: string): CalendarTask {
  const done = isDone(task.status);

  /*
   * The day it is due, in the workspace's own day.
   *
   * `due_date` is a timestamptz, so it arrives as "2026-09-18T00:00:00+00:00"
   * and never matched a calendar cell's "2026-09-18" — eighty-four tasks due
   * this month drew nothing at all. Cut to a date, in the timezone the month
   * is drawn in, so a deadline stored at midnight UTC does not land on the
   * previous evening in Lagos.
   */
  const dueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString("en-CA", { timeZone: timezone })
    : null;

  /** Today, tomorrow, or the day after: near enough to be worth a colour. */
  const soonest = new Date(`${todayIso}T00:00:00Z`);
  soonest.setUTCDate(soonest.getUTCDate() + 2);
  const soonIso = soonest.toISOString().slice(0, 10);

  return {
    id: task.id,
    title: task.title,
    dueDate,
    status: task.status,
    priority: task.priority,
    clientName: task.clientName,
    done,
    overdue: Boolean(!done && dueDate && dueDate < todayIso),
    soon: Boolean(!done && dueDate && dueDate >= todayIso && dueDate <= soonIso),
    href: task.planId
      ? `/whitbyos/work-plans/${task.planId}/tasks/${task.id}`
      : `${LIST}?task=${task.id}`,
  };
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Screens 6.9, 7 and 7.2 — My Tasks across every Request.
 *
 * SRS §6.7.1 asks for a Task to surface in a global view as well as inside the
 * Workstream that owns it, which is what makes this a screen rather than a tab.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const result = await listTasks();

  const asked = one(searchParams?.scope);
  const scope: TaskScope = isTaskScope(asked) ? asked : "mine";
  const query = (one(searchParams?.q) ?? "").trim();

  /*
   * The list, or the month.
   *
   * A due date was a column, which answers "when is this due" and never "what
   * does next Tuesday look like". Held in the URL like every other view in the
   * product, so Back works and a month can be sent to somebody.
   */
  const calendar = one(searchParams?.view) === "calendar";
  const monthParam = one(searchParams?.month);
  const dayParam = one(searchParams?.day);

  const newTask = one(searchParams?.new);
  const taskParam = one(searchParams?.task);
  const doneParam = one(searchParams?.done);
  const reassign = one(searchParams?.reassign);
  const error = one(searchParams?.error);

  // Needed on every render now, not only for a dialog: "My Tasks" and "Team
  // Tasks" are the same list asked whose name is on it.
  const profile = await getSessionProfile();
  const meId = profile?.user.id ?? null;

  const rows = result.ok ? result.rows : [];
  const found = rows.filter((task) => matchesTask(task, query));
  const counts = scopeCounts(found, meId);
  const matching = found.filter((task) => matchesScope(task, scope, meId));
  const active = TASK_SCOPES.find((item) => item.value === scope)!;

  /*
   * Seven rows, then more on request.
   *
   * "My Tasks" is 212 of them on a real workspace, and a page that renders all
   * 212 is a page nobody reads past the first screen of anyway. The count
   * lives in the URL so the browser's own Back works and a link to a longer
   * list stays a longer list.
   */
  const asking = Number(one(searchParams?.show) ?? 0);
  const limit = Number.isFinite(asking) && asking > FIRST ? Math.floor(asking) : FIRST;
  const shown = matching.slice(0, limit);
  const more = matching.length - shown.length;

  const assignees = newTask || taskParam ? await listAssignees() : [];
  const requests = newTask ? await listRequestOptions() : [];
  const streams = newTask ? await listWorkstreamOptions() : [];
  const clientList = newTask ? await listClientOptions() : [];
  /* Whose workspace is open, so New Task starts on it rather than asking for
     the client somebody is already inside. */
  const openClient = newTask ? await getOpenClientId() : null;
  /* Whose clock the month is drawn on: the workspace's, like the Calendar. */
  const timezone = calendar
    ? await workspaceTimezone(await getCurrentWorkspaceId())
    : "UTC";

  /* The month on screen, and today in the workspace's own day. */
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "")
    ? `${monthParam}-01`
    : `${todayIso.slice(0, 7)}-01`;

  const openTask = taskParam ? await getTask(taskParam) : null;
  const completed = doneParam ? await getTask(doneParam) : null;
  const calendarHome = tasksHref({
    calendar: true,
    month,
    scope,
    q: query,
  });
  const dayOk = /^\d{4}-\d{2}-\d{2}$/.test(dayParam ?? "");
  const dayTasks =
    calendar && dayOk
      ? matching.filter((task) => {
          const due = task.due_date
            ? new Date(task.due_date).toLocaleDateString("en-CA", { timeZone: timezone })
            : null;
          return due === dayParam;
        })
      : [];

  return (
    <div className="min-h-full">
      <div className="min-w-0 px-12 pb-9 pt-9">
      {result.ok && rows.length > 0 ? (
        <PageHeader
          title={active.label}
          size={22}
          // The tabs above say which view this is; the line under the title
          // says how much of it is on the screen, which they cannot.
          subtitle={
            matching.length === 0
              ? undefined
              : calendar
                ? matching.length === 1
                  ? "1 task"
                  : `${matching.length} tasks`
                : more > 0
                  ? `Showing ${shown.length} of ${matching.length}`
                  : matching.length === 1
                    ? "1 task"
                    : `${matching.length} tasks`
          }
          action={
            <span className="flex items-center gap-2.5">
              {/* The list or the month, the way every other screen switches
                  views: two links, and the URL holds the answer. */}
              <span
                className="flex rounded-control border p-0.5"
                style={{ borderColor: "var(--chrome-line)" }}
              >
                {[
                  { label: "List", on: !calendar, href: tasksHref({ scope, q: query }) },
                  {
                    label: "Calendar",
                    on: calendar,
                    href: tasksHref({ calendar: true, scope, q: query }),
                  },
                ].map((option) => (
                  <Link
                    key={option.label}
                    href={option.href}
                    className="rounded-[5px] px-2.5 py-[5px] text-[12.5px] no-underline"
                    style={
                      option.on
                        ? { background: "var(--accent-tint)", color: "var(--accent)", fontWeight: 600 }
                        : { color: "var(--text-secondary)" }
                    }
                  >
                    {option.label}
                  </Link>
                ))}
              </span>

              {calendar ? (
                <span className="flex items-center gap-1.5">
                  {[
                    { label: "‹", to: shiftMonth(month, -1), title: "Previous month" },
                    { label: "Today", to: `${todayIso.slice(0, 7)}`, title: "This month" },
                    { label: "›", to: shiftMonth(month, 1), title: "Next month" },
                  ].map((step) => (
                    <Link
                      key={step.label}
                      href={tasksHref({
                        calendar: true,
                        month: step.to,
                        scope,
                        q: query,
                      })}
                      title={step.title}
                      className="rounded-control border px-2.5 py-[5px] text-[12.5px] no-underline"
                      style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
                    >
                      {step.label}
                    </Link>
                  ))}
                  <span className="ml-1 text-[13px] font-semibold">{monthLabel(month)}</span>
                </span>
              ) : null}

              <ScopeFilter
                scope={scope}
                counts={counts}
                hrefs={Object.fromEntries(
                  TASK_SCOPES.map((item) => [
                    item.value,
                    tasksHref({ calendar, month, scope: item.value, q: query }),
                  ]),
                )}
              />
              <Button unsized href={`${LIST}?new=1`} variant="primary" className="px-4 py-[9px] text-[13.5px]">
                + New Task
              </Button>
            </span>
          }
        />
      ) : null}

      {result.ok && rows.length > 0 ? (
        <FilterBar
          action={LIST}
          searchPlaceholder="Search tasks…"
          searchValue={query}
          hidden={{
            view: calendar ? "calendar" : undefined,
            month: calendar ? month.slice(0, 7) : undefined,
            scope: scope !== "mine" ? scope : undefined,
          }}
        />
      ) : null}

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Tasks. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              {/* There is no support screen anywhere in the product, so this
                  is an address rather than a link to somewhere that is not. */}
              <Button unsized
                href="mailto:support@privateattache.com?subject=Tasks%20failed%20to%20load"
                variant="secondary"
                className="px-4 py-[9px] text-[14px]"
              >
                Contact support
              </Button>
              <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px] text-[14px]">
                Try again
              </Button>
            </>
          }
        />
      ) : rows.length === 0 ? (
        <StateMessage
          glyph="☑"
          title="No tasks yet"
          description="Tasks break a request or work plan down into concrete next actions. Add one manually or let Whitby generate them from a plan."
          action={
            <Button unsized href={`${LIST}?new=1`} variant="primary" className="px-5 py-2.5 text-[13.5px]">
              + New Task
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          {query ? `Nothing matches “${query}”.` : emptyFor(scope)}
        </p>
      ) : calendar ? (
        <TaskCalendar
          month={month}
          timezone={timezone}
          selectedDay={dayOk ? dayParam : null}
          calendarHref={calendarHome}
          tasks={matching
            .filter((task) => task.due_date)
            .map((task) => asCalendarTask(task, todayIso, timezone))}
        />
      ) : (
        <>
          <DataTable columns={COLUMNS} rowPadding={13}>
            {shown.map((task) => (
              <TaskLine key={task.id} task={task} />
            ))}
          </DataTable>

          {/* A link, not a button: the count is in the URL, so Back works and
              a longer list can be sent to somebody as one. */}
          {more > 0 ? (
            <div className="mt-3 flex items-center justify-center">
              <Link
                href={tasksHref({
                  calendar: false,
                  scope,
                  q: query,
                  show: shown.length + NEXT,
                })}
                scroll={false}
                className="rounded-control border px-4 py-[7px] text-[13px] font-medium no-underline"
                style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
              >
                Show {Math.min(more, NEXT)} more
                <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
                  {` · ${more} left`}
                </span>
              </Link>
            </div>
          ) : null}
        </>
      )}

      {newTask ? (
        <NewTaskDialog
          requests={requests}
          streams={streams}
          /* The workspace that is open, and nobody else's: with one client
             open, a list of every client is four ways to file this in the
             wrong place. */
          clients={clientList.filter((c) => !openClient || c.id === openClient)}
          assignees={assignees}
          currentUserId={profile?.user.id}
          openClientId={openClient}
          closeHref={tasksHref({ calendar, month, scope, q: query })}
          error={error}
        />
      ) : null}

      {calendar && dayOk ? (
        <DayTasksDialog date={dayParam!} tasks={dayTasks} closeHref={calendarHome} />
      ) : null}

      {openTask ? (
        <TaskDetailDialog
          task={openTask}
          assignees={assignees}
          reassigning={reassign === "1"}
          closeHref={tasksHref({ calendar, month, day: calendar && dayOk ? dayParam : undefined, scope, q: query })}
        />
      ) : null}

      {completed && isDone(completed.status) ? (
        <Toast
          title="Task completed"
          detail={`"${completed.title}" marked done${
            completed.request_title ? ` on ${completed.request_title}` : ""
          }.`}
          closeHref={tasksHref({ calendar, month, scope, q: query })}
        />
      ) : null}
      </div>
    </div>
  );
}

/**
 * One row. The checkbox marks the task done on its own, while the rest of the
 * row opens 7.1 — so the row is not a link, since a form cannot sit inside one.
 */
function TaskLine({ task }: { task: TaskRow }) {
  const done = isDone(task.status);
  const priority = priorityLabel(task.priority);
  const due = dueLabel(task.due_date, task.status);

  return (
    <div
      className={cn(
        "grid items-start border-b border-line px-4 py-[13px] text-[13.5px] transition-colors last:border-b-0 hover:bg-surface-soft",
        done && "opacity-[.55]",
      )}
      style={{ gridTemplateColumns: "var(--cols)" }}
    >
      <form action={toggleTaskDone} className="flex items-center">
        <input type="hidden" name="task_id" value={task.id} />
        <SubmitPlain
         
          aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          title={done ? "Mark not done" : "Mark done"}
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] text-[11px] transition-colors",
            done
              ? "border-[var(--success-solid)] bg-[var(--success-solid)] text-white"
              : "border-[var(--border-strong)]",
          )}
        >
          {done ? "✓" : ""}
        </SubmitPlain>
      </form>

      {/*
       * A drafted task opens its own page, not a dialog.
       *
       * Everything drafting writes onto a task — its steps, what it needs
       * before it can start, what it produces, who to ring — lives on the
       * plan's task page, and this screen was opening eight fields over rows
       * that had four times that on them. A task with no plan behind it has
       * none of that, so it keeps the dialog, which is all there is to show.
       */}
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link
          // Every task has one address now, whether a plan drafted it or
          // somebody typed it on this screen. The page itself links on to the
          // plan where there is one.
          href={`${LIST}/${task.id}`}
          className="min-w-0 truncate no-underline"
          style={{ color: "var(--ink)", textDecoration: done ? "line-through" : undefined }}
        >
          {task.title}
        </Link>

        {/* Only where there is something to say. A line of "None recorded"
            under every row is a line nobody reads twice. */}
        {task.request_title || task.next_action ? (
          <span
            className="min-w-0 truncate text-[12px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {[task.request_title, task.next_action].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>

      {/* 7 stacks the avatars, overlapping, and that is what says at a glance
          that two people are on one task. */}
      <span className="flex items-center">
        {task.assignees.length === 0 ? (
          <span className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
            Unassigned
          </span>
        ) : (
          task.assignees.map((who, index) => (
            <span key={who.userId} style={{ marginLeft: index === 0 ? 0 : -6 }}>
              <OwnerAvatar
                userId={who.userId}
                initials={who.initials}
                name={who.name}
                hasPhoto={who.hasPhoto}
                size={20}
                ring={index > 0}
              />
            </span>
          ))
        )}
      </span>

      <span>{priority ? <Pill tone={priorityTone(task.priority)}>{priority}</Pill> : null}</span>

      <span>
        <Pill tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Pill>
      </span>

      <span
        className={due?.tone === "muted" ? "" : "font-medium"}
        style={{
          color:
            due?.tone === "danger"
              ? "var(--danger-fg)"
              : due?.tone === "ink"
                ? "var(--ink)"
                : "var(--text-secondary)",
        }}
      >
        {due?.text ?? "No date"}
      </span>
    </div>
  );
}

/** What an empty view says, in the words of the question it was asked. */
function emptyFor(scope: TaskScope) {
  switch (scope) {
    case "mine":
      return "Nothing is assigned to you right now.";
    case "team":
      return "Nobody else on the team is holding a task right now.";
    case "general":
      return "Every open task has somebody's name on it.";
    case "today":
      return "Nothing is due today.";
    case "upcoming":
      return "Nothing is dated later than today.";
    case "waiting":
      return "Nothing is waiting on anybody.";
    case "overdue":
      return "Nothing is overdue.";
    case "completed":
      return "Nothing has been completed yet.";
  }
}

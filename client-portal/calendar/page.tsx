import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { rangeLabel } from "@/whitbyos/lib/calendar-format";
import { addDaysIn, isoDateIn } from "@/whitbyos/lib/zoned";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import {
  countCalendar,
  filterCalendar,
  listCalendar,
  listPersonalCalendar,
  type CalendarTab,
} from "@/client-portal/lib/data/calendar";
import { listIntegrations } from "@/client-portal/lib/data/integrations";
import { listTasks } from "@/client-portal/lib/data/tasks";
import {
  CALENDAR_VIEWS,
  inWindow,
  stepFrom,
  viewWindow,
  type CalendarView,
} from "@/client-portal/lib/calendar-view";
import { param, tabParam, type ScreenProps } from "@/client-portal/lib/routing";
import { PageBody, PageIntro } from "@/client-portal/components/PageHeader";
import { DataNotice } from "@/client-portal/components/DataNotice";
import type { PortalIntegration } from "@/client-portal/types";
import { Agenda } from "./components/Agenda";
import {
  AGENDA_SUBTITLE,
  AGENDA_TABS,
  DEFAULT_AGENDA_TAB,
  agendaHref,
} from "./components/agenda-data";
import { DayGrid } from "./components/DayGrid";
import { EventDetail } from "./components/EventDetail";
import { DayTasks, type DueTask } from "./components/DayTasks";
import { MonthGrid } from "./components/MonthGrid";
import { WeekAgenda } from "./components/WeekAgenda";

const BASE = "/client-portal/calendar";

/**
 * Day, Week and Month are Whitby's three views, drawn as Whitby draws them;
 * List is the portal's own agenda with its tabs, kept beside them because
 * "what is coming up, soonest first" is the question a client most often
 * brings, and a calendar answers it one window at a time.
 */
type View = CalendarView | "list";
const VIEWS: View[] = [...CALENDAR_VIEWS, "list"];
const VIEW_LABEL: Record<View, string> = { day: "Day", week: "Week", month: "Month", list: "List" };

const CALENDAR_PROVIDERS = [
  { key: "google_calendar", label: "Google Calendar" },
  { key: "outlook_calendar", label: "Outlook Calendar" },
] as const;

/**
 * The month opens.
 *
 * The week did, and on a real account it was a box of nothing: a client's
 * calendar is a handful of appointments a month, so seven days of it is most
 * often "Nothing on this week" in a 180px frame with the rest of the window
 * blank beneath. The month is the view whose empty state is still a shape —
 * the weeks are drawn whether or not anything is booked in them, it answers
 * "when is the next thing" rather than "is there a thing this week", and it is
 * the only view with room in a day for the task dates as well.
 */
function readView(searchParams: ScreenProps["searchParams"]): View {
  const requested = param(searchParams, "view");
  if (VIEWS.includes(requested as View)) return requested as View;
  // Links from before the views existed carry only a tab, and mean the list.
  return param(searchParams, "tab") ? "list" : "month";
}

export default async function CalendarScreen({ searchParams }: ScreenProps) {
  const view = readView(searchParams);

  /*
   * Task due dates, on or off.
   *
   * Off by default, and for Whitby's reason: this screen is what is booked,
   * and a month that opened with every deadline in it would bury the two
   * meetings the client actually came to look at. On, the two sit in the same
   * day, which is the question a calendar is really asked.
   *
   * `listTasks` is gated on the Requests area rather than Calendar, so a
   * person given Calendar and nothing else gets an empty list here and the
   * toggle has nothing to show — which is correct, and needs no check of its
   * own.
   */
  const withTasks = param(searchParams, "tasks") === "on";

  const [context, shared, personal, integrations, tasks] = await Promise.all([
    getPortalContext(),
    listCalendar(),
    listPersonalCalendar(),
    view === "list" ? Promise.resolve([] as PortalIntegration[]) : listIntegrations(),
    withTasks && view !== "list" ? listTasks() : Promise.resolve([]),
  ]);

  const toggle = <ViewToggle view={view} date={param(searchParams, "date")} />;

  if (view === "list") {
    return (
      <ListScreen
        tab={tabParam(searchParams, AGENDA_TABS, DEFAULT_AGENDA_TAB)}
        query={(param(searchParams, "q") ?? "").trim()}
        openId={param(searchParams, "event")}
        shared={shared}
        personal={personal}
        context={context}
        toggle={toggle}
      />
    );
  }

  const timeZone = context.timezone;
  const { anchor, window } = viewWindow(view, param(searchParams, "date"), timeZone);
  const anchorIso = isoDateIn(anchor, timeZone);
  const todayIso = isoDateIn(new Date(), timeZone);

  // The toggle survives stepping a month and switching a view: turning it on
  // and having the next arrow turn it off again is the kind of thing that
  // reads as the screen forgetting.
  const keep = withTasks ? "&tasks=on" : "";
  const at = (date: string, nextView: View = view) =>
    `${BASE}?view=${nextView}&date=${date}${keep}`;
  const here = at(anchorIso);
  const eventHref = (id: string) => `${here}&event=${encodeURIComponent(id)}`;

  /* What is owed on each day, as the month cells draw it. */
  const tasksByDay = new Map<string, DueTask[]>();

  for (const task of tasks) {
    if (!task.dueAt) continue;

    // A timestamptz cut to the reader's own day, the same way Whitby's
    // calendar does it — the raw value never matches a cell.
    const dueDate = isoDateIn(new Date(task.dueAt), timeZone);
    const done = task.status === "completed";

    tasksByDay.set(dueDate, [
      ...(tasksByDay.get(dueDate) ?? []),
      {
        id: task.id,
        title: task.title,
        done,
        overdue: !done && dueDate < todayIso,
        // A task with a Request opens it; one without has no screen of its
        // own in the portal (SRS 13.2.3), so it goes to the Tasks list.
        href: task.requestId
          ? `/client-portal/requests/${task.requestId}`
          : "/client-portal/tasks",
      },
    ]);
  }

  const all = [...shared, ...personal];
  const items = inWindow(all, window);
  const openId = param(searchParams, "event");
  const open = openId ? all.find((item) => item.id === openId) ?? null : null;

  return (
    <PageBody>
      {/* One row, not two. The window's name and its steps at one end, what is
          switched on and which view at the other — the view switch used to sit
          on a line of its own above all of this, which is a whole row of page
          spent on four words. */}
      <div className="group mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            {rangeLabel(view, window.rangeStart, window.rangeEnd, timeZone)}
          </span>

          {/* Whitby reveals its steps on hover. Here they stay drawn: a client
              reads this on a phone as often as not, and a phone has no hover
              to reveal them with. */}
          <span className="flex items-center gap-1">
            <StepLink href={at(stepFrom(view, anchor, -1, timeZone))} label={`Previous ${view}`}>
              ‹
            </StepLink>
            <StepLink href={at(stepFrom(view, anchor, 1, timeZone))} label={`Next ${view}`}>
              ›
            </StepLink>
            {window.rangeStart.getTime() <= Date.now() && Date.now() < window.rangeEnd.getTime() ? null : (
              <StepLink href={`${BASE}?view=${view}`} label="Back to today">
                Today
              </StepLink>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Work owed, beside what is booked. Only on the month, which is the
              view with room in a day for both — the same place Whitby puts
              it. */}
          {view === "month" ? (
            <Link
              href={`${BASE}?view=month&date=${anchorIso}${withTasks ? "" : "&tasks=on"}`}
              aria-pressed={withTasks}
              // A filter that is on, drawn the way every filter that is on is
              // drawn in this product: the chosen chip's accent capsule.
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-[5px] text-[12px] no-underline transition-colors",
                withTasks ? "font-semibold" : "font-medium hover:bg-[var(--surface-active)]",
              )}
              style={
                withTasks
                  ? {
                      borderColor: "var(--accent)",
                      background: "var(--accent-tint)",
                      color: "var(--accent)",
                    }
                  : {
                      borderColor: "var(--chat-line)",
                      background: "var(--chat-field)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              ☑ Task due dates
            </Link>
          ) : null}

          <ConnectedStrip integrations={integrations} />
          {toggle}
        </div>
      </div>

      <DataNotice context={context} />

      {view === "day" ? (
        <DayGrid items={items} timeZone={timeZone} hrefFor={eventHref} />
      ) : view === "month" ? (
        <MonthGrid
          items={items}
          window={window}
          timeZone={timeZone}
          today={todayIso}
          dayHrefFor={(iso) => at(iso, "day")}
          eventHrefFor={eventHref}
          under={
            withTasks
              ? (iso) => (
                  <DayTasks
                    tasks={tasksByDay.get(iso) ?? []}
                    moreHref="/client-portal/tasks"
                  />
                )
              : undefined
          }
        />
      ) : (
        <WeekAgenda items={items} timeZone={timeZone} hrefFor={eventHref} />
      )}

      {open ? <EventDetail item={open} timeZone={timeZone} closeHref={here} /> : null}
    </PageBody>
  );
}

/**
 * The list, and the chips over it.
 *
 * Everything the chips count is fetched once and counted once here, so the row
 * can say how many events each tab holds before any of them is opened. That is
 * the whole point of the row: finding out that Meetings is empty used to cost a
 * navigation, and finding out that Key Dates was empty too cost another.
 */
function ListScreen({
  tab,
  query,
  openId,
  shared,
  personal,
  context,
  toggle,
}: {
  tab: CalendarTab;
  query: string;
  openId: string | undefined;
  shared: Awaited<ReturnType<typeof listCalendar>>;
  personal: Awaited<ReturnType<typeof listPersonalCalendar>>;
  context: Awaited<ReturnType<typeof getPortalContext>>;
  toggle: React.ReactNode;
}) {
  const timeZone = context.timezone;
  const now = new Date();

  // A connected calendar's own events sit beside what the team shared, except
  // under By Request: they belong to none, and a group of them titled "Not
  // linked to a request" would call them something they are not.
  const everything = [...shared, ...personal];
  const source = tab === "by-request" ? shared : everything;
  const items = filterCalendar(source, tab, now);

  // Counted over the same lists the tabs draw from, so By Request's number is
  // the one it will show rather than one that counts the client's own events
  // it never lists.
  const counts = {
    ...countCalendar(everything, now),
    "by-request": countCalendar(shared, now)["by-request"],
  };

  const open = openId ? everything.find((item) => item.id === openId) ?? null : null;

  return (
    <PageBody>
      <PageIntro note={AGENDA_SUBTITLE[tab]} action={toggle} />
      <DataNotice context={context} />

      <Agenda
        items={items}
        tab={tab}
        counts={counts}
        timeZone={timeZone}
        today={isoDateIn(now, timeZone)}
        tomorrow={isoDateIn(addDaysIn(now, 1, timeZone), timeZone)}
        initialQuery={query}
      />

      {open ? (
        <EventDetail
          item={open}
          timeZone={timeZone}
          closeHref={agendaHref({ tab, q: query || undefined })}
        />
      ) : null}
    </PageBody>
  );
}

/** Whitby's segmented Day / Week / Month control, with the portal's List after it. */
function ViewToggle({ view, date }: { view: View; date: string | undefined }) {
  // The same track the Tasks screen switches its two halves on — one object
  // for "which view of this list", wherever the portal asks it.
  return (
    <nav aria-label="Calendar view" className="cp-seg">
      {VIEWS.map((key) => {
        // Moving between views keeps the date being looked at; the list has none.
        const href =
          key === "list"
            ? `${BASE}?view=list`
            : `${BASE}?view=${key}${date && view !== "list" ? `&date=${date}` : ""}`;
        return (
          <Link
            key={key}
            href={href}
            aria-current={key === view ? "page" : undefined}
            className="cp-seg-item"
          >
            {VIEW_LABEL[key]}
          </Link>
        );
      })}
    </nav>
  );
}

function StepLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="rounded-full border px-2.5 py-[3px] text-[12.5px] leading-5 no-underline transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--ink)]"
      style={{
        borderColor: "var(--chat-line)",
        background: "var(--chat-field)",
        color: "var(--text-tertiary)",
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Which of the client's own calendars are connected, as Whitby's strip says
 * of the workspace's. An empty Tuesday reads differently when nothing is
 * connected: it may only mean the portal cannot see that day.
 */
function ConnectedStrip({ integrations }: { integrations: PortalIntegration[] }) {
  const shown = CALENDAR_PROVIDERS.filter(({ key }) => {
    const row = integrations.find((integration) => integration.key === key);
    return row && (row.connectable || row.status === "connected");
  });
  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 text-[12.5px]" style={{ color: "var(--text-soft)" }}>
      {shown.map(({ key, label }) => {
        const status = integrations.find((integration) => integration.key === key)?.status;
        const on = status === "connected";
        return (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-[7px] w-[7px] rounded-full"
              style={{ background: on ? "var(--success-dot)" : "var(--border-strong)" }}
              aria-hidden
            />
            {label}, {on ? "Connected" : status === "needs_attention" ? "Needs attention" : "Not connected"}
            {on ? null : (
              <>
                {" · "}
                <Link href="/client-portal/integrations" className="no-underline" style={{ color: "var(--accent)" }}>
                  {status === "needs_attention" ? "Fix" : "Connect"}
                </Link>
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { cn } from "@/base/lib/cn";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import {
  EventDetailDialog,
  NewEventDialog,
} from "@/whitbyos/calendar/components/CalendarDialogs";
import { DayGrid } from "@/whitbyos/calendar/components/DayGrid";
import { MonthGrid } from "@/whitbyos/calendar/components/MonthGrid";
import { WeekAgenda } from "@/whitbyos/calendar/components/WeekAgenda";
import { getEvent, loadCalendar, VIEWS, type CalendarView } from "@/whitbyos/lib/calendar";
import { rangeLabel } from "@/whitbyos/lib/calendar-format";
import { CALENDARS } from "@/whitbyos/lib/calendar-vocab";
import { GOOGLE_PROVIDER } from "@/whitbyos/lib/google-calendar";
import { listRequestOptions, listTasks } from "@/whitbyos/lib/tasks";
import { isDone } from "@/whitbyos/lib/task-vocab";
import { DayTasks } from "@/whitbyos/calendar/components/DayTasks";
import type { CalendarTask } from "@/whitbyos/tasks/components/TaskCalendar";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { listRecipients } from "@/whitbyos/lib/messages";
import { addDaysIn, addMonthsIn, isoDateIn } from "@/whitbyos/lib/zoned";

const LIST = "/whitbyos/calendar";
const GOOGLE_CONNECT = "/api/whitbyos/integrations/google/start";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Screens 8, 8a and 8b — the workspace's calendar across every request, with
 * 8c and 8.1 over it.
 *
 * The strip of connected calendars along the top is not decoration. §11.2
 * makes a connected calendar authoritative, so what is missing from a week is
 * as much the answer as what is in it: someone looking at an empty Tuesday
 * needs to know whether Tuesday is empty or whether nothing is connected.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const requested = one(searchParams?.view) as CalendarView | undefined;
  const view: CalendarView = requested && VIEWS.includes(requested) ? requested : "week";

  /*
   * Task due dates, on or off.
   *
   * Off by default: this screen is what is booked, and a firm with two hundred
   * live tasks would have its appointments buried under them the first time it
   * opened. On, the two sit in the same day, which is the question a calendar
   * is actually asked.
   */
  const withTasks = one(searchParams?.tasks) === "on";

  const creating = one(searchParams?.new) === "1";
  const openId = one(searchParams?.event);

  const result = await loadCalendar(view, one(searchParams?.date), !creating && !openId);

  if (!result.ok) {
    return (
      <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Calendar. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Calendar%20failed%20to%20load"
                variant="secondary"
                className="px-4 py-[9px]"
              >
                Contact support
              </Button>
              <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px]">
                Try again
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const { board } = result;

  const taskList = withTasks ? await listTasks() : null;

  /* Whose week this is, for the line that says so when it is empty. */
  const openClientId = await getOpenClientId();
  const openClientName = openClientId
    ? ((await listClientOptions()).find((row) => row.id === openClientId)?.name ?? null)
    : null;
  const { timezone, anchor, window, events, connected, googleAccount } = board;

  const anchorIso = isoDateIn(anchor, timezone);
  const at = (date: string, nextView: CalendarView = view) =>
    `${LIST}?view=${nextView}&date=${date}${withTasks ? "&tasks=on" : ""}`;
  const here = at(anchorIso);

  const created = one(searchParams?.created);
  const saved = one(searchParams?.saved);
  const justConnected = one(searchParams?.connected);
  const error = one(searchParams?.error);
  // An error from the connect round-trip has no dialog to appear in.
  const looseError = error && !creating && !openId ? error : null;

  const [requests, clients, open, attendees] = await Promise.all([
    creating || openId ? listRequestOptions() : Promise.resolve([]),
    creating || openId ? listClientOptions() : Promise.resolve([]),
    openId ? getEvent(openId, timezone) : Promise.resolve(null),
    // Who could be in the room, for the Attendees field's suggestions.
    creating || openId ? listRecipients() : Promise.resolve([]),
  ]);

  /* The client that is open is the one this event is for, so its Request and
     Client pickers offer that client's work rather than the whole firm's. */
  const forClient = <T extends { clientId?: string | null }>(rows: T[]) =>
    openClientId ? rows.filter((row) => row.clientId === openClientId) : rows;

  /* The tasks this month, as the day chips draw them. */
  const todayIso = isoDateIn(new Date(), timezone);
  const tasksByDay = new Map<string, CalendarTask[]>();

  for (const task of taskList?.ok ? taskList.rows : []) {
    if (!task.due_date) continue;

    /* A timestamptz cut to the workspace's own day, the same way the Tasks
       calendar does it — the raw value never matched a cell. */
    const dueDate = isoDateIn(new Date(task.due_date), timezone);
    const done = isDone(task.status);

    const chip: CalendarTask = {
      id: task.id,
      title: task.title,
      dueDate,
      status: task.status,
      priority: task.priority,
      clientName: task.clientName,
      done,
      overdue: Boolean(!done && dueDate < todayIso),
      href: task.planId
        ? `/whitbyos/work-plans/${task.planId}/tasks/${task.id}`
        : `/whitbyos/tasks?task=${task.id}`,
    };

    tasksByDay.set(dueDate, [...(tasksByDay.get(dueDate) ?? []), chip]);
  }

  const step = (amount: number) => {
    const next =
      view === "month"
        ? addMonthsIn(anchor, amount, timezone)
        : addDaysIn(anchor, amount * (view === "week" ? 7 : 1), timezone);
    return at(isoDateIn(next, timezone));
  };

  return (
    <div className="flex h-[calc(100vh-1px)] flex-col px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <div className="mb-1.5 flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold tracking-[-0.3px]">Calendar</h1>

        <div className="flex items-center gap-2.5">
          <div className="flex overflow-hidden rounded-control border border-line-strong">
            {VIEWS.map((option, index) => (
              <Link
                key={option}
                href={at(anchorIso, option)}
                className={cn(
                  "px-3.5 py-[7px] text-[13px] capitalize no-underline",
                  option === view && "font-semibold",
                  index > 0 && "border-l border-line-strong",
                )}
                style={
                  option === view
                    ? { background: "var(--canvas)", color: "var(--ink)" }
                    : { color: "var(--text-soft)" }
                }
              >
                {option}
              </Link>
            ))}
          </div>

          {/* Work owed, beside what is booked. Only on the month, which is the
              view with room in a day for both. */}
          {view === "month" ? (
            <Link
              href={`${LIST}?view=month&date=${anchorIso}${withTasks ? "" : "&tasks=on"}`}
              className="rounded-control border px-3 py-[7px] text-[13px] no-underline"
              style={
                withTasks
                  ? { borderColor: "var(--accent)", background: "var(--accent-tint)", color: "var(--accent)", fontWeight: 600 }
                  : { borderColor: "var(--border-strong)", color: "var(--text-soft)" }
              }
            >
              ☑ Task due dates
            </Link>
          ) : null}

          <Button
            href={`${here}&new=1`}
            variant="primary"
            unsized
            className="px-4 py-[9px] text-[13.5px]"
          >
            + New Event
          </Button>
        </div>
      </div>

      <div className="group mb-5 flex flex-wrap items-center justify-between gap-4">
        {/* The reference draws this row as a label and nothing else, so at rest
            that is all it is. The two steps are positioned off the end of the
            label rather than beside it, in the flow they would push the label
            off its left edge, and appear when the row is under the cursor. A
            calendar that cannot leave this week is not a calendar; a label
            that sits 30px from where it was drawn is not the reference. */}
        <div className="relative flex items-center">
          <span className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            {rangeLabel(view, window.rangeStart, window.rangeEnd, timezone)}
          </span>

          <span className="absolute left-full ml-3 flex items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
            <Link
              href={step(-1)}
              aria-label={`Previous ${view}`}
              className="rounded-control border border-line-strong px-2 py-0.5 text-[13px] leading-5 no-underline"
              style={{ color: "var(--text-tertiary)" }}
            >
              ‹
            </Link>
            <Link
              href={step(1)}
              aria-label={`Next ${view}`}
              className="rounded-control border border-line-strong px-2 py-0.5 text-[13px] leading-5 no-underline"
              style={{ color: "var(--text-tertiary)" }}
            >
              ›
            </Link>
          </span>
        </div>

        <div
          className="flex flex-wrap items-center gap-4 text-[12.5px]"
          style={{ color: "var(--text-soft)" }}
        >
          {CALENDARS.map((calendar) => {
            const on = connected.includes(calendar.value);
            return (
              <span key={calendar.value} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-[7px] w-[7px] rounded-full"
                  style={{ background: on ? "var(--success-dot)" : "var(--border-strong)" }}
                  aria-hidden
                />
                {calendar.label}, {on ? "Connected" : "Not connected"}
                {on ? null : (
                  <>
                    {" · "}
                    {calendar.value === GOOGLE_PROVIDER ? (
                      // A plain anchor, not next/link. The route answers with a
                      // redirect to Google, and the client router — which
                      // fetches an RSC payload rather than navigating — cannot
                      // follow one off-origin. It fails as "Failed to fetch".
                      <a
                        href={`${GOOGLE_CONNECT}?next=${encodeURIComponent(here)}`}
                        className="no-underline"
                        style={{ color: "var(--accent)" }}
                      >
                        Connect
                      </a>
                    ) : (
                      <Link href="/whitbyos/integrations" className="no-underline">
                        Connect
                      </Link>
                    )}
                  </>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {looseError ? (
        <div className="mb-4">
          <Callout tone="danger">{looseError}</Callout>
        </div>
      ) : null}

      {view === "day" ? (
        <DayGrid
          events={events}
          timezone={timezone}
          hrefFor={(id) => `${here}&event=${id}`}
        />
      ) : view === "month" ? (
        <MonthGrid
          events={events}
          window={window}
          timezone={timezone}
          dayHrefFor={(iso) => at(iso, "day")}
          eventHrefFor={(id) => `${here}&event=${id}`}
          under={
            withTasks
              ? (iso) => <DayTasks iso={iso} tasks={tasksByDay.get(iso) ?? []} />
              : undefined
          }
        />
      ) : (
        <WeekAgenda
          events={events}
          timezone={timezone}
          hrefFor={(id) => `${here}&event=${id}`}
          clientName={openClientName}
        />
      )}

      {creating ? (
        <NewEventDialog
          requests={forClient(requests)}
          clients={openClientId ? clients.filter((row) => row.id === openClientId) : clients}
          people={attendees.map((person) => ({ name: person.name, detail: person.detail }))}
          defaultDate={anchorIso}
          connected={connected}
          closeHref={here}
          error={error}
        />
      ) : null}

      {open ? (
        <EventDetailDialog
          people={attendees.map((person) => ({ name: person.name, detail: person.detail }))}
          event={open}
          requests={requests}
          clients={clients}
          timezone={timezone}
          googleAccount={googleAccount}
          closeHref={here}
          error={error}
        />
      ) : null}

      {created ? (
        <Toast
          title="Event created"
          detail={`"${created}" is on the calendar.`}
          closeHref={here}
        />
      ) : null}

      {saved ? (
        <Toast
          title="Event updated"
          detail={`"${saved}" has been saved.`}
          closeHref={here}
        />
      ) : null}

      {justConnected ? (
        <Toast
          title="Calendar connected"
          detail="Your Google Calendar is now syncing with this workspace."
          closeHref={here}
        />
      ) : null}
    </div>
  );
}

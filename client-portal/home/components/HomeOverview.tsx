import { Pill } from "@/base/components/Pill";
import { ProgressBar } from "@/base/components/ProgressBar";
import { StatusPill } from "@/client-portal/components/StatusPill";
import { KpiCard, KpiRow } from "@/client-portal/components/Kpi";
import { ActivityMark, ACTIVITY_TONE } from "@/client-portal/components/ActivityMark";
import {
  ListMark,
  TickMark,
  UpdateMark,
  Widget,
  WidgetEmpty,
  WidgetRow,
} from "@/client-portal/components/Widget";
import {
  dueLabel,
  money,
  relativeTime,
  shortDate,
  timeRange,
  weekdayShort,
} from "@/client-portal/lib/format";
import { REQUEST_STATUS } from "@/client-portal/lib/status";
import type {
  ActionItem,
  ActivityEntry,
  AreaAccess,
  BillingSummary,
  CalendarItem,
  PortalRequest,
  ProgressUpdate,
} from "@/client-portal/types";

export function HomeOverview({
  actions,
  requests,
  updates,
  activity,
  upcoming,
  billing,
  viewerName,
  areas,
  timeZone = "UTC",
}: {
  actions: ActionItem[];
  requests: PortalRequest[];
  updates: ProgressUpdate[];
  /** The cross-area feed, trimmed to what a panel can hold. */
  activity: ActivityEntry[];
  /** Events still to come, soonest first. */
  upcoming: CalendarItem[];
  /** Null for a reader without Billing — the tile and its figure are not theirs. */
  billing: BillingSummary | null;
  viewerName?: string;
  /** Which sections this reader is permitted to see at all. */
  areas: AreaAccess;
  /** The professional's zone — see `PortalContext.timezone`. */
  timeZone?: string;
}) {
  const active = requests.filter(
    (request) => request.status === "running" || request.status === "approval",
  );

  const nextEvent = upcoming[0] ?? null;

  // A section is left out rather than emptied. "No active requests" on a screen
  // belonging to somebody who was never granted Requests is not true — there may
  // be a dozen, and they are simply not this person's to see. Home is assembled
  // from the areas its reader holds, which is why it is the one screen with no
  // area of its own.
  const main = [
    areas.requests ? (
      <Widget key="requests" title="Active Requests" href="/client-portal/requests">
        {active.length === 0 ? (
          <WidgetEmpty
            mark={<ListMark />}
            action={{ label: "Start a request", href: "/client-portal/requests?new=1" }}
          >
            No active requests right now.
          </WidgetEmpty>
        ) : (
          active.map((request) => (
            <WidgetRow key={request.id} href={`/client-portal/requests/${request.id}`} tall>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{request.title}</div>
                <div className="truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {request.nextStep ? `Next: ${request.nextStep}` : "No next step set"}
                </div>
              </div>
              {/* The bar and its figure together, and only from a tablet up:
                  on a phone the row is the title and the status, which is
                  what decides whether to open it. */}
              <div className="hidden w-[120px] shrink-0 items-center gap-2 sm:flex">
                <ProgressBar value={request.progress} />
                <span
                  className="w-8 shrink-0 text-right text-[11.5px] tabular-nums"
                  style={{ color: "var(--text-faint)" }}
                >
                  {Math.round(request.progress)}%
                </span>
              </div>
              <span className="flex w-[84px] shrink-0 justify-end">
                <StatusPill status={REQUEST_STATUS[request.status]} />
              </span>
            </WidgetRow>
          ))
        )}
      </Widget>
    ) : null,

    areas.updates ? (
      <Widget key="updates" title="Recent Progress Updates" href="/client-portal/updates">
        {updates.length === 0 ? (
          <WidgetEmpty mark={<UpdateMark />}>
            Your team posts an update whenever active work moves forward.
          </WidgetEmpty>
        ) : (
          updates.slice(0, 5).map((update) => {
            const own = viewerName != null && update.authorName === viewerName;
            return (
              <WidgetRow key={update.id} href="/client-portal/updates">
                <span
                  aria-hidden
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center self-start rounded-full"
                  style={{
                    marginTop: 2,
                    background: own ? "var(--canvas)" : "var(--accent-tint)",
                    color: own ? "var(--text-tertiary)" : "var(--accent)",
                  }}
                >
                  <UpdateMark />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px]">
                    {own ? `You shared: ${update.body}` : (update.headline ?? update.body)}
                  </div>
                  <div
                    className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {update.urgent ? <Pill tone="danger">Urgent</Pill> : null}
                    <span className="truncate">
                      {[update.requestTitle, relativeTime(update.publishedAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </div>
              </WidgetRow>
            );
          })
        )}
      </Widget>
    ) : null,

    /*
     * The feed, on Overview rather than only behind its own tab.
     *
     * Recent Activity spans every area this reader holds — a document shared,
     * an invoice issued, a form sent back — and putting it one tab away meant
     * the dashboard could show two panels of requests and updates while the
     * thing that actually happened today sat unseen next door.
     */
    activity.length > 0 ? (
      <Widget
        key="activity"
        title="Recent activity"
        href="/client-portal?tab=activity"
        linkLabel="View all"
      >
        {activity.map((entry) => {
          const tone = ACTIVITY_TONE[entry.kind];
          return (
            <WidgetRow key={entry.id} href={entry.href ?? undefined}>
              <span
                aria-hidden
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center self-start rounded-full"
                style={{ marginTop: 2, background: tone.bg, color: tone.fg }}
              >
                <ActivityMark kind={entry.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px]">{entry.body}</div>
                <div className="mt-0.5 truncate text-[12px]" style={{ color: "var(--text-faint)" }}>
                  {[entry.requestTitle, relativeTime(entry.occurredAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </WidgetRow>
          );
        })}
      </Widget>
    ) : null,
  ].filter(Boolean);

  return (
    <>
      {/*
       * The counts, above everything — Whitby's dashboard row.
       *
       * A client arriving here is asking three questions: is anything waiting
       * on me, is my work moving, and do I owe anything. The row used to
       * answer the first two and stop, so a client with Billing and a calendar
       * full of appointments read three tiles about requests and had to go
       * looking for the rest. Each tile is gated the way its panel is, so the
       * row is two tiles wide for somebody who holds two areas rather than
       * five with three of them empty.
       */}
      {/* `wide` only when Billing is in the row. "$18,425.00" at 30px bold
          does not fit the 96px track a two-digit count sits in, and widening
          the row for a reader who has no money tile would space three counts
          across a screen for no reason. */}
      <KpiRow tour="portal-counts" wide={billing !== null}>
        {areas.requests ? (
          <KpiCard
            label="Active requests"
            value={String(active.length)}
            href="/client-portal/requests"
          />
        ) : null}
        <KpiCard
          label={actions.length === 1 ? "Item needs you" : "Items need you"}
          value={String(actions.length)}
          tone={actions.length > 0 ? "danger" : "ink"}
          href="/client-portal?tab=action-needed"
        />
        {areas.updates ? (
          <KpiCard
            label="Progress updates"
            value={String(updates.length)}
            href="/client-portal/updates"
          />
        ) : null}
        {billing ? (
          <KpiCard
            label="Outstanding"
            value={money(billing.outstandingCents, billing.currency)}
            tone={billing.outstandingCents > 0 ? "danger" : "success"}
            detail={
              billing.nextDueAt
                ? `Next due ${shortDate(billing.nextDueAt, new Date(), timeZone)}`
                : "Nothing owed"
            }
            href="/client-portal/billing"
          />
        ) : null}
        {areas.calendar ? (
          <KpiCard
            label="Next appointment"
            // A date is the answer to "when", so the date is the figure. An
            // empty calendar says so in words rather than showing a zero,
            // which would read as a count of something.
            value={nextEvent ? shortDate(nextEvent.startAt, new Date(), timeZone) : "—"}
            detail={
              nextEvent
                ? nextEvent.allDay
                  ? nextEvent.title
                  : timeRange(nextEvent.startAt, nextEvent.endAt, timeZone)
                : "Nothing scheduled"
            }
            href="/client-portal/calendar"
          />
        ) : null}
      </KpiRow>

      {/*
       * The amber "3 items need your attention, a form to complete and 2
       * tasks — review them" banner is gone.
       *
       * It was the third statement of one fact inside one viewport: the strip
       * above counts the same items in red and links to the same tab, and the
       * "Needs you" panel to the right lists them by name with their dates.
       * A screen that says the same thing three times in three shapes is
       * harder to read than one that says it once, not easier — and the one it
       * kept is the one that names what is actually waiting.
       */}
      {/* Two columns from a laptop up, as Whitby's: the work in the wide one,
          what is waiting on the client in the narrow one beside it. On
          anything smaller the side column follows the main one, and "Needs
          you" is moved first so it is not three screens down a phone. */}
      <div className="flex flex-col gap-5 lg:flex-row" data-tour="portal-widgets">
        <div className="flex min-w-0 flex-1 flex-col gap-5">{main}</div>

        <div className="-order-1 flex w-full flex-col gap-5 lg:order-none lg:w-[300px] lg:shrink-0">
          <Widget
            title="Needs you"
            count={actions.length}
            href="/client-portal?tab=action-needed"
          >
            {actions.length === 0 ? (
              <WidgetEmpty mark={<TickMark />} tone="good">
                Nothing is waiting on you.
              </WidgetEmpty>
            ) : (
              actions.slice(0, 5).map((action) => {
                const due = dueLabel(action.dueLabel, new Date(), timeZone);
                return (
                  <WidgetRow key={action.id} href={action.href ?? undefined}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px]">{action.title}</div>
                      <div className="truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        {action.context ?? "Your account"}
                      </div>
                    </div>
                    {due ? (
                      <span
                        className="shrink-0 text-[12px] font-medium"
                        style={{
                          color:
                            due === "Overdue" || due === "Due today"
                              ? "var(--danger-fg)"
                              : "var(--text-tertiary)",
                        }}
                      >
                        {capitalise(due.replace(/^Due /, ""))}
                      </span>
                    ) : null}
                  </WidgetRow>
                );
              })
            )}
          </Widget>

          {/*
           * What is coming, beside what is waiting.
           *
           * The calendar was a nav item and nothing else: a client with an
           * appointment on Thursday had no way to learn that from the screen
           * they land on. The date leads each row because that is what the
           * column is scanned for.
           */}
          {areas.calendar ? (
            <Widget title="Upcoming" href="/client-portal/calendar">
              {upcoming.length === 0 ? (
                <WidgetEmpty mark={<CalendarMark />}>Nothing scheduled.</WidgetEmpty>
              ) : (
                upcoming.slice(0, 4).map((event) => (
                  <WidgetRow key={event.id} href="/client-portal/calendar" tall>
                    <div
                      className="flex w-[34px] shrink-0 flex-col items-center rounded-control py-1"
                      style={{ background: "var(--canvas)" }}
                    >
                      <span
                        className="text-[9.5px] font-semibold tracking-[0.04em]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {weekdayShort(event.startAt, timeZone)}
                      </span>
                      <span className="text-[14px] font-semibold leading-tight tabular-nums">
                        {dayOfMonth(event.startAt, timeZone)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{event.title}</div>
                      <div className="truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        {event.allDay
                          ? "All day"
                          : timeRange(event.startAt, event.endAt, timeZone)}
                      </div>
                    </div>
                  </WidgetRow>
                ))
              )}
            </Widget>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** "tomorrow" beside "Sep 24" reads as a typo once the "Due" is gone. */
function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The day alone, in the professional's zone, for the date block on a row. */
function dayOfMonth(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { day: "numeric", timeZone });
}

function CalendarMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3.5" width="11" height="10" rx="1" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </svg>
  );
}

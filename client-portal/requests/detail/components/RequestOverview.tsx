import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { shortDate } from "@/client-portal/lib/format";
import { ActionList } from "@/client-portal/components/ActionList";
import { TaskTickForm } from "@/client-portal/components/TaskDoneButton";
import type {
  ActionItem,
  CalendarItem,
  PortalDocument,
  PortalRequestDetail,
} from "@/client-portal/types";
import type { RequestTaskRow } from "./RequestTabPanel";

/**
 * 3.3o — the Request's front page, as the client may see it.
 *
 * WHAT IS FIRST, AND WHY
 *
 * Whitby opens this screen with Outstanding Items, which are its own
 * Considerations and stay internal. The client's equivalent is the one part of
 * the page that asks something rather than states it, so it leads — and it now
 * leads *visibly*: a tinted head and a rule in the warning colour while
 * anything is outstanding, drawn like every other card once nothing is. A
 * client scrolling this page should not have to read four headings to find the
 * one addressed to them, and four cards of identical weight is exactly that.
 *
 * NOTHING IS A CARD ABOUT NOTHING
 *
 * Notes and This Week used to be drawn whether or not there was a note or an
 * event, so the ordinary Request — which has neither — was a column of boxes
 * saying so. They are drawn when they have something in them and left out
 * otherwise; the tab row above says what exists, counted, so nothing is hidden
 * by their absence. The two that are always drawn are the two that are the
 * point of the screen: what is waiting on the client, and the work itself.
 *
 * ONE CARD, NOT FOUR
 *
 * The right rail was Key Dates, Contacts, Linked and Shared Documents, of
 * which the first three carried between one and three lines each — three
 * headings, three borders and 180px of padding to say "Created Sep 16". They
 * are one labelled list now. Shared Documents keeps its own card because it is
 * a list of things to open rather than a set of facts to read.
 *
 * Whitby's Providers card is not drawn at all. SRS 13.11.1 lets a client see
 * provider options the professional intentionally shared, and nothing in
 * Whitby can share one yet: `whitbyos_provider_options.client_visible_content`
 * is written by no screen.
 */
export function RequestOverview({
  requestId,
  tasks,
  canTick = false,
  actions,
  calendar,
  documents,
  extras,
  targetDate,
  closedAt,
  accountName,
  timeZone,
}: {
  requestId: string;
  tasks: RequestTaskRow[];
  /** Whether this reader may tick a task off — false for a view-only member. */
  canTick?: boolean;
  actions: ActionItem[];
  /** This Request's events, already scoped by the screen. */
  calendar: CalendarItem[];
  documents: PortalDocument[];
  extras: PortalRequestDetail;
  targetDate: string | null;
  closedAt: string | null;
  accountName: string;
  timeZone: string;
}) {
  const here = `/client-portal/requests/${requestId}`;
  const now = new Date();
  const open = tasks.filter((task) => task.status !== "completed");

  // "This Week" as Whitby reads it: from the start of today, seven days on.
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekEnd = dayStart.getTime() + 7 * 86_400_000;
  const events = calendar
    .filter((item) => {
      const at = new Date(item.startAt).getTime();
      return at >= dayStart.getTime() && at < weekEnd;
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const latestNote = extras.notes[0] ?? null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <OverviewCard
          title={actions.length > 0 ? `Waiting on you (${actions.length})` : "Waiting on you"}
          tone={actions.length > 0 ? "warning" : "plain"}
          flush={actions.length > 0}
        >
          {actions.length === 0 ? (
            <Muted>
              Nothing on this request needs you right now. Your team will put anything they need
              here.
            </Muted>
          ) : (
            // Flush to the card's edges: these are the panel's own rows, and
            // rows inset by a card's padding read as a quotation of a list
            // rather than as the list.
            <ActionList items={actions} timeZone={timeZone} canTick={canTick} returnTo={here} />
          )}
        </OverviewCard>

        <OverviewCard
          title={`The work (${open.length} open)`}
          action={open.length > 5 ? { label: "View all", href: `${here}?tab=tasks` } : undefined}
        >
          {open.length === 0 ? (
            <Muted>
              {tasks.length > 0
                ? "Every task on this request is done."
                : "Your team has not shared any tasks on this request yet."}
            </Muted>
          ) : (
            <div className="flex flex-col">
              {open.slice(0, 5).map((task) => {
                const overdue = task.dueAt ? new Date(task.dueAt) < now : false;
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 border-t border-line py-[7px] first:border-t-0 first:pt-0"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {/* The box was a picture until client-portal/020: the
                          one thing on this card that looks pressable was the
                          one thing that did nothing. It ticks the task off
                          now, and stays a picture for a view-only member. */}
                      {canTick && task.canComplete ? (
                        <TaskTickForm
                          taskId={task.id}
                          done={false}
                          returnTo={here}
                          requestId={requestId}
                        />
                      ) : (
                        <span
                          className="h-[15px] w-[15px] shrink-0 rounded-[3px] border"
                          style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 truncate text-[13.5px]">{task.title}</span>
                      {task.ownerName ? (
                        <span title={task.ownerName} className="inline-flex shrink-0">
                          <Avatar name={task.ownerName} size={20} className="text-[9px]" />
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="shrink-0 text-[12px] font-medium"
                      style={{ color: overdue ? "var(--danger-text)" : "var(--text-tertiary)" }}
                    >
                      {overdue
                        ? "Overdue"
                        : task.dueAt
                          ? `Due ${shortDate(task.dueAt, now, timeZone)}`
                          : "No date"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </OverviewCard>

        {/* Drawn when there is one. A card whose whole content is "your team
            has not shared a note yet" is a card about nothing, and the tab
            above already carries the count. */}
        {latestNote ? (
          <OverviewCard
            title="Latest note"
            action={
              extras.notes.length > 1
                ? { label: `All ${extras.notes.length}`, href: `${here}?tab=notes` }
                : undefined
            }
          >
            <p
              className="whitespace-pre-wrap text-[13px] leading-[1.7]"
              style={{ color: "var(--text-secondary)" }}
            >
              {latestNote.body}
            </p>
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
              {latestNote.authorName ? `${latestNote.authorName} · ` : ""}
              {shortDate(latestNote.createdAt, now, timeZone)}
            </p>
          </OverviewCard>
        ) : null}

        {events.length > 0 ? (
          <OverviewCard
            title="This week"
            action={{ label: "Calendar", href: `${here}?tab=calendar` }}
          >
            <div className="flex flex-col">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-baseline justify-between gap-3 border-t border-line py-[7px] text-[13px] first:border-t-0 first:pt-0"
                >
                  <span className="min-w-0 truncate">{event.title}</span>
                  <span
                    className="shrink-0 text-[12px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {new Date(event.startAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      timeZone,
                    })}
                    {event.allDay
                      ? ", all day"
                      : `, ${new Date(event.startAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone,
                        })}`}
                  </span>
                </div>
              ))}
            </div>
          </OverviewCard>
        ) : null}
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[268px]">
        <OverviewCard title="At a glance">
          <dl className="flex flex-col">
            {extras.createdAt ? (
              <Fact label="Opened">{shortDate(extras.createdAt, now, timeZone)}</Fact>
            ) : null}
            {targetDate ? <Fact label="Target">{shortDate(targetDate, now, timeZone)}</Fact> : null}
            {closedAt ? <Fact label="Closed">{shortDate(closedAt, now, timeZone)}</Fact> : null}

            <Fact label="Account">{accountName}</Fact>

            {/* The people named on the Request, by name and role only — one of
                the four explicit acts of the professional this screen is
                assembled from. */}
            <Fact label={extras.team.length === 1 ? "Contact" : "Contacts"}>
              {extras.team.length === 0 ? (
                <span style={{ color: "var(--text-tertiary)" }}>Nobody named yet</span>
              ) : (
                extras.team.map((person, index) => (
                  <div key={`${person.name}-${index}`}>
                    {person.name}
                    {person.role ? `, ${person.role}` : ""}
                  </div>
                ))
              )}
            </Fact>
          </dl>
        </OverviewCard>

        <OverviewCard
          title={documents.length > 0 ? `Documents (${documents.length})` : "Documents"}
          action={
            documents.length > 6 ? { label: "View all", href: `${here}?tab=documents` } : undefined
          }
        >
          {documents.length === 0 ? (
            <Muted>No documents shared on this request yet.</Muted>
          ) : (
            <ul className="space-y-1.5">
              {documents.slice(0, 6).map((doc) => (
                <li key={doc.id}>
                  <Link
                    href="/client-portal/documents"
                    className="flex items-center gap-2 text-[12.5px] no-underline"
                    style={{ color: "var(--ink)" }}
                  >
                    <span aria-hidden style={{ color: "var(--text-tertiary)" }}>
                      ▥
                    </span>
                    <span className="truncate">{doc.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>
      </aside>
    </div>
  );
}

function OverviewCard({
  title,
  action,
  tone = "plain",
  flush = false,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  /** `warning` while the card is asking something of the reader. */
  tone?: "plain" | "warning";
  /** For a card holding the panel's own rows, which bring their own padding. */
  flush?: boolean;
  children: React.ReactNode;
}) {
  const warn = tone === "warning";

  return (
    <section
      className="overflow-hidden rounded-card-cp border bg-surface"
      style={{ borderColor: warn ? "var(--warning-border)" : "var(--border)" }}
    >
      <div
        className={`flex items-center justify-between gap-3 px-4 ${flush ? "border-b py-2.5" : "pb-2.5 pt-4"}`}
        style={
          warn
            ? { background: "var(--warning-bg)", borderColor: "var(--warning-border)" }
            : { borderColor: "var(--border)" }
        }
      >
        <span
          className="text-[13px] font-semibold"
          style={warn ? { color: "var(--warning-fg)" } : undefined}
        >
          {title}
        </span>
        {action ? (
          <Link href={action.href} className="text-[12px] no-underline" style={{ color: "var(--accent)" }}>
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className={flush ? undefined : "px-4 pb-4"}>{children}</div>
    </section>
  );
}

/** One labelled line in the rail's list of facts. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-line py-[7px] text-[12.5px] first:border-t-0 first:pt-0">
      <dt className="w-[68px] shrink-0" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </dt>
      <dd className="min-w-0 flex-1" style={{ color: "var(--ink)" }}>
        {children}
      </dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
      {children}
    </p>
  );
}

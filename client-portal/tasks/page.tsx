import { Pill } from "@/base/components/Pill";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listTasks } from "@/client-portal/lib/data/tasks";
import { daysUntil, dueLabel, relativeTime } from "@/client-portal/lib/format";
import { TASK_STATUS } from "@/client-portal/lib/status";
import { param, tabParam, type ScreenProps } from "@/client-portal/lib/routing";
import { PageBody, PageIntro } from "@/client-portal/components/PageHeader";
import { ChipNav } from "@/client-portal/components/ChipNav";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { StatusPill } from "@/client-portal/components/StatusPill";
import { TaskDoneButton } from "@/client-portal/components/TaskDoneButton";
import {
  ListPanel,
  PanelBody,
  PanelEmpty,
  PanelGroup,
  PanelMeta,
  PanelRow,
  PanelRows,
  PanelSearch,
  PanelTags,
  SegmentedNav,
  PanelTitle,
} from "@/client-portal/components/Panel";
import type { PortalTask, TaskStatus } from "@/client-portal/types";

const TABS = ["open", "waiting", "completed"] as const;

const LABELS: Record<(typeof TABS)[number], string> = {
  open: "Open",
  waiting: "Waiting",
  completed: "Completed",
};

const BASE = "/client-portal/tasks";

/**
 * The two kinds of task, and both of them.
 *
 * A switch rather than an option inside the Request select, which is where
 * this lived for about an hour. "Not under a request" as the last entry of a
 * dropdown of request names is a category hidden inside a list of instances:
 * a client had to open the select to discover that the distinction existed at
 * all, and the one they most often want — everything their team is doing for
 * them that is not attached to a job — was the least reachable thing on the
 * screen. On the track it is one press, and the counts say what is behind each
 * before it is pressed.
 */
const SCOPES = ["all", "request", "standalone"] as const;
type Scope = (typeof SCOPES)[number];

const SCOPE_LABELS: Record<Scope, string> = {
  all: "All",
  request: "In a request",
  standalone: "Standalone",
};

function scopeParam(raw: string | undefined): Scope {
  return SCOPES.includes(raw as Scope) ? (raw as Scope) : "all";
}

function hrefFor(
  tab: (typeof TABS)[number],
  q: string,
  request: string,
  scope: Scope,
) {
  const query = new URLSearchParams();
  if (tab !== "open") query.set("tab", tab);
  if (q) query.set("q", q);
  // A named Request is already "in a request"; carrying both would let the
  // two disagree, and the switch would sit on a segment the rows contradict.
  if (request) query.set("request", request);
  else if (scope !== "all") query.set("scope", scope);
  const rest = query.toString();
  return rest ? `${BASE}?${rest}` : BASE;
}

/**
 * Every task a client can see, in one list.
 *
 * WHAT CHANGED, AND WHY
 *
 * This screen used to hold exactly the tasks that belonged to no Request. The
 * reasoning was that a task filed under a Request already has a home — that
 * Request's Tasks tab — and listing it twice is a row somebody has to check in
 * two places. That is true of a *list*, and false of a *queue*: it means a
 * client who wants to know what they owe this week has to open every Request
 * they have and add the answers up, and the one screen named Tasks is the one
 * that could not tell them. So it carries all of it now. The Request's own tab
 * is still there, and is still the right place to read one Request's work; this
 * is the place to read the client's.
 *
 * FILED BY WHEN, NOT BY WHERE
 *
 * The rows are grouped by what is owed when — Overdue, Today, This week, Later,
 * and the ones with no date — because that is the order a person does them in,
 * and because "which Request is this under" is a question a row can answer in
 * its own second line. Grouping by Request instead would sort the list by
 * something the reader already knows and bury the one date that decides what
 * they open first. The Request is a filter beside the search for the times the
 * question really is "what is left on the wedding".
 *
 * Completed is not grouped. A finished task has no due date worth reporting —
 * see `dueFor` — so there is nothing to file it under; it reads newest first.
 *
 * WHAT IS STILL NOT HERE
 *
 * A task that reaches the client only through a shared Work Plan. `listTasks`
 * returns the tasks named to them (SRS 7.1.5); a plan's tasks arrive by a
 * different act — the professional sharing the plan — and are read on the plan,
 * where their stream and their order are what make them legible. The Request's
 * Tasks tab shows both, because that is the screen where the two meet.
 *
 * No area of its own. `listTasks` gates on `requests`, because a task is part
 * of the work a Request describes even when it is not filed under one, and a
 * client not granted Requests has not been granted its tasks either.
 */
export default async function TasksScreen({ searchParams }: ScreenProps) {
  const tab = tabParam(searchParams, TABS, "open");
  const search = (param(searchParams, "q") ?? "").trim();
  const request = param(searchParams, "request") ?? "";
  const scope: Scope = request ? "request" : scopeParam(param(searchParams, "scope"));

  const [context, all] = await Promise.all([getPortalContext(), listTasks()]);

  /*
   * Every Request that has a task on it, named once, in the order the tasks
   * arrived. Built from the rows rather than from `listRequests()` so the
   * select never offers a Request whose selection would empty the list.
   */
  const requests = new Map<string, string>();
  for (const task of all) {
    if (task.requestId && !requests.has(task.requestId)) {
      requests.set(task.requestId, task.requestTitle ?? "Untitled request");
    }
  }

  // The switch and the Request filter narrow the counts on the chips as well
  // as the rows: a chip is a subset of what is on the screen, not of what
  // exists. The switch's own counts are taken before either applies, because
  // they are what it is offering to move to.
  const scoped = request
    ? all.filter((task) => task.requestId === request)
    : scope === "request"
      ? all.filter((task) => task.requestId !== null)
      : scope === "standalone"
        ? all.filter((task) => task.requestId === null)
        : all;

  const scopeCounts: Record<Scope, number> = {
    all: all.length,
    request: all.filter((task) => task.requestId !== null).length,
    standalone: all.filter((task) => task.requestId === null).length,
  };

  const inTab = scoped.filter((task) => task.status === tab);
  const needle = search.toLowerCase();
  const visible = search
    ? inTab.filter(
        (task) =>
          task.title.toLowerCase().includes(needle) ||
          (task.nextAction?.toLowerCase().includes(needle) ?? false) ||
          (task.requestTitle?.toLowerCase().includes(needle) ?? false),
      )
    : inTab;

  // Where a tick puts the client back: exactly the view they ticked it from.
  const here = hrefFor(tab, search, request, scope);
  const filtered = Boolean(search || request || scope !== "all");

  const groups = tab === "completed" ? null : groupByDue(visible, context.timezone);

  return (
    <PageBody>
      <PageIntro note="Everything your team has asked of you or is doing for you, across every request — soonest first." />

      <DataNotice context={context} />

      <ListPanel
        controls={
          <>
            <PanelSearch
              action={BASE}
              placeholder="Search tasks and requests"
              value={search}
              hidden={{
                tab: tab === "open" ? undefined : tab,
                scope: scope === "all" ? undefined : scope,
              }}
              selects={
                // Nothing to choose between while the standalone half is the
                // one on screen: none of them is under a request.
                requests.size > 0 && scope !== "standalone"
                  ? [
                      {
                        name: "request",
                        anyLabel: "All requests",
                        value: request,
                        options: [...requests].map(([id, title]) => ({
                          value: id,
                          label: title,
                        })),
                      },
                    ]
                  : []
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              {/* Every state counted, so "is there anything waiting?" is read
                  off the row rather than found by opening it. */}
              <ChipNav
                label="Task state"
                active={tab}
                chips={TABS.map((key) => ({
                  key,
                  label: LABELS[key],
                  href: hrefFor(key, search, request, scope),
                  count: scoped.filter((task) => task.status === key).length,
                  urgent: key === "open",
                }))}
              />

              {/* Only where both kinds exist. A switch between two halves of
                  which one is empty is a control that can only disappoint. */}
              {scopeCounts.request > 0 && scopeCounts.standalone > 0 ? (
                <SegmentedNav
                  label="Which tasks"
                  active={scope}
                  items={SCOPES.map((key) => ({
                    key,
                    label: SCOPE_LABELS[key],
                    href: hrefFor(tab, search, "", key),
                    count: scopeCounts[key],
                  }))}
                />
              ) : null}
            </div>
          </>
        }
      >
        {visible.length === 0 ? (
          <PanelEmpty
            glyph={filtered ? "⌕" : "☑"}
            title={filtered ? "Nothing matches that" : emptyTitle(tab)}
            detail={
              filtered
                ? "No task here matches. Clear the filters to see the rest."
                : emptyBody(tab)
            }
            action={
              filtered ? { label: "Clear filters", href: hrefFor(tab, "", "", "all") } : undefined
            }
          />
        ) : groups ? (
          groups.map((group) => (
            <PanelGroup key={group.key} label={group.label} note={group.rows.length}>
              {group.rows.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  here={here}
                  canTick={!context.viewOnly}
                  timeZone={context.timezone}
                />
              ))}
            </PanelGroup>
          ))
        ) : (
          <PanelRows>
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                here={here}
                canTick={!context.viewOnly}
                timeZone={context.timezone}
              />
            ))}
          </PanelRows>
        )}
      </ListPanel>
    </PageBody>
  );
}

/**
 * One task.
 *
 * A task filed under a Request opens that Request — the row is a pointer to
 * where the work is, which is the other half of listing it here. One filed
 * under nothing has no screen of its own in the portal (SRS 13.2.3), so it
 * opens nothing rather than returning to the list it is already in.
 */
function TaskRow({
  task,
  here,
  canTick,
  timeZone,
}: {
  task: PortalTask;
  here: string;
  canTick: boolean;
  timeZone: string;
}) {
  const done = task.status === "completed";
  const due = dueFor(task, timeZone);

  return (
    <PanelRow
      dim={done}
      href={task.requestId ? `/client-portal/requests/${task.requestId}` : undefined}
      when={
        // A finished task says when it was finished, not when the row was last
        // touched — see PortalTask.completedAt.
        done && task.completedAt ? relativeTime(task.completedAt) : relativeTime(task.updatedAt)
      }
      /* The client's own tick (client-portal/020). View-only members see the
         row and not the control, the same way every other write in the portal
         is hidden from them — `setTaskDone` refuses it again server-side. */
      trailing={canTick ? <TaskDoneButton taskId={task.id} done={done} returnTo={here} /> : undefined}
    >
      <PanelBody>
        <PanelTitle strike={done}>{task.title}</PanelTitle>

        {/* Where the work lives, first — the one fact this screen added when
            it started carrying a Request's tasks as well as the loose ones. */}
        <PanelMeta>
          {task.requestTitle ?? "Not under a request"}
          {task.nextAction ? ` · ${task.nextAction}` : ""}
          {task.waitingOn ? ` · Waiting on ${task.waitingOn}` : ""}
        </PanelMeta>

        <PanelTags>
          <StatusPill status={TASK_STATUS[task.status]} />
          {due ? <Pill tone={due === "Overdue" ? "danger" : "neutral"}>{due}</Pill> : null}
        </PanelTags>
      </PanelBody>
    </PanelRow>
  );
}

type DueGroup = { key: string; label: string; rows: PortalTask[] };

/**
 * The rows filed under when they are owed, soonest first, and undated last.
 *
 * An empty band is dropped rather than drawn: a heading over nothing is a
 * heading that says the screen failed to load what was under it.
 */
function groupByDue(tasks: PortalTask[], timeZone: string): DueGroup[] {
  const now = new Date();
  const bands: DueGroup[] = [
    { key: "overdue", label: "Overdue", rows: [] },
    { key: "today", label: "Due today", rows: [] },
    { key: "week", label: "This week", rows: [] },
    { key: "later", label: "Later", rows: [] },
    { key: "none", label: "No date", rows: [] },
  ];

  for (const task of tasks) {
    const days = daysUntil(task.dueAt, now, timeZone);
    const band =
      days === null ? 4 : days < 0 ? 0 : days === 0 ? 1 : days <= 6 ? 2 : 3;
    bands[band]!.rows.push(task);
  }

  for (const band of bands) {
    band.rows.sort((a, b) => {
      // Inside a band the dates are close together, so the undated ones sort
      // by when they last moved rather than sitting at an arbitrary end.
      if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  return bands.filter((band) => band.rows.length > 0);
}

/** A completed task's due date is history, so it stops being reported as one. */
function dueFor(task: PortalTask, timeZone: string): string | null {
  if (task.status === "completed") return null;
  return dueLabel(task.dueAt, new Date(), timeZone);
}

function emptyTitle(tab: TaskStatus): string {
  if (tab === "completed") return "Nothing finished yet";
  if (tab === "waiting") return "Nothing waiting";
  return "No tasks right now";
}

function emptyBody(tab: TaskStatus): string {
  if (tab === "completed") {
    return "Tasks your team marks done will be kept here.";
  }
  if (tab === "waiting") {
    return "A task your team has paused, or that is waiting on somebody else, will appear here.";
  }
  return "When your team shares a piece of work with you, it will appear here — whether or not it belongs to a request.";
}

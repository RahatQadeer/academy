import { Fragment } from "react";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import Link from "next/link";
import {
  KANBAN_GROUPS,
  KANBAN_SORTS,
  kanbanLanes,
  laneOf,
  type KanbanGroup,
  type KanbanSort,
} from "@/whitbyos/lib/kanban";
import { DragTask, DropColumn } from "@/whitbyos/work-plans/[id]/components/DragTasks";
import {
  buildTimeline,
  TIMELINE_SCALES,
  type TimelineModel,
  type TimelineRow,
  type TimelineScale,
  type TimelineTask,
} from "@/whitbyos/lib/timeline";
import { Pill } from "@/base/components/Pill";
import { shortDate } from "@/whitbyos/lib/format";
import { workstreamStatusLabel } from "@/whitbyos/lib/workstream-status";
import type {
  PlanTask,
  PlanWorkstream,
  StreamProvider,
  WorkPlanDetail,
} from "@/whitbyos/lib/work-plans";

export type PlanView = "list" | "table" | "grid" | "kanban" | "timeline" | "charts";

export const PLAN_VIEWS: { slug: PlanView; label: string }[] = [
  { slug: "list", label: "List" },
  { slug: "table", label: "Table" },
  { slug: "grid", label: "Grid" },
  { slug: "kanban", label: "Kanban" },
  { slug: "timeline", label: "Timeline" },
  { slug: "charts", label: "Charts" },
];

const DONE = new Set(["complete", "completed", "done"]);

/** WP.17c–e's view strip. */
/**
 * WP.17's view switch: soft pills, not the underlined tabs the rest of the app
 * uses. The reference draws it that way here because it sits between the
 * plan's own header and the Work Streams heading — an underline there would
 * read as a second title bar.
 */
export function ViewSwitch({ basePath, active }: { basePath: string; active: PlanView }) {
  return (
    <div
      className="pa-plan-view-switch inline-flex max-w-full flex-wrap gap-0.5 rounded-[11px] p-[3px]"
      role="tablist"
      aria-label="Plan views"
      style={{
        background: "color-mix(in srgb, var(--chrome) 88%, #dfe7ef)",
        border: "1px solid color-mix(in srgb, var(--line) 70%, #d5dde6)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)",
      }}
    >
      {PLAN_VIEWS.map((view) => {
        const on = view.slug === active;
        return (
          <Link
            key={view.slug}
            href={view.slug === "list" ? basePath : `${basePath}?view=${view.slug}`}
            /*
             * The page does not jump to the top to change how it is drawn.
             *
             * Switching List to Kanban is one screen becoming another screen
             * of the same thing, and the strip that switches them is halfway
             * down a long page: every press sent the reader back to the
             * plan's title and left them to scroll down to see what they had
             * asked for.
             */
            scroll={false}
            role="tab"
            aria-selected={on}
            className="rounded-[8px] px-2.5 py-[7px] text-[12px] font-medium no-underline transition-[background-color,color,box-shadow] duration-150 sm:px-3.5 sm:text-[12.5px]"
            style={
              on
                ? {
                    background: "#ffffff",
                    color: "var(--accent)",
                    fontWeight: 600,
                    boxShadow:
                      "0 1px 2px rgba(15,15,15,.06), 0 0 0 1px rgba(35,131,226,.14)",
                  }
                : { color: "var(--text-secondary)" }
            }
          >
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}

function done(stream: PlanWorkstream) {
  return stream.tasks.filter((task) => DONE.has(task.status.toLowerCase())).length;
}

/**
 * The span a Work Stream's dated work covers, in weeks.
 *
 * From its own tasks' due dates — the same span the Timeline lays out. It is
 * not a start date, which a stream does not carry, but it is what "8 wks" on
 * WP.17c means: how much of the calendar this stream reaches across.
 */
function spanWeeks(stream: PlanWorkstream) {
  const dates = stream.tasks
    .map((task) => task.due_date)
    .filter((date): date is string => Boolean(date))
    .map((date) => new Date(date).getTime());

  if (dates.length < 2) return null;

  const weeks = (Math.max(...dates) - Math.min(...dates)) / (7 * 86_400_000);
  return weeks < 1 ? "<1 wk" : `${Math.round(weeks)} wk${Math.round(weeks) === 1 ? "" : "s"}`;
}

function percent(stream: PlanWorkstream) {
  if (stream.tasks.length === 0) return DONE.has(stream.status.toLowerCase()) ? 100 : 0;
  return Math.round((done(stream) / stream.tasks.length) * 100);
}

/**
 * WP.17c — every Work Stream as a card.
 *
 * The card leads with a ring rather than a bar, which is the reference's own
 * choice and the right one here: a grid is read by glancing across it, and a
 * ring's fill is legible at a glance where a 4px bar's is not.
 *
 * The reference also draws a small trend beside it and a duration ("8 wks").
 * Neither is here: a per-stream trend needs its completions loaded for every
 * card on the screen, and the duration needs a start date a Work Stream does
 * not carry.
 */
export function GridView({
  plan,
  basePath,
  trends,
  providers,
  clientView,
}: {
  plan: WorkPlanDetail;
  basePath: string;
  /** Cumulative completions per stream, from one query for the whole grid. */
  trends: Map<string, number[]>;
  /** WP.17c names the firm doing each stream, where one has been brought in. */
  providers: Map<string, StreamProvider[]>;
  /**
   * Drawn in the Client Portal (client-portal/014): read-only, and without the
   * fields the portal is not sent — priority, checklists, dependencies,
   * providers. Nothing changes for Whitby when it is absent.
   */
  clientView?: boolean;
}) {
  if (plan.workstreams.length === 0) {
    return (
      <div
        className="rounded-card border border-line px-4 py-10 text-center text-[13px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        No Work Streams on this plan yet.
      </div>
    );
  }

  /* A card here is a Work Stream, so what a drag moves is the stream, and
     the plan reads them in that order everywhere afterwards. The portal's
     copy has nothing to drag. */
  const grid = "grid gap-4 lg:grid-cols-2";

  const Grid = ({ children }: { children: React.ReactNode }) =>
    clientView ? (
      <div className={grid}>{children}</div>
    ) : (
      <DropColumn planId={plan.id} kind="stream" className={grid}>
        {children}
      </DropColumn>
    );

  return (
    <Grid>
      {plan.workstreams.map((stream, index) => {
        const share = percent(stream);
        const finished = DONE.has(stream.status.toLowerCase());
        const ink = stream.blocked
          ? "var(--danger-text)"
          : finished
            ? "var(--success-fg)"
            : stream.status === "not_started"
              ? "var(--border-strong)"
              : "var(--accent)";

        const owners = [
          ...new Map(
            stream.tasks
              .filter((task) => task.ownerInitials)
              .map((task) => [task.ownerInitials as string, task]),
          ).values(),
        ].slice(0, 3);

        const card = (
          <div
            className="flex flex-col overflow-hidden rounded-[12px] border border-line"
          >
            <div className="h-[3px]" style={{ background: ink }} aria-hidden />

            <div className="flex flex-col gap-3 px-[18px] py-4">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold"
                  style={
                    finished
                      ? { background: "var(--success-bg)", color: "var(--success-fg)" }
                      : { background: "var(--accent-tint)", color: "var(--accent)" }
                  }
                >
                  {index + 1}
                </span>

                <Link
                  href={`${basePath}/streams/${stream.id}`}
                  className="min-w-0 flex-1 truncate text-[14.5px] font-semibold no-underline"
                  style={{ color: "var(--ink)" }}
                >
                  {stream.name}
                </Link>

                <Pill
                  tone={
                    stream.blocked
                      ? "danger"
                      : finished
                        ? "success"
                        : stream.status === "not_started"
                          ? "neutral"
                          : "info"
                  }
                >
                  {workstreamStatusLabel(stream.status, stream.blocked)}
                </Pill>

                {/* WP.17c draws the same ⋯ on a Grid card as WP.17 draws on a
                    list row, so it opens the same thing: WP.17u. */}
                {clientView ? null : (
                  <Link
                    href={`${basePath}?visibility=stream&vstream=${stream.id}`}
                    scroll={false}
                    aria-label={`Visibility for ${stream.name}`}
                    title={`Visibility for ${stream.name}`}
                    className="shrink-0 text-[13px] no-underline"
                    style={{ color: "rgba(55,53,47,.3)" }}
                  >
                    ⋯
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-3.5">
                <Ring percent={share} ink={ink} />

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {/* One chip per state rather than one count. "2 done · 1
                      running · 1 blocked · 1 planned" is what the card is read
                      for; "2 of 5 done" leaves out where the other three are. */}
                  <span className="flex flex-wrap gap-1">
                    {streamChips(stream).map((chip) => (
                      <span
                        key={chip.label}
                        className="inline-flex whitespace-nowrap rounded px-[7px] py-0.5 text-[10.5px] font-medium"
                        style={{ background: chip.bg, color: chip.fg }}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </span>

                  {/* The reference marks a milestone with its date — "◈ Visa
                      issued, Apr 12". An approval is the milestone this schema
                      has; failing that it is the next thing due, which is the
                      same question asked of a stream with none. */}
                  <span
                    className="truncate text-[11.5px]"
                    style={{ color: "rgba(55,53,47,.55)" }}
                    title={milestoneOf(stream)?.title}
                  >
                    ◈ {milestoneLabel(stream)}
                  </span>

                  {owners.length > 0 ? (
                    <span className="flex items-center gap-[7px]">
                      <span className="flex">
                        {owners.map((task, place) => (
                          <span
                            key={task.id}
                            style={{ marginLeft: place === 0 ? undefined : -6 }}
                          >
                            <OwnerAvatar
                              name={task.ownerName}
                              initials={task.ownerInitials}
                              userId={task.ownerUserId}
            hasPhoto={task.ownerHasPhoto}
                              ring
                            />
                          </span>
                        ))}
                      </span>
                      <span
                        className="truncate text-[11.5px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {owners
                          .map((task) => (task.ownerName ?? "").split(" ")[0])
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  ) : null}
                </div>

                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Spark series={trends.get(stream.id) ?? []} ink={ink} />
                  {spanWeeks(stream) ? (
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-disabled)" }}
                      title="How much of the calendar this stream's dated work covers"
                    >
                      {spanWeeks(stream)}
                    </span>
                  ) : null}
                </span>
              </div>

              <div
                className="flex items-center gap-2.5 whitespace-nowrap border-t pt-[11px] text-[11.5px]"
                style={{ borderColor: "var(--surface-subtle)", color: "var(--text-tertiary)" }}
              >
                <span>{dueLabel(stream)}</span>
                <span style={{ color: "var(--border-dashed)" }}>·</span>
                {/* The firm doing this piece, where one has been brought in;
                    otherwise how much work is in it, which is the other thing
                    a footer gets read for. */}
                <span className="min-w-0 truncate">
                  {providers.get(stream.id)?.length
                    ? providers
                        .get(stream.id)!
                        .map((provider) => provider.name)
                        .join(", ")
                    : `${stream.tasks.length} task${stream.tasks.length === 1 ? "" : "s"}`}
                </span>

                {riskOf(stream) ? (
                  <span className="ml-auto shrink-0">
                    <Pill tone={riskOf(stream)!.tone}>{riskOf(stream)!.label}</Pill>
                  </span>
                ) : (
                  <Link
                    href={`${basePath}/streams/${stream.id}`}
                    className="ml-auto shrink-0 no-underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Open ↗
                  </Link>
                )}
              </div>
            </div>
          </div>
        );

        return clientView ? (
          <div key={stream.id}>{card}</div>
        ) : (
          <DragTask key={stream.id} id={stream.id}>
            {card}
          </DragTask>
        );
      })}
    </Grid>
  );
}

/**
 * WP.17c's chips: one per state a stream's tasks are in.
 *
 * Only the states that are actually there. A stream with nothing blocked does
 * not carry a "0 blocked" chip — an absence is said by not saying it.
 */
function streamChips(stream: PlanWorkstream) {
  const counts = { done: 0, running: 0, blocked: 0, planned: 0 };

  for (const task of stream.tasks) {
    const lane = laneOf(task.status);
    if (lane === "complete") counts.done += 1;
    else if (lane === "in_progress") counts.running += 1;
    else if (lane === "waiting") counts.blocked += 1;
    else counts.planned += 1;
  }

  const chips: Array<{ label: string; bg: string; fg: string }> = [];
  if (counts.done > 0)
    chips.push({ label: `${counts.done} done`, bg: "#e3ecdf", fg: "#2f5233" });
  if (counts.running > 0)
    chips.push({ label: `${counts.running} running`, bg: "var(--accent-tint)", fg: "var(--info-fg)" });
  if (counts.blocked > 0)
    chips.push({ label: `${counts.blocked} blocked`, bg: "var(--warning-bg)", fg: "var(--warning-fg)" });
  if (counts.planned > 0)
    chips.push({ label: `${counts.planned} planned`, bg: "var(--canvas)", fg: "var(--text-muted)" });

  return chips;
}

/**
 * The stream's milestone — the point its work stops at until somebody decides.
 *
 * An approval, where it has one. Otherwise the next dated thing due, which is
 * the same question asked of a stream that has no approval in it.
 */
function milestoneOf(stream: PlanWorkstream) {
  const open = stream.tasks.filter((task) => laneOf(task.status) !== "complete");
  const approval = open.find((task) => task.kind === "approval");
  if (approval) return approval;

  return (
    open
      .filter((task) => task.due_date)
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0] ?? open[0] ?? null
  );
}

function milestoneLabel(stream: PlanWorkstream) {
  const task = milestoneOf(stream);
  if (!task) return "Nothing left open";
  return task.due_date ? `${task.title}, ${shortDate(task.due_date)}` : task.title;
}

/** The date this stream's work runs to, which is its last dated task. */
function dueLabel(stream: PlanWorkstream) {
  const dates = stream.tasks
    .map((task) => task.due_date)
    .filter((date): date is string => Boolean(date))
    .sort();

  return dates.length > 0 ? `Due ${shortDate(dates[dates.length - 1]!)}` : "No dates yet";
}

/**
 * The pill the footer ends on, where there is something to say.
 *
 * Blocked before late, because a blocked stream is late for a reason somebody
 * already knows about.
 */
function riskOf(stream: PlanWorkstream): { label: string; tone: "danger" | "warning" } | null {
  if (stream.blocked) return { label: "Blocked", tone: "danger" };

  const now = Date.now();
  const late = stream.tasks.filter(
    (task) =>
      laneOf(task.status) !== "complete" &&
      task.due_date &&
      new Date(task.due_date).getTime() < now,
  ).length;

  if (late > 0) return { label: "Overdue", tone: "danger" };
  if (stream.tasks.some((task) => laneOf(task.status) === "waiting"))
    return { label: "At risk", tone: "warning" };

  return null;
}

/**
 * The small line beside the ring — how this stream got to where it is.
 *
 * Drawn only where there is something to draw: a stream with nothing finished,
 * or everything finished at once, has no shape to show and gets nothing rather
 * than a flat line pretending to be progress.
 */
function Spark({ series, ink }: { series: number[]; ink: string }) {
  const peak = Math.max(...series, 0);
  if (series.length < 2 || peak === 0) return null;

  const width = 72;
  const height = 26;
  const step = width / (series.length - 1);
  const points = series.map((value, index) => ({
    x: index * step,
    y: height - 2 - (value / peak) * (height - 6),
  }));

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      role="img"
      aria-label={`${peak} completed over this stream's run`}
    >
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={ink} opacity="0.12" />
      <path d={line} fill="none" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** The 68px ring WP.17c leads each card with. */
function Ring({ percent, ink }: { percent: number; ink: string }) {
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0" role="img" aria-label={`${percent}% complete`}>
      <circle cx="34" cy="34" r={radius} fill="none" stroke="var(--canvas)" strokeWidth="7" />
      <circle
        cx="34"
        cy="34"
        r={radius}
        fill="none"
        stroke={ink}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="38" fontSize="13" fontWeight="700" fill="var(--ink)" textAnchor="middle">
        {percent}%
      </text>
    </svg>
  );
}

/**
 * WP.17d — every task by status, which is the only column a task always has.
 *
 * The board carries a summary line: how much is in flight, how much is late,
 * how much is stuck. That is the question a board is opened to answer, and
 * counting the columns by eye is a poor way to answer it.
 */
export function KanbanView({
  plan,
  basePath,
  group,
  sort,
  clientView,
}: {
  plan: WorkPlanDetail;
  basePath: string;
  group: KanbanGroup;
  sort: KanbanSort;
  /**
   * Drawn in the Client Portal (client-portal/014): read-only, and without the
   * fields the portal is not sent — priority, checklists, dependencies,
   * providers. Nothing changes for Whitby when it is absent.
   */
  clientView?: boolean;
}) {
  const all = plan.workstreams.flatMap((stream) =>
    stream.tasks.map((task) => ({ ...task, streamName: stream.name, streamId: stream.id })),
  );

  const now = Date.now();
  const lanes = kanbanLanes(all, group, sort);

  const running = all.filter((task) => laneOf(task.status) === "in_progress").length;
  const overdue = all.filter(
    (task) =>
      laneOf(task.status) !== "complete" &&
      task.due_date &&
      new Date(task.due_date).getTime() < now,
  ).length;
  const blocked = all.filter(
    (task) => task.blockedByStreamId !== null || task.blockedByTaskId !== null,
  ).length;

  // Everyone carrying work on this plan, deduplicated — WP.17d's facepile.
  const people = [
    ...new Map(
      all
        .filter((task) => task.ownerInitials)
        .map((task) => [
          task.ownerInitials!,
          {
            name: task.ownerName ?? task.ownerInitials!,
            id: task.ownerUserId,
            hasPhoto: task.ownerHasPhoto,
          },
        ]),
    ),
  ];

  const href = (next: Record<string, string | null>) => {
    const query = new URLSearchParams({ view: "kanban" });
    const g = "group" in next ? next.group : group;
    const so = "sort" in next ? next.sort : sort;
    if (g && g !== "status") query.set("kgroup", g);
    if (so && so !== "due") query.set("ksort", so);
    return `${basePath}?${query.toString()}`;
  };

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Chooser
          label="Group by"
          value={KANBAN_GROUPS.find((row) => row.value === group)!.label}
          options={KANBAN_GROUPS.map((row) => ({
            label: row.label,
            href: href({ group: row.value }),
            on: row.value === group,
          }))}
        />

        <Chooser
          label="↕"
          value={KANBAN_SORTS.find((row) => row.value === sort)!.label}
          // A board with no priorities on it has nothing to sort by one.
          options={KANBAN_SORTS.filter((row) => !clientView || row.value !== "priority").map((row) => ({
            label: row.label,
            href: href({ sort: row.value }),
            on: row.value === sort,
          }))}
        />

        {people.length > 0 ? (
          <span
            className="ml-1 flex items-center"
            title={people.map(([, person]) => person.name).join(", ")}
          >
            {people.slice(0, 5).map(([initials, person], index) => (
              <span key={initials} style={{ marginLeft: index === 0 ? 0 : -6 }}>
                <OwnerAvatar
                  name={person.name}
                  initials={initials}
                  userId={person.id}
                  hasPhoto={person.hasPhoto}
                  ring
                />
              </span>
            ))}
          </span>
        ) : null}

        <span
          className="ml-auto flex flex-wrap items-center gap-3.5 text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {/* The reference reads "WIP 4 / 6" against a limit somebody set. No
              table holds one, so this counts what is in flight out of the whole
              plan, the same shape, without the invented ceiling. */}
          <span>
            In flight{" "}
            <b className="font-semibold" style={{ color: "var(--ink)" }}>
              {running}
            </b>{" "}
            / {all.length}
          </span>
          {overdue > 0 ? <span style={{ color: "var(--danger-fg)" }}>{overdue} overdue</span> : null}
          {blocked > 0 ? (
            <span style={{ color: "var(--avatar-tan-fg)" }}>{blocked} blocked</span>
          ) : null}
        </span>
      </div>

      {/* items-start, so each column is as tall as what is in it. Stretched to
          match the fullest one, an empty lane became a column of nothing the
          height of twelve cards. */}
      <div className="flex items-start gap-4 overflow-x-auto pb-1">
        {lanes.map((lane) => {
          const share = all.length === 0 ? 0 : Math.round((lane.tasks.length / all.length) * 100);

          return (
            <div
              key={lane.key}
              className="flex w-[272px] shrink-0 flex-col rounded-[10px] border p-2.5"
              style={{ background: "var(--surface-subtle)", borderColor: "var(--canvas)" }}
            >
              <div className="flex items-center gap-[7px] px-0.5 pb-2.5 pt-0.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: lane.ink }}
                  aria-hidden
                />
                <span className="min-w-0 truncate text-[12.5px] font-semibold">{lane.label}</span>
                <span
                  className="shrink-0 rounded-[9px] px-[7px] py-px text-[10.5px] font-semibold"
                  style={{ background: "var(--surface-active)", color: "var(--text-tertiary)" }}
                >
                  {lane.tasks.length}
                </span>
                {clientView ? null : (
                  <Link
                    href={lane.addHref ?? `${basePath}?task=new`}
                    scroll={false}
                    aria-label={`Add a task to ${lane.label}`}
                    title={`Add a task to ${lane.label}`}
                    className="ml-auto shrink-0 text-[13px] no-underline"
                    style={{ color: "var(--text-disabled)" }}
                  >
                    +
                  </Link>
                )}
              </div>

              <div
                className="mb-[11px] h-[3px] overflow-hidden rounded-[2px]"
                style={{ background: "var(--surface-active)" }}
              >
                <div className="h-full" style={{ width: `${share}%`, background: lane.ink }} />
              </div>

              {/* The column is where a card is let go: what that means is
                  what the board is grouped by. Read-only in the portal, which
                  has nothing to drop. */}
              <DropColumn
                planId={plan.id}
                group={clientView ? null : group}
                lane={clientView ? null : group === "owner" ? (lane.ownerUserId ?? "") : lane.key}
                className="flex min-h-[64px] flex-col gap-[9px]"
              >
                {lane.tasks.length === 0 ? (
                  <div
                    className="rounded-[8px] border border-dashed px-3 py-6 text-center text-[12px]"
                    style={{ borderColor: "var(--border)", color: "var(--text-disabled)" }}
                  >
                    Nothing here
                  </div>
                ) : (
                  <>
                    {lane.tasks.slice(0, KANBAN_CARDS).map((task) =>
                      clientView ? (
                        <Card
                          key={task.id}
                          task={task}
                          ink={lane.ink}
                          basePath={basePath}
                          clientView={clientView}
                        />
                      ) : (
                        <DragTask key={task.id} id={task.id}>
                          <Card
                            task={task}
                            ink={lane.ink}
                            basePath={basePath}
                            clientView={clientView}
                          />
                        </DragTask>
                      ),
                    )}
                    {lane.tasks.length > KANBAN_CARDS ? (
                      <Link
                        href={`${basePath}?view=table&filter=open`}
                        className="rounded-[8px] border border-dashed py-2 text-center text-[11.5px] no-underline"
                        style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
                      >
                        + {lane.tasks.length - KANBAN_CARDS} more
                      </Link>
                    ) : null}
                  </>
                )}
              </DropColumn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** How many cards a lane shows before it offers the rest in the Table. */
const KANBAN_CARDS = 6;

/**
 * WP.17d's "Group by" and sort controls.
 *
 * A details/summary rather than a script: it opens on click, closes on Escape,
 * and each choice is an ordinary link, so the whole thing survives without a
 * client component.
 */
function Chooser({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; href: string; on: boolean }>;
}) {
  return (
    <details className="relative">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[6px] border px-2.5 py-[5px] text-[11.5px]"
        style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
      >
        {label}{" "}
        <b className="font-semibold" style={{ color: "var(--ink)" }}>
          {value}
        </b>
        <span className="text-[8px]" style={{ color: "var(--text-faint)" }} aria-hidden>
          ▾
        </span>
      </summary>
      <div
        className="absolute left-0 top-full z-30 mt-1 w-[180px] overflow-hidden rounded-[8px] border border-line bg-surface"
        style={{ boxShadow: "0 6px 20px rgba(15,15,15,.10)" }}
      >
        {options.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            scroll={false}
            className="block px-3 py-2 text-[12.5px] no-underline hover:bg-[var(--surface-soft)]"
            style={{ color: option.on ? "var(--accent)" : "var(--ink)" }}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

/**
 * One task, as WP.17d draws it.
 *
 * Everything on the card comes off the task: its stream, its priority, when it
 * is due and how that reads today, how much of its checklist is ticked, and
 * who owns it. The reference also counts messages against a card and names a
 * provider; neither is attached to a task in this schema, so neither is here.
 */
function Card({
  task,
  ink,
  basePath,
  clientView,
}: {
  task: PlanTask & { streamName: string };
  ink: string;
  basePath: string;
  clientView?: boolean;
}) {
  const done = DONE.has(task.status.toLowerCase());
  const due = task.due_date ? new Date(task.due_date) : null;
  const days = due ? Math.round((due.getTime() - Date.now()) / 86_400_000) : null;
  const late = !done && days !== null && days < 0;
  const blocked = task.blockedByStreamId !== null || task.blockedByTaskId !== null;

  const steps = task.checklist ?? [];
  const ticked = steps.filter((item) => item.done).length;
  const share = done ? 100 : steps.length > 0 ? Math.round((ticked / steps.length) * 100) : 0;

  const flag = late
    ? { label: "Overdue", bg: "var(--danger-bg)", fg: "var(--danger-fg)" }
    : blocked && !done
      ? { label: "Blocked", bg: "var(--warning-bg)", fg: "var(--warning-fg)" }
      : task.kind === "approval" && !done
        ? { label: "Approval", bg: "var(--accent-tint)", fg: "var(--accent)" }
        : null;

  const cardClass =
    "flex flex-col gap-2 rounded-[8px] border bg-surface px-3 py-[11px] no-underline";
  const cardStyle = {
    borderColor: "var(--border)",
    borderLeft: `3px solid ${ink}`,
    boxShadow: "0 1px 2px rgba(15,15,15,.05)",
    color: "var(--ink)",
  };

  const content = (
    <>
      <span className="flex items-start gap-2">
        {/* Two lines. The reference's own tasks are short enough never to need
            a third; Whitby writes whole sentences, and a card that grows to fit
            one stops being a card. The title is in full on the task itself. */}
        <span
          className="line-clamp-2 flex-1 text-[12.5px] font-semibold leading-[1.35]"
          title={task.title}
        >
          {task.title}
        </span>
        {flag ? (
          <span
            className="shrink-0 whitespace-nowrap rounded px-[7px] py-0.5 text-[10.5px] font-medium"
            style={{ background: flag.bg, color: flag.fg }}
          >
            {flag.label}
          </span>
        ) : null}
      </span>

      {/* One row, always. The reference's Work Streams are named "Housing
          Search"; these are named "Verdict: Group Decision Maker", and a pill
          that wraps takes the priority down with it and makes the card a line
          taller for nothing. The name gives way; the priority does not. */}
      <span className="flex items-center gap-[5px]">
        <span
          className="inline-flex min-w-0 items-center gap-1 rounded px-[7px] py-0.5 text-[10.5px] font-medium"
          style={{ background: "var(--accent-tint)", color: "var(--info-fg)" }}
          title={task.streamName}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "var(--info-fg)" }}
            aria-hidden
          />
          <span className="truncate">{task.streamName}</span>
        </span>

        {task.priority ? (
          <span
            className="shrink-0 whitespace-nowrap rounded px-[7px] py-0.5 text-[10.5px] font-medium"
            style={priorityInk(task.priority)}
          >
            {PRIORITY_LABEL[task.priority.toLowerCase()] ?? task.priority}
          </span>
        ) : null}
      </span>

      <span
        className="flex items-center gap-1.5 text-[11px]"
        style={{ color: late ? "var(--danger-fg)" : "rgba(55,53,47,.55)" }}
      >
        <span className="text-[10px]" aria-hidden>
          ◷
        </span>
        <span className="min-w-0 flex-1 truncate">
        {done && task.completed_at
          ? `Done ${shortDate(task.completed_at)}`
          : task.waiting_state
            ? `Waiting on ${task.waiting_state}`
            : due
              ? `${late ? "Overdue" : "Due"} ${shortDate(task.due_date)}${
                  days === null
                    ? ""
                    : ` · ${days < 0 ? `${Math.abs(days)}d` : days === 0 ? "today" : `in ${days}d`}`
                }`
              : "No date"}
        </span>

        {/* The footer under it is a rule with counts on one side and the owner
            on the other. With no checklist there are no counts, so the rule
            would divide a line of nothing from a line of one avatar, the
            avatar comes up here instead and the card loses a whole row. */}
        {steps.length === 0 ? (
          <OwnerAvatar
            name={task.ownerName}
            initials={task.ownerInitials}
            userId={task.ownerUserId}
            hasPhoto={task.ownerHasPhoto}
          />
        ) : null}
      </span>

      {/* Only where there is something to measure. A task with no checklist
          has no progress to show, and an empty rail is a line of nothing. */}
      {steps.length > 0 ? (
        <span className="flex items-center gap-[7px]">
          <span
            className="h-1 flex-1 overflow-hidden rounded-[2px]"
            style={{ background: "var(--canvas)" }}
          >
            <span className="block h-full" style={{ width: `${share}%`, background: ink }} />
          </span>
          <span className="shrink-0 text-[10px]" style={{ color: "var(--text-faint)" }}>
            {ticked}/{steps.length}
          </span>
        </span>
      ) : null}

      {steps.length > 0 ? (
        <span
          className="flex items-center justify-between border-t pt-[7px]"
          style={{ borderColor: "var(--surface-active)" }}
        >
          <span
            className="flex items-center gap-[9px] text-[10px]"
            style={{ color: "rgba(55,53,47,.42)" }}
          >
            <span>❐ {steps.length}</span>
          </span>

          <OwnerAvatar
            name={task.ownerName}
            initials={task.ownerInitials}
            userId={task.ownerUserId}
            hasPhoto={task.ownerHasPhoto}
            ring
          />
        </span>
      ) : null}
    </>
  );

  // The portal has no task dialog to open, so its card is not a link to one.
  return clientView ? (
    <div className={cardClass} style={cardStyle}>
      {content}
    </div>
  ) : (
    /* The task, not the form for changing it. A card opened the edit dialog,
       so the only way to read what Whitby worked out about a task was to go
       and change something — the same thing the List was fixed for. */
    <Link href={`${basePath}/tasks/${task.id}`} className={cardClass} style={cardStyle}>
      {content}
    </Link>
  );
}

const PRIORITY_LABEL: Record<string, string> = { high: "High", medium: "Med", low: "Low" };

function priorityInk(priority: string) {
  const key = priority.toLowerCase();
  if (key === "high") return { background: "var(--danger-bg)", color: "var(--danger-fg)" };
  if (key === "low") return { background: "var(--canvas)", color: "var(--text-muted)" };
  return { background: "var(--warning-bg)", color: "var(--warning-fg)" };
}

/**
 * WP.17e — Timeline.
 *
 * Drawn from the dates the tasks actually carry, which is why a stream with
 * none has no bar rather than an invented one. The months are whatever the plan
 * spans; a fixed Mar–Jun would only be right for the plan in the export.
 */
export function TimelineView({
  plan,
  basePath,
  scale,
  showDependencies,
  expanded,
  clientView,
}: {
  plan: WorkPlanDetail;
  basePath: string;
  scale: TimelineScale;
  showDependencies: boolean;
  /** Stream ids opened out into their tasks, held in the URL like every other view. */
  expanded: string[];
  /**
   * Drawn in the Client Portal (client-portal/014): read-only, and without the
   * fields the portal is not sent — priority, checklists, dependencies,
   * providers. Nothing changes for Whitby when it is absent.
   */
  clientView?: boolean;
}) {
  const model = buildTimeline(plan, scale);

  if (!model) {
    return (
      <div
        className="rounded-card border border-line px-4 py-10 text-center text-[13px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        No task has a date yet, so there is nothing to lay out in time. Add due
        dates and the Work Streams will appear here.
      </div>
    );
  }

  const { rows, columns, ticks, place, today, edges } = model;
  const open = new Set(expanded);
  const query = (next: Record<string, string | null>) =>
    timelineHref(basePath, { scale, showDependencies, expanded }, next);

  // Every row is one band, and the tasks under an opened stream are bands too,
  // so the arrows have to be told where each stream ended up.
  const bands: number[] = [];
  let cursor = 0;
  for (const row of rows) {
    bands.push(cursor);
    cursor += 1 + (open.has(row.stream.id) ? row.tasks.length : 0);
  }

  const BAND = 34;
  const height = cursor * BAND;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-[10px] border border-line">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-3.5 py-2.5">
          <div
            className="flex gap-0.5 rounded-control border p-0.5"
            style={{ borderColor: "var(--border-strong)" }}
          >
            {TIMELINE_SCALES.map((option) => (
              <Link
                key={option.value}
                href={query({ tscale: option.value })}
                scroll={false}
                className="rounded-[5px] px-2.5 py-1 text-[12px] font-medium no-underline"
                style={
                  option.value === scale
                    ? { background: "var(--ink)", color: "#fff" }
                    : { color: "var(--text-muted)" }
                }
              >
                {option.label}
              </Link>
            ))}
          </div>

          {/* Only offered when today is somewhere on the scale — a button that
              scrolls to a date the chart does not cover is a dead control. */}
          {today !== null ? (
            <a
              href="#timeline-today"
              className="rounded-control border px-2.5 py-1 text-[12px] font-medium no-underline"
              style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
            >
              Jump to today
            </a>
          ) : null}

          {clientView ? null : (
            <Link
              href={query({ deps: showDependencies ? "off" : null })}
              scroll={false}
              className="rounded-control border px-2.5 py-1 text-[12px] font-medium no-underline"
              style={{
                borderColor: "var(--border-strong)",
                color: showDependencies ? "var(--ink)" : "var(--text-tertiary)",
              }}
            >
              Show dependencies {showDependencies ? "✓" : ""}
            </Link>
          )}

          <span className="ml-auto flex flex-wrap items-center gap-3 text-[11.5px]">
            <Key ink="var(--success-fg)" label="Complete" />
            <Key ink="var(--accent)" label="In progress" />
            <Key ink="var(--canvas)" label="Planned" outlined />
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[9px]" style={{ color: "var(--ink)" }} aria-hidden>
                ◆
              </span>
              <span style={{ color: "var(--text-muted)" }}>Approval</span>
            </span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[720px] px-3.5 pb-3.5 pt-2.5">
            {/* Column heads, then one band per row over the same grid. */}
            <div className="relative flex" style={{ marginLeft: LABEL_W }}>
              {columns.map((column) => (
                <span
                  key={column.at}
                  className="text-[10.5px] font-semibold tracking-[0.04em]"
                  style={{
                    width: `${place(column.until) - place(column.at)}%`,
                    color: "var(--text-tertiary)",
                  }}
                >
                  {column.label}
                </span>
              ))}
            </div>

            <div className="relative mt-1.5" style={{ height }}>
              {/* Two weights of rule, as the reference draws them: the column
                  boundaries at the palette's border, and the weeks inside a
                  month a shade lighter so they read as a measure and not as a
                  division. */}
              <div className="absolute inset-0" style={{ marginLeft: LABEL_W }}>
                {ticks.map((tick) => (
                  <span
                    key={`tick-${tick.at}`}
                    className="absolute top-0 h-full"
                    style={{ left: `${place(tick.at)}%`, borderLeft: "1px solid #f6f6f4" }}
                  />
                ))}
                {columns.map((column, index) =>
                  index === 0 ? null : (
                    <span
                      key={column.at}
                      className="absolute top-0 h-full"
                      style={{ left: `${place(column.at)}%`, borderLeft: "1px solid var(--border)" }}
                    />
                  ),
                )}
              </div>

              {today !== null ? (
                <span
                  id="timeline-today"
                  className="absolute top-0 z-[3] h-full"
                  style={{
                    left: `calc(${LABEL_W}px + ${today}% * (100% - ${LABEL_W}px) / 100%)`,
                    borderLeft: "1.5px dashed var(--danger-text)",
                  }}
                >
                  <span
                    className="absolute -top-0.5 left-1 whitespace-nowrap rounded-[4px] px-1.5 py-px text-[10px] font-semibold text-white"
                    style={{ background: "var(--danger-text)" }}
                  >
                    Today
                  </span>
                </span>
              ) : null}

              {showDependencies && edges.length > 0 ? (
                <svg
                  className="pointer-events-none absolute inset-0 z-[2]"
                  style={{ marginLeft: LABEL_W }}
                  width="100%"
                  height={height}
                  aria-hidden
                >
                  {edges.map((edge) => {
                    const y = (band: number) => band * BAND + BAND / 2;
                    return (
                      <g key={`${edge.fromRow}-${edge.toRow}`}>
                        <line
                          x1={`${place(edge.at)}%`}
                          y1={y(bands[edge.fromRow]!)}
                          x2={`${place(edge.at)}%`}
                          y2={y(bands[edge.toRow]!)}
                          stroke="var(--border-strong)"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1={`${place(edge.at)}%`}
                          y1={y(bands[edge.toRow]!)}
                          x2={`${place(edge.until)}%`}
                          y2={y(bands[edge.toRow]!)}
                          stroke="var(--border-strong)"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                      </g>
                    );
                  })}
                </svg>
              ) : null}

              <div className="relative z-[4]">
                {rows.map((row) => (
                  <Fragment key={row.stream.id}>
                    <StreamBand
                      row={row}
                      place={place}
                      href={query({
                        open: open.has(row.stream.id)
                          ? expanded.filter((id) => id !== row.stream.id).join(",") || null
                          : [...expanded, row.stream.id].join(","),
                      })}
                      openNow={open.has(row.stream.id)}
                      band={BAND}
                    />
                    {open.has(row.stream.id)
                      ? row.tasks.map((task) => (
                          <TaskBand key={task.task.id} row={task} place={place} band={BAND} />
                        ))
                      : null}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <TimelineSummary model={model} clientView={clientView} />
    </div>
  );
}

/**
 * How wide a stream's bar is drawn, in percent.
 *
 * A stream whose dated work falls on one day still has to be visible, so it
 * gets a floor — which means the drawn bar can run past its own last date, and
 * anything set beside it has to be set against this rather than against the
 * date.
 */
function barWidth(place: (value: number) => number, from: number, to: number) {
  return Math.max(place(to) - place(from), 2.5);
}

/**
 * The width of the name column, shared by the heads, the grid and the bands.
 *
 * Wide enough for a real Work Stream name and its count without truncating —
 * "Housing & Property Search" is what the plan calls it, and "Housing &
 * Proper…" is not a name anybody can act on.
 */
const LABEL_W = 316;

/**
 * One Work Stream: its name, how much of it is done, and the span its dated
 * work covers.
 */
function StreamBand({
  row,
  place,
  href,
  openNow,
  band,
}: {
  row: TimelineRow;
  place: (value: number) => number;
  href: string;
  openNow: boolean;
  band: number;
}) {
  const ink = DONE.has(row.stream.status.toLowerCase())
    ? "var(--success-fg)"
    : row.stream.status === "not_started"
      ? "var(--surface)"
      : "var(--accent)";

  return (
    <div className="flex items-center" style={{ height: band }}>
      <Link
        href={href}
        scroll={false}
        className="flex shrink-0 items-center gap-2 pr-3 no-underline"
        style={{ width: LABEL_W, color: "var(--ink)" }}
      >
        <span
          className="w-2.5 shrink-0 text-[10px]"
          style={{ color: "var(--text-tertiary)" }}
          aria-hidden
        >
          {openNow ? "▾" : "▸"}
        </span>
        <span
          className="h-2 w-2 shrink-0 rounded-[2px]"
          style={{ background: ink, border: ink === "var(--surface)" ? "1px solid var(--border-strong)" : undefined }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={row.stream.name}>
          {row.stream.name}
        </span>
        <span
          className="w-[74px] shrink-0 text-right text-[11.5px] tabular-nums"
          style={{ color: "var(--text-tertiary)" }}
        >
          {row.done}/{row.total} · {row.percent}%
        </span>
      </Link>

      <span className="relative h-full flex-1">
        {row.from !== null && row.to !== null ? (
          <>
            <span
              className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[2px]"
              style={{
                left: `${place(row.from)}%`,
                width: `${barWidth(place, row.from, row.to)}%`,
                background: ink,
                border: ink === "var(--surface)" ? "1px solid var(--border-strong)" : undefined,
              }}
            />
            {/* Set against the bar's drawn edge, not its last date. A stream
                whose work lands on one day is drawn wider than that day, and
                the label was disappearing under the end of it. */}
            <span
              className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2.5 text-[10px]"
              style={{
                left: `${place(row.from) + barWidth(place, row.from, row.to)}%`,
                color: "var(--text-faint)",
              }}
            >
              {shortDate(new Date(row.from).toISOString())} –{" "}
              {shortDate(new Date(row.to).toISOString())}
            </span>
          </>
        ) : (
          <span
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[11.5px]"
            style={{ color: "var(--text-disabled)" }}
          >
            No dates yet
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * One task under an opened stream.
 *
 * A task has a due date and no start date, so it is a point on the line rather
 * than a bar across it — drawing a span would be inventing the half of it
 * nobody recorded. An approval gets the reference's diamond.
 */
function TaskBand({
  row,
  place,
  band,
}: {
  row: TimelineTask;
  place: (value: number) => number;
  band: number;
}) {
  const ink = row.done
    ? "var(--success-fg)"
    : row.overdue
      ? "var(--danger-text)"
      : row.running
        ? "var(--accent)"
        : "var(--border-strong)";

  return (
    <div className="flex items-center" style={{ height: band }}>
      <span
        className="flex shrink-0 items-center gap-2 pl-[30px] pr-3"
        style={{ width: LABEL_W }}
      >
        <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          {row.task.title}
        </span>
        <OwnerAvatar
          name={row.task.ownerName}
          initials={row.task.ownerInitials}
          userId={row.task.ownerUserId}
          hasPhoto={row.task.ownerHasPhoto}
          size={20}
        />
      </span>

      <span className="relative h-full flex-1">
        {row.at === null ? (
          <span
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px]"
            style={{ color: "var(--text-disabled)" }}
          >
            No date
          </span>
        ) : (
          <>
            <span
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${place(row.at)}%`, color: ink }}
              title={`${row.task.title}, ${shortDate(new Date(row.at).toISOString())}`}
            >
              {row.milestone ? (
                <span className="text-[11px]" aria-hidden>
                  ◆
                </span>
              ) : (
                <span
                  className="block h-2.5 w-2.5 rounded-full"
                  style={{ background: ink }}
                  aria-hidden
                />
              )}
            </span>
            <span
              className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-3 text-[11px]"
              style={{ left: `${place(row.at)}%`, color: "var(--text-tertiary)" }}
            >
              {row.done
                ? "✓ done"
                : row.overdue
                  ? `overdue ${shortDate(new Date(row.at).toISOString())}`
                  : shortDate(new Date(row.at).toISOString())}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

/**
 * WP.17e's four cards.
 *
 * Each is worked out from what the plan records and nothing else. A card with
 * nothing behind it says so rather than showing a zero, because "0 days" and
 * "nobody has entered a dependency" are different facts.
 */
function TimelineSummary({ model, clientView }: { model: TimelineModel; clientView?: boolean }) {
  const late = model.float !== null && model.float < 0;

  return (
    <div className={`grid gap-3.5 sm:grid-cols-2 ${clientView ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
      {/* A critical path is made of dependencies, which the portal is not
          sent, so there it would say "Not known" about a path that is known. */}
      {clientView ? null : (
        <SummaryCard
          label="Critical path"
          value={model.criticalPath ? `${model.criticalPath.days} days` : "Not known"}
          note={
            model.criticalPath
              ? model.criticalPath.through.join(" → ")
              : "No dependency has been recorded between Work Streams"
          }
        />
      )}

      <SummaryCard
        label="Float remaining"
        value={model.float === null ? "Not known" : `${Math.abs(model.float)} days`}
        ink={late ? "var(--danger-text)" : model.float !== null && model.float < 7 ? "var(--warning-fg)" : undefined}
        note={
          model.float === null
            ? "This plan has no target date"
            : late
              ? "Past the target date"
              : "Between the last dated task and the target"
        }
      />

      <SummaryCard
        label="At risk"
        value={model.atRisk.length === 0 ? "None" : `${model.atRisk.length} stream${model.atRisk.length === 1 ? "" : "s"}`}
        ink={model.atRisk.length > 0 ? "var(--danger-text)" : undefined}
        note={
          model.atRisk.length === 0
            ? "Nothing blocked and nothing late"
            : model.atRisk.map((row) => row.stream.name).join(", ")
        }
      />

      <SummaryCard
        label="Forecast finish"
        value={model.forecastFinish ? shortDate(new Date(model.forecastFinish).toISOString()) : "Not known"}
        note={
          model.float === null
            ? "The last dated work in the plan"
            : late
              ? `${Math.abs(model.float)} days past the target`
              : `${model.float} days before the target`
        }
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  ink,
}: {
  label: string;
  value: string;
  note: string;
  ink?: string;
}) {
  return (
    <div className="rounded-card border border-line px-4 py-3.5">
      <div
        className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div className="text-[21px] font-bold leading-none" style={ink ? { color: ink } : undefined}>
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] leading-[1.4]" style={{ color: "var(--text-tertiary)" }}>
        {note}
      </div>
    </div>
  );
}

/**
 * The Timeline's own controls live in the URL beside the view, so a scale
 * somebody set survives a refresh and can be handed on as a link.
 */
export function timelineHref(
  basePath: string,
  current: { scale: TimelineScale; showDependencies: boolean; expanded: string[] },
  next: Record<string, string | null>,
) {
  const query = new URLSearchParams({ view: "timeline" });

  const scale = "tscale" in next ? next.tscale : current.scale;
  if (scale && scale !== "month") query.set("tscale", scale);

  const deps = "deps" in next ? next.deps : current.showDependencies ? null : "off";
  if (deps === "off") query.set("deps", "off");

  const open = "open" in next ? next.open : current.expanded.join(",") || null;
  if (open) query.set("open", open);

  return `${basePath}?${query.toString()}`;
}

/** One entry in the timeline's key. */
function Key({ ink, label, outlined }: { ink: string; label: string; outlined?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-1.5 w-4 rounded-[2px]"
        style={{
          background: ink,
          border: outlined ? "1px solid var(--border-strong)" : undefined,
        }}
        aria-hidden
      />
      {label}
    </span>
  );
}

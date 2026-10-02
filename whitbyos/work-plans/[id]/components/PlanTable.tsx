import Link from "next/link";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import { cn } from "@/base/lib/cn";
import type { PlanTask, PlanWorkstream, WorkPlanDetail } from "@/whitbyos/lib/work-plans";
import { PLAN_CHIP, streamInk } from "@/whitbyos/lib/plan-ink";
import { shortDate } from "@/whitbyos/lib/format";
import { DragTask, DropColumn } from "@/whitbyos/work-plans/[id]/components/DragTasks";

const DONE = new Set(["complete", "completed", "done"]);

export type TableOptions = {
  q: string;
  group: boolean;
  sort: "due" | "task";
  /** "open" or "done" — the reference's Filter, with its count on the chip. */
  filter: string;
  /** Which optional columns are drawn. Held in the URL like everything else. */
  columns: ColumnKey[];
};

/** The columns ⚙ Columns can turn off. Task is not among them. */
export const OPTIONAL_COLUMNS = [
  { key: "owner", label: "Owner", track: "90px" },
  { key: "status", label: "Status", track: "1fr" },
  { key: "due", label: "Due", track: "0.95fr" },
  { key: "progress", label: "Progress", track: "1fr" },
] as const;

export type ColumnKey = (typeof OPTIONAL_COLUMNS)[number]["key"];

export const ALL_COLUMNS: ColumnKey[] = OPTIONAL_COLUMNS.map((column) => column.key);

function tracks(columns: ColumnKey[]) {
  return [
    "20px",
    "2.25fr",
    ...OPTIONAL_COLUMNS.filter((column) => columns.includes(column.key)).map(
      (column) => column.track,
    ),
  ].join(" ");
}

/**
 * WP.17b — every task on the plan, grouped under the stream it belongs to.
 *
 * The toolbar above it is real rather than drawn: search, grouping, sort and
 * filter all live in the URL, so a view someone set up survives a refresh and
 * can be sent to somebody else. A control that only looked like it worked
 * would be worse here than none — this is the view people come to when the
 * list has stopped fitting on a screen.
 *
 * The reference's ⚙ Columns is not here. A column chooser is only worth having
 * if it is remembered, and there is nowhere to remember it per person yet.
 */
export function PlanTable({
  plan,
  basePath,
  options,
  clientView,
}: {
  plan: WorkPlanDetail;
  basePath: string;
  options: TableOptions;
  /**
   * Drawn in the Client Portal (client-portal/014): no Add Task, and rows that
   * open no dialog. Nothing changes for Whitby when it is absent.
   */
  clientView?: boolean;
}) {
  const query = options.q.trim().toLowerCase();

  const matches = (task: PlanTask) => {
    if (query && !task.title.toLowerCase().includes(query)) return false;
    const complete = DONE.has(task.status.toLowerCase());
    if (options.filter === "open" && complete) return false;
    if (options.filter === "done" && !complete) return false;
    return true;
  };

  const order = (a: PlanTask, b: PlanTask) => {
    if (options.sort === "task") return a.title.localeCompare(b.title);
    // Undated work sorts last: a task with no date is not due first.
    if (!a.due_date) return b.due_date ? 1 : 0;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  };

  const columns = options.columns;

  const groups = plan.workstreams
    .map((stream) => ({ stream, tasks: stream.tasks.filter(matches).sort(order) }))
    .filter((group) => group.tasks.length > 0);

  const flat = plan.workstreams
    .flatMap((stream) => stream.tasks.filter(matches).map((task) => ({ task, stream })))
    .sort((a, b) => order(a.task, b.task));

  const total = plan.workstreams.reduce((sum, stream) => sum + stream.tasks.length, 0);
  const shown = flat.length;

  // The whole plan, not the filtered view: the line under the table says what
  // the plan is, and a filter should not change that.
  const everyTask = plan.workstreams.flatMap((stream) => stream.tasks);
  const now = Date.now();
  const tally = {
    complete: everyTask.filter((task) => DONE.has(task.status.toLowerCase())).length,
    running: everyTask.filter((task) => {
      const key = task.status.toLowerCase();
      return key === "in_progress" || key === "running";
    }).length,
    overdue: everyTask.filter(
      (task) =>
        !DONE.has(task.status.toLowerCase()) &&
        task.due_date &&
        new Date(task.due_date).getTime() < now,
    ).length,
  };

  return (
    <div>
      <Toolbar
        basePath={basePath}
        options={options}
        shown={shown}
        total={total}
        clientView={clientView}
      />

      {shown === 0 ? (
        <div
          className="rounded-[10px] border border-line px-4 py-10 text-center text-[13px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {total === 0
            ? "No tasks on this plan yet."
            : "No task matches what you have set above."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-line">
          <div
            className="grid items-center gap-2.5 px-4 py-[9px] text-[10.5px] font-semibold uppercase tracking-[0.04em]"
            style={{
              gridTemplateColumns: tracks(columns),
              background: "var(--surface-soft)",
              color: "var(--text-tertiary)",
            }}
          >
            <span />
            <span>Task {options.sort === "task" ? "↑" : ""}</span>
            {columns.includes("owner") ? <span>Owner</span> : null}
            {columns.includes("status") ? <span>Status</span> : null}
            {columns.includes("due") ? (
              <span>Due {options.sort === "due" ? "↑" : ""}</span>
            ) : null}
            {columns.includes("progress") ? <span>Progress</span> : null}
          </div>

          {/* Rows drag the same way the board's cards do: under a Work Stream
              heading a drop files the task there, and in the flat list it only
              changes the order. Nothing to drag in the portal's copy. */}
          {options.group
            ? groups.map((group) => (
                <div key={group.stream.id}>
                  <GroupRow
                    stream={group.stream}
                    index={plan.workstreams.findIndex((row) => row.id === group.stream.id)}
                    showing={group.tasks.length}
                    columns={columns}
                  />
                  <DropColumn
                    planId={plan.id}
                    group={clientView ? null : "stream"}
                    lane={clientView ? null : group.stream.id}
                  >
                    {group.tasks.map((task) =>
                      clientView ? (
                        <Row key={task.id} task={task} basePath={basePath} columns={columns} clientView={clientView} />
                      ) : (
                        <DragTask key={task.id} id={task.id} row>
                          <Row task={task} basePath={basePath} columns={columns} clientView={clientView} />
                        </DragTask>
                      ),
                    )}
                  </DropColumn>
                </div>
              ))
            : clientView
              ? flat.map(({ task }) => (
                  <Row key={task.id} task={task} basePath={basePath} columns={columns} clientView={clientView} />
                ))
              : (
                <DropColumn planId={plan.id}>
                  {flat.map(({ task }) => (
                    <DragTask key={task.id} id={task.id} row>
                      <Row task={task} basePath={basePath} columns={columns} clientView={clientView} />
                    </DragTask>
                  ))}
                </DropColumn>
              )}

          {/* WP.17b closes the table by saying how much of the plan is on
              screen. It matters here because search and filter can quietly
              take most of it away. */}
          <div
            className="flex items-center justify-between border-t border-line px-4 py-2 text-[11.5px]"
            style={{ background: "var(--surface-subtle)", color: "var(--text-tertiary)" }}
          >
            {/* "27 tasks · 14 complete · 4 running · 2 overdue", which is the
                plan in one line, and then how much of it is on screen, which
                search and filter can quietly cut down. */}
            <span className="flex flex-wrap items-center gap-1.5">
              <span>
                {total} task{total === 1 ? "" : "s"}
              </span>
              {tally.complete > 0 ? <Dot /> : null}
              {tally.complete > 0 ? <span>{tally.complete} complete</span> : null}
              {tally.running > 0 ? <Dot /> : null}
              {tally.running > 0 ? <span>{tally.running} running</span> : null}
              {tally.overdue > 0 ? <Dot /> : null}
              {tally.overdue > 0 ? (
                <span style={{ color: "var(--danger-text)" }}>{tally.overdue} overdue</span>
              ) : null}
            </span>

            <span className="flex items-center gap-2.5">
              <span>
                {shown === total ? `Rows 1–${total}` : `Showing ${shown} of ${total}`}
              </span>
              {shown !== total ? (
                <Link
                  href={`${basePath}?view=table`}
                  scroll={false}
                  className="no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  Clear
                </Link>
              ) : null}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function streamDone(stream: PlanWorkstream) {
  return stream.tasks.filter((task) => DONE.has(task.status.toLowerCase())).length;
}

function streamPercent(stream: PlanWorkstream) {
  if (stream.tasks.length === 0) return 0;
  return Math.round((streamDone(stream) / stream.tasks.length) * 100);
}

/** The band that names a Work Stream and how far through it is. */
function GroupRow({
  stream,
  index,
  showing,
  columns,
}: {
  stream: PlanWorkstream;
  /** Its position in the plan, which is what decides its colour. */
  index: number;
  showing: number;
  columns: ColumnKey[];
}) {
  const share = streamPercent(stream);
  const full = share >= 100;

  return (
    <div
      className="grid items-center gap-2.5 border-t border-line px-4 py-2"
      style={{ gridTemplateColumns: tracks(columns), background: "var(--surface-subtle)" }}
    >
      <span className="text-[8px]" style={{ color: "var(--text-disabled)" }} aria-hidden>
        ▾
      </span>

      <span className="flex min-w-0 items-center gap-2">
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
          style={{ background: full ? "var(--success-fg)" : streamInk(index) }}
          aria-hidden
        />
        <span className="truncate text-[12px] font-semibold">{stream.name}</span>
        <span
          className="shrink-0 whitespace-nowrap rounded-lg px-1.5 py-px text-[10.5px]"
          style={{ background: "var(--surface-active)", color: "var(--text-disabled)" }}
        >
          {stream.tasks.length} · {share}%
          {showing !== stream.tasks.length ? ` · showing ${showing}` : ""}
        </span>
      </span>

      {columns.includes("owner") ? <span /> : null}
      {columns.includes("status") ? <span /> : null}
      {columns.includes("due") ? <span /> : null}
      {columns.includes("progress") ? <Meter percent={share} /> : null}
    </div>
  );
}

function Row({
  task,
  basePath,
  columns,
  clientView,
}: {
  task: PlanTask;
  basePath: string;
  columns: ColumnKey[];
  clientView?: boolean;
}) {
  const complete = DONE.has(task.status.toLowerCase());
  const overdue = !complete && task.due_date ? new Date(task.due_date) < new Date() : false;

  const steps = task.checklist ?? [];
  const stepsDone = steps.filter((item) => item.done).length;
  const share = complete ? 100 : steps.length > 0 ? Math.round((stepsDone / steps.length) * 100) : 0;

  const rowStyle = {
    gridTemplateColumns: tracks(columns),
    borderColor: "var(--surface-subtle)",
    color: "var(--ink)",
  };

  const content = (
    <>
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] text-[9px]"
        style={
          complete
            ? { border: "1px solid var(--success-fg)", background: "var(--success-fg)", color: "#fff" }
            : { border: "1px solid var(--border-strong)" }
        }
        aria-hidden
      >
        {complete ? "✓" : ""}
      </span>

      <span className="flex min-w-0 items-center gap-[7px]">
        <span
          className="min-w-0 truncate"
          style={
            complete
              ? { color: "var(--text-tertiary)", textDecoration: "line-through" }
              : undefined
          }
        >
          {task.title}
        </span>
        {flagOf(task) ? (
          <span
            className="shrink-0 whitespace-nowrap rounded px-[7px] py-0.5 text-[10.5px] font-medium"
            style={{ background: flagOf(task)!.bg, color: flagOf(task)!.fg }}
          >
            {flagOf(task)!.label}
          </span>
        ) : null}
        {steps.length > 0 ? (
          <span
            className="shrink-0 text-[10px]"
            style={{ color: "var(--text-disabled)" }}
            title={`${stepsDone} of ${steps.length} checklist items done`}
          >
            ❐ {steps.length}
          </span>
        ) : null}
      </span>

      {columns.includes("owner") ? (
      <span className="flex min-w-0 items-center gap-1.5">
        {task.ownerInitials ? (
          <>
            <OwnerAvatar
              name={task.ownerName}
              initials={task.ownerInitials}
              userId={task.ownerUserId}
            hasPhoto={task.ownerHasPhoto}
            />
            <span className="truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
              {(task.ownerName ?? "").split(" ")[0]}
            </span>
          </>
        ) : (
          <span className="text-[12px]" style={{ color: "var(--text-disabled)" }}>
            Not set
          </span>
        )}
      </span>
      ) : null}

      {columns.includes("status") ? (
        <span>
          <StatusChip status={task.status} />
        </span>
      ) : null}

      {columns.includes("due") ? (
        <span
          className="whitespace-nowrap text-[12.5px]"
          style={{
            color: overdue ? "var(--danger-text)" : "rgba(55,53,47,.55)",
            fontWeight: overdue ? 600 : undefined,
          }}
        >
          {dueText(task, complete)}
        </span>
      ) : null}

      {columns.includes("progress") ? <Meter percent={share} /> : null}
    </>
  );

  // In the portal there is no task dialog behind a row, so the row is not a link.
  return clientView ? (
    <div className="grid items-center gap-2.5 border-t px-4 py-[9px] text-[13.5px]" style={rowStyle}>
      {content}
    </div>
  ) : (
    /* The task itself, the way the List and the board open it. Edit is on the
       task's own page, where what is being changed can be read first. */
    <Link
      href={`${basePath}/tasks/${task.id}`}
      className="grid items-center gap-2.5 border-t px-4 py-[9px] text-[13.5px] no-underline hover:bg-[var(--surface-soft)]"
      style={rowStyle}
    >
      {content}
    </Link>
  );
}

const CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  complete: { label: "Complete", ...PLAN_CHIP.complete },
  completed: { label: "Complete", ...PLAN_CHIP.complete },
  done: { label: "Complete", ...PLAN_CHIP.complete },
  in_progress: { label: "Running", ...PLAN_CHIP.running },
  running: { label: "Running", ...PLAN_CHIP.running },
  waiting: { label: "Waiting", ...PLAN_CHIP.waiting },
  blocked: { label: "Blocked", bg: "var(--danger-bg)", fg: "var(--danger-fg)" },
};

function StatusChip({ status }: { status: string }) {
  const key = String(status).toLowerCase();
  const chip = CHIP[key] ?? { label: "Not Started", ...PLAN_CHIP.planned };

  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded px-[7px] py-0.5 text-[10.5px] font-medium"
      style={{ background: chip.bg, color: chip.fg }}
    >
      {chip.label}
    </span>
  );
}

function Meter({ percent }: { percent: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="block h-[5px] w-16 shrink-0 overflow-hidden rounded-[3px]"
        style={{ background: "var(--canvas)" }}
      >
        <span
          className="block h-full"
          style={{
            width: `${percent}%`,
            background: percent >= 100 ? "var(--success-fg)" : "var(--accent)",
          }}
        />
      </span>
      <span className="text-[10.5px]" style={{ color: "var(--text-disabled)" }}>
        {percent}%
      </span>
    </span>
  );
}

/** Search, grouping, filter and sort — all held in the URL. */
function Toolbar({
  basePath,
  options,
  shown,
  total,
  clientView,
}: {
  basePath: string;
  options: TableOptions;
  shown: number;
  total: number;
  clientView?: boolean;
}) {
  const href = (patch: Partial<TableOptions>) => {
    const next = { ...options, ...patch };
    const params = new URLSearchParams({ view: "table" });
    if (next.q) params.set("q", next.q);
    if (!next.group) params.set("group", "off");
    if (next.sort !== "due") params.set("sort", next.sort);
    if (next.filter) params.set("filter", next.filter);
    // Only when it differs from all-on, so an untouched table has a clean URL.
    if (next.columns.length !== ALL_COLUMNS.length) {
      params.set("cols", next.columns.join(","));
    }
    return `${basePath}?${params.toString()}`;
  };

  const chip =
    "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-[11.5px] no-underline";

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      <form method="get" action={basePath} className="contents">
        <input type="hidden" name="view" value="table" />
        {options.group ? null : <input type="hidden" name="group" value="off" />}
        {options.sort !== "due" ? <input type="hidden" name="sort" value={options.sort} /> : null}
        {options.filter ? <input type="hidden" name="filter" value={options.filter} /> : null}
        <span
          className="inline-flex w-[210px] items-center gap-[7px] rounded-control border px-2.5 py-1.5"
          style={{ borderColor: "var(--border-dashed)" }}
        >
          <span className="text-[11.5px]" style={{ color: "var(--text-disabled)" }} aria-hidden>
            ⌕
          </span>
          <input
            name="q"
            defaultValue={options.q}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="min-w-0 flex-1 border-none bg-transparent text-[11.5px] outline-none"
          />
        </span>
      </form>

      <Link
        href={href({ group: !options.group })}
        className={chip}
        style={{ borderColor: "var(--border-dashed)", color: "var(--ink)" }}
      >
        Group by <b className="font-semibold">{options.group ? "Work Stream" : "Nothing"}</b>
        <span className="text-[8px]" style={{ color: "var(--text-disabled)" }} aria-hidden>
          ▾
        </span>
      </Link>

      <Link
        href={href({
          filter: options.filter === "" ? "open" : options.filter === "open" ? "done" : "",
        })}
        className={chip}
        style={{ borderColor: "var(--border-dashed)", color: "var(--text-secondary)" }}
      >
        <span aria-hidden>⚟</span>
        {options.filter === "open" ? "Open only" : options.filter === "done" ? "Complete only" : "Filter"}
        {options.filter ? (
          <span
            className="rounded-lg px-[5px] text-[9.5px] text-white"
            style={{ background: "var(--accent)" }}
          >
            {shown}
          </span>
        ) : null}
      </Link>

      <Link
        href={href({ sort: options.sort === "due" ? "task" : "due" })}
        className={chip}
        style={{ borderColor: "var(--border-dashed)", color: "var(--text-secondary)" }}
      >
        <span aria-hidden>↕</span>
        {options.sort === "due" ? "Due date" : "Task name"}
      </Link>

      <span className="text-[11.5px]" style={{ color: "var(--text-disabled)" }}>
        {shown === total ? `${total} tasks` : `${shown} of ${total}`}
      </span>

      {/* ⚙ Columns. Each one toggles through the URL, the same way the rest of
          this bar does, which is also where it is remembered, so a table
          someone narrowed stays narrowed and can be handed on. */}
      <span className="flex items-center gap-1">
        <span className="text-[11.5px]" style={{ color: "var(--text-disabled)" }} aria-hidden>
          ⚙
        </span>
        {OPTIONAL_COLUMNS.map((column) => {
          const on = options.columns.includes(column.key);
          return (
            <Link
              key={column.key}
              href={href({
                columns: on
                  ? options.columns.filter((key) => key !== column.key)
                  : [...options.columns, column.key],
              })}
              aria-pressed={on}
              title={`${on ? "Hide" : "Show"} ${column.label}`}
              className="rounded-control border px-2 py-1 text-[11px] no-underline"
              style={
                on
                  ? { borderColor: "var(--border-dashed)", color: "var(--ink)" }
                  : {
                      borderColor: "var(--border-dashed)",
                      color: "var(--text-disabled)",
                      textDecoration: "line-through",
                    }
              }
            >
              {column.label}
            </Link>
          );
        })}
      </span>

      {clientView ? null : (
        <Link
          href={`${basePath}?view=table&task=new`}
          scroll={false}
          className={cn(
            "ml-auto rounded-control border px-3 py-[7px] text-[12.5px] font-medium text-white no-underline hover:text-white",
          )}
          style={{ background: "var(--ink)", borderColor: "var(--ink)" }}
        >
          + Add Task
        </Link>
      )}
    </div>
  );
}

function Dot() {
  return <span style={{ color: "var(--border-dashed)" }}>·</span>;
}

/**
 * The badge beside a task's name — the one thing about it worth interrupting
 * the row for.
 *
 * One only, in the order that decides: late beats blocked beats waiting on a
 * decision, because that is the order somebody would act on them.
 */
function flagOf(task: PlanTask): { label: string; bg: string; fg: string } | null {
  const done = DONE.has(task.status.toLowerCase());
  if (done) return null;

  if (task.due_date && new Date(task.due_date).getTime() < Date.now()) {
    return { label: "Overdue", bg: "var(--danger-bg)", fg: "var(--danger-fg)" };
  }
  if (task.blockedByStreamId || task.blockedByTaskId) {
    return { label: "Blocked", bg: "var(--warning-bg)", fg: "var(--warning-fg)" };
  }
  if (task.kind === "approval") {
    return { label: "Approval", bg: "var(--accent-tint)", fg: "var(--accent)" };
  }
  return null;
}

/**
 * The due column, as WP.17b writes it: "May 16 · in 2d", "Overdue May 8".
 *
 * A finished task keeps its date without a countdown — how long is left is not
 * a question anybody is asking about it any more.
 */
function dueText(task: PlanTask, complete: boolean) {
  if (!task.due_date) return "No date";

  const date = shortDate(task.due_date);
  if (complete) return date;

  const days = Math.round((new Date(task.due_date).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `Overdue ${date}`;
  if (days === 0) return `${date} · today`;
  return `${date} · in ${days}d`;
}

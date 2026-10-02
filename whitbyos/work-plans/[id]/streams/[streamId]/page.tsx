import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import { BackLink } from "@/whitbyos/components/BackLink";
import {
  ContactsPanel,
  planResources,
} from "@/whitbyos/work-plans/[id]/components/ContactsPanel";
import { notFound } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import { shortDate } from "@/whitbyos/lib/format";
import { workstreamStatusLabel } from "@/whitbyos/lib/workstream-status";
import {
  getStreamCharts,
  getWorkstreamDetail,
  listStreamProviders,
  type PlanTask,
} from "@/whitbyos/lib/work-plans";
import { listProviders } from "@/whitbyos/lib/providers";
import {
  attachProvider,
  detachProvider,
} from "@/whitbyos/work-plans/[id]/streams/[streamId]/actions";
import { StreamChartsView } from "@/whitbyos/work-plans/[id]/streams/[streamId]/StreamCharts";
import { PLAN_CHIP, PLAN_INK, streamInk } from "@/whitbyos/lib/plan-ink";

const DONE = new Set(["complete", "completed", "done"]);

const VIEWS = [
  { slug: "", label: "List" },
  { slug: "table", label: "Table" },
  { slug: "kanban", label: "Kanban" },
  { slug: "timeline", label: "Timeline" },
  { slug: "charts", label: "Charts" },
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * WP.17g–i — one Work Stream, in the four views the plan offers minus Grid.
 *
 * Grid is missing because it is the plan's view of its Work Streams, and there
 * is only one here. The export leaves it out for the same reason.
 */
export default async function WorkstreamDetailPage({
  planId,
  streamId,
  searchParams,
}: {
  planId: string;
  streamId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const stream = await getWorkstreamDetail(planId, streamId);
  if (!stream) notFound();

  const view = one(searchParams?.view) ?? "";
  const here = `/whitbyos/work-plans/${planId}/streams/${streamId}`;
  const done = stream.tasks.filter((task) => DONE.has(task.status.toLowerCase())).length;
  const unassigned = stream.tasks.filter((task) => !task.ownerName).length;

  // Only for the Charts tab, which reads fields the other four never show.
  const charts = view === "charts" ? await getStreamCharts(planId, streamId) : null;

  const providers = (await listStreamProviders([streamId])).get(streamId) ?? [];

  // Read off the tasks rather than queried: the stream is already in hand and
  // carries what each of its tasks is using and what each of them still needs.
  const usedHere = [
    ...stream.tasks
      .filter((task) => task.providerId)
      .reduce((seen, task) => {
        const found = seen.get(task.providerId!);
        if (found) found.tasks += 1;
        else
          seen.set(task.providerId!, {
            id: task.providerId!,
            name:
              task.externalLinks.find((link) => link.kind === "provider")?.label ??
              "A provider",
            tasks: 1,
          });
        return seen;
      }, new Map<string, { id: string; name: string; tasks: number }>())
      .values(),
  ];

  // Read off the tasks already in hand: Whitby wrote these when it drafted
  // them, and the firm's own providers were attached on the way in.
  const contacts = planResources(stream.tasks);

  const neededHere = [
    ...new Set(
      stream.tasks
        .map((task) => task.providerNeed?.category)
        .filter((category): category is string => Boolean(category)),
    ),
  ];
  // Everyone in the directory who is not already on this stream.
  const directory = await listProviders();
  const taken = new Set(providers.map((provider) => provider.id));
  const available = (directory.ok ? directory.rows : []).filter((row) => !taken.has(row.id));

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={`/whitbyos/work-plans/${planId}`} label={`Back to ${stream.planName}`} />

      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {stream.clientName} / Work Plans /{" "}
        <Link
          href={`/whitbyos/work-plans/${planId}`}
          className="no-underline"
          style={{ color: "var(--text-secondary)" }}
        >
          {stream.planName}
        </Link>
      </div>

      {/* The way back is a quiet link before the name, not a button off to the
          right, a Work Stream is a page you arrived at from somewhere, and
          the right of this row is what the switch is for. */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-[20px] font-bold">{stream.name}</h1>

          <Pill
            tone={
              stream.blocked
                ? "danger"
                : DONE.has(stream.status.toLowerCase())
                  ? "success"
                  : stream.status === "not_started"
                    ? "neutral"
                    : "info"
            }
          >
            {workstreamStatusLabel(stream.status, stream.blocked)}
          </Pill>
        </div>

        <div className="flex shrink-0 gap-1 rounded-[8px] border border-line-strong p-[3px]">
          {VIEWS.map((item) => {
            const on = item.slug === view;
            return (
              <Link
                key={item.label}
                href={item.slug ? `${here}?view=${item.slug}` : here}
                className="rounded-control px-3.5 py-1.5 text-[12.5px] no-underline transition-colors"
                style={
                  on
                    ? {
                        background: "var(--surface-active)",
                        color: "var(--ink)",
                        fontWeight: 600,
                      }
                    : { color: "var(--text-secondary)", fontWeight: 500 }
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {stream.purpose ? (
        <p
          className="mb-3.5 max-w-[70ch] text-[13.5px] leading-[1.55]"
          style={{ margin: "0 0 14px", color: "var(--text-secondary)" }}
        >
          {stream.purpose}
        </p>
      ) : null}

      {/* The counts, with something to see. A line of grey text saying "0 of 4
          complete" is the same sentence whether the stream is untouched or
          nearly done; a bar is not. */}
      <div
        className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-card border border-line bg-surface px-4 py-3"
        style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
      >
        <span className="flex min-w-[180px] flex-1 items-center gap-3">
          <span
            className="h-[6px] min-w-[90px] flex-1 overflow-hidden rounded-[3px]"
            style={{ background: "var(--canvas)" }}
          >
            <span
              className="block h-full rounded-[3px]"
              style={{
                width: `${stream.tasks.length === 0 ? 0 : Math.round((done / stream.tasks.length) * 100)}%`,
                background: done === stream.tasks.length && done > 0
                  ? "var(--success-fg)"
                  : streamInk(stream.position - 1),
              }}
            />
          </span>
          <span
            className="shrink-0 whitespace-nowrap text-[12.5px]"
            style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}
          >
            {done} of {stream.tasks.length} complete
          </span>
        </span>

        <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Work Stream {stream.position} of {stream.totalStreams}
        </span>

        {unassigned > 0 ? (
          <span className="text-[12.5px]" style={{ color: "var(--warning-fg)" }}>
            {unassigned} unassigned
          </span>
        ) : null}

        {stream.targetDate ? (
          <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Target {shortDate(stream.targetDate)}
          </span>
        ) : null}
      </div>

      {view === "charts" ? (
        // WP.17k is the one stream view without the rail beside it.
        charts ? (
          <StreamChartsView charts={charts} />
        ) : null
      ) : (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {stream.tasks.length === 0 ? (
            <div
              className="rounded-card border border-line px-4 py-10 text-center text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              No tasks in this Work Stream yet.
            </div>
          ) : view === "kanban" ? (
            <Kanban tasks={stream.tasks} planId={planId} />
          ) : view === "timeline" ? (
            <Timeline tasks={stream.tasks} />
          ) : (
            <Table
              tasks={stream.tasks}
              compact={view === ""}
              planId={planId}
              ink={streamInk(stream.position - 1)}
            />
          )}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[260px]">
          <Panel title="Owner">
            {stream.ownerName ? (
              <span className="flex items-center gap-2">
                <OwnerAvatar
                  name={stream.ownerName}
                  initials={stream.ownerInitials}
                  userId={stream.ownerUserId}
                  hasPhoto={stream.ownerHasPhoto}
                  size={20}
                />
                {stream.ownerName}
              </span>
            ) : (
              <span style={{ color: "var(--text-tertiary)" }}>Nobody assigned yet</span>
            )}
          </Panel>

          <Panel title="Key Dates">
            <div>Started {shortDate(stream.createdAt)}</div>
            {stream.targetDate ? <div>Target {shortDate(stream.targetDate)}</div> : null}
          </Panel>

          {/* WP.17c names the firm doing each stream. This is where one gets
              brought in, the provider directory holds who they are, and this
              says which piece of work they are on. */}
          {/* Everywhere this stream's tasks send somebody, the same panel the
              plan and the task use. The Providers box below says who is
              engaged and who is still needed; this says how to reach them,
              which is what somebody at this screen actually wants. */}
          {contacts.length > 0 ? (
            <Panel title={`Where to go (${contacts.length})`}>
              <ContactsPanel entries={contacts} />
            </Panel>
          ) : null}

          <Panel title="Providers">
            {/* What the tasks in this stream are already using, before the
                panel offers to add anybody. "Nobody brought in yet" was shown
                over tasks that named a provider and carried its number —
                `whitbyos_provider_options` is what the client was offered, and
                that is a different question from who is doing the work. */}
            {usedHere.length > 0 ? (
              <div className="mb-2 flex flex-col gap-1">
                {usedHere.map((provider) => (
                  <span key={provider.id} className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate" style={{ color: "var(--ink)" }}>
                      {provider.name}
                    </span>
                    <span className="shrink-0 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      on {provider.tasks} task{provider.tasks === 1 ? "" : "s"}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}

            {/* And what it needs and you have nobody for. */}
            {neededHere.length > 0 ? (
              <div className="mb-2 flex flex-col gap-1.5">
                {neededHere.map((need) => (
                  <span key={need} className="flex items-baseline gap-2">
                    <span
                      className="shrink-0 text-[10px] font-semibold uppercase tracking-[.05em]"
                      style={{ color: "var(--warning-fg)" }}
                    >
                      Needed
                    </span>
                    <span className="min-w-0 flex-1" style={{ color: "var(--ink)" }}>
                      {need}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}

            {providers.length === 0 ? (
              usedHere.length === 0 && neededHere.length === 0 ? (
                <span style={{ color: "var(--text-tertiary)" }}>
                  This work needs nobody outside the firm.
                </span>
              ) : null
            ) : (
              providers.map((provider) => (
                <span key={provider.optionId} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{provider.name}</span>
                  <form action={detachProvider} className="shrink-0">
                    <input type="hidden" name="plan_id" value={planId} />
                    <input type="hidden" name="workstream_id" value={streamId} />
                    <input type="hidden" name="option_id" value={provider.optionId} />
                    <SubmitPlain
                     
                      aria-label={`Remove ${provider.name}`}
                      title={`Remove ${provider.name}`}
                      className="text-[12px]"
                      style={{ color: "var(--text-disabled)" }}
                    >
                      ✕
                    </SubmitPlain>
                  </form>
                </span>
              ))
            )}

            {/* Quiet until it is wanted.
                Bringing a firm onto a piece of work is a thing that happened,
                not a change to the plan's shape, so it belongs on the page
                rather than behind Edit — the same reason the Point of Contact
                control sits on the provider's own screen. But a permanently
                open picker on every Work Stream, most of which need nobody,
                is a control shouting at somebody who did not ask. A summary
                and a details element, so it costs one line until it is opened
                and needs no script to open. */}
            {available.length > 0 ? (
              <details className="mt-1">
                <summary
                  className="cursor-pointer list-none text-[12px]"
                  style={{ color: "var(--accent)" }}
                >
                  + Bring in a provider
                </summary>

                <form action={attachProvider} className="mt-2 flex gap-1.5">
                  <input type="hidden" name="plan_id" value={planId} />
                  <input type="hidden" name="workstream_id" value={streamId} />
                  <select
                    name="provider_id"
                    required
                    defaultValue=""
                    aria-label="Choose a provider"
                    className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-2 py-1 text-[12px] text-ink"
                  >
                    <option value="">Choose…</option>
                    {available.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                  <SubmitPlain
                    className="shrink-0 rounded-control border border-line-strong px-2 py-1 text-[12px] font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    Add
                  </SubmitPlain>
                </form>
              </details>
            ) : (
              <Link
                href="/whitbyos/providers"
                className="text-[12px] no-underline"
                style={{ color: "var(--accent)" }}
              >
                Add one to the directory first →
              </Link>
            )}
          </Panel>

          {/* Two questions, and the panel used to answer one of them with a
              sentence about the other: "Nothing depends on this one" over a
              stream whose own rows were visibly marked as waiting. */}
          <Panel title="Dependencies">
            {stream.blockedBy.length > 0 ? (
              <div className="mb-1.5">
                <span style={{ color: "var(--warning-fg)" }}>Waiting on</span>{" "}
                {stream.blockedBy.join(", ")}
              </div>
            ) : null}

            {stream.blocks.length > 0 ? (
              <div className="mb-1.5">
                <span style={{ color: "var(--ink)" }}>Holds up</span>{" "}
                {stream.blocks.join(", ")}
              </div>
            ) : null}

            {stream.internalWaits > 0 ? (
              <div style={{ color: "var(--text-tertiary)" }}>
                {stream.internalWaits} task{stream.internalWaits === 1 ? "" : "s"} here follow
                {stream.internalWaits === 1 ? "s" : ""} earlier work in this Work Stream.
              </div>
            ) : null}

            {stream.blockedBy.length === 0 &&
            stream.blocks.length === 0 &&
            stream.internalWaits === 0 ? (
              <span style={{ color: "var(--text-tertiary)" }}>
                This Work Stream can run on its own, and nothing waits on it.
              </span>
            ) : null}
          </Panel>
        </aside>
      </div>
      )}
    </div>
  );
}

/**
 * The stream's tasks, as rows somebody can act on.
 *
 * This was four columns of plain text — title, owner name, a status word, a
 * date — with nothing clickable in it. Everything the plan screen had learned
 * to show (whose it is, how long it takes, what it waits on, how far its steps
 * have got) was absent, and the title went nowhere, so a Work Stream was a
 * list you could read rather than a place you could work from.
 */
function Table({
  tasks,
  compact,
  planId,
  ink,
}: {
  tasks: PlanTask[];
  compact?: boolean;
  planId: string;
  /** The stream's own colour, so its rows read as belonging to it. */
  ink: string;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      {!compact ? (
        <div
          className="grid grid-cols-[3fr_1.4fr_1.1fr_0.9fr] gap-2 border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.04em]"
          style={{ background: "var(--surface-soft)", color: "var(--text-tertiary)" }}
        >
          <span>Task</span>
          <span>Assigned to</span>
          <span>Status</span>
          <span className="text-right">Due</span>
        </div>
      ) : null}

      {tasks.map((task) => {
        const complete = DONE.has(task.status.toLowerCase());
        const ticked = task.checklist.filter((item) => item.done).length;

        return (
          <div
            key={task.id}
            className="grid grid-cols-[3fr_1.4fr_1.1fr_0.9fr] items-center gap-2 border-b border-line px-4 py-3 last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2 pr-3">
              {/* A bar in the stream's colour, so a row reads as one of its
                  own rather than as a row in a table of everything. */}
              <span
                className="h-[18px] w-[3px] shrink-0 rounded-[2px]"
                style={{ background: complete ? "var(--success-fg)" : ink }}
                aria-hidden
              />

              <Link
                href={`/whitbyos/work-plans/${planId}/tasks/${task.id}`}
                className="min-w-0 truncate text-[13.5px] no-underline"
                style={
                  complete
                    ? { color: "var(--text-secondary)", textDecoration: "line-through" }
                    : { color: "var(--ink)" }
                }
              >
                {task.title}
              </Link>

              {task.kind === "approval" ? (
                <span
                  className="shrink-0 text-[11px]"
                  style={{ color: "var(--warning-fg)" }}
                  title="Needs approval before it goes out"
                >
                  ●
                </span>
              ) : null}

              {task.blockedByTaskId || task.blockedByStreamId ? (
                <span
                  className="shrink-0 text-[11px]"
                  style={{ color: "var(--warning-fg)" }}
                  title="Waiting on earlier work"
                >
                  ↳
                </span>
              ) : null}

              {task.checklist.length > 0 ? (
                <span
                  className="shrink-0 text-[11px]"
                  style={{
                    color:
                      ticked === task.checklist.length
                        ? "var(--success-fg)"
                        : "var(--text-quiet)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                  title={`${ticked} of ${task.checklist.length} steps done`}
                >
                  {ticked}/{task.checklist.length}
                </span>
              ) : null}
            </span>

            {/* A name in grey said who it was; a face says it at a glance, and
                an unassigned task now says so rather than reading as a blank. */}
            <span className="flex min-w-0 items-center gap-2">
              {task.ownerName ? (
                <>
                  <OwnerAvatar
                    name={task.ownerName}
                    initials={task.ownerInitials ?? "?"}
                    userId={task.ownerUserId}
                    hasPhoto={task.ownerHasPhoto}
                    size={22}
                  />
                  <span
                    className="min-w-0 truncate text-[12.5px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {task.ownerName}
                  </span>
                </>
              ) : (
                <span className="text-[12.5px]" style={{ color: "var(--warning-fg)" }}>
                  Unassigned
                </span>
              )}
            </span>

            <span>
              <TaskStatusChip status={task.status} />
            </span>

            <span
              className="text-right text-[12.5px]"
              style={{ color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}
            >
              {task.due_date ? shortDate(task.due_date) : "No date"}
              {task.estimatedDays ? (
                <span className="block text-[11px]" style={{ color: "var(--text-quiet)" }}>
                  {task.estimatedDays}d of work
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TaskStatusChip({ status }: { status: string }) {
  const key = status.toLowerCase();
  const chip = DONE.has(key)
    ? { label: "Complete", ...PLAN_CHIP.complete }
    : key === "waiting"
      ? { label: "Waiting", ...PLAN_CHIP.waiting }
      : key === "in_progress" || key === "running"
        ? { label: "Running", ...PLAN_CHIP.running }
        : { label: "Not Started", ...PLAN_CHIP.planned };

  return (
    <span
      className="inline-flex whitespace-nowrap rounded px-[7px] py-0.5 text-[10.5px] font-medium"
      style={{ background: chip.bg, color: chip.fg }}
    >
      {chip.label}
    </span>
  );
}

function Kanban({ tasks, planId }: { tasks: PlanTask[]; planId: string }) {
  // The plan's own four colours, so a lane here is the lane it is there.
  const columns = [
    { key: "not_started", label: "Not Started", ink: PLAN_INK.planned },
    { key: "in_progress", label: "Running", ink: PLAN_INK.running },
    { key: "waiting", label: "Waiting", ink: PLAN_INK.waiting },
    { key: "complete", label: "Complete", ink: PLAN_INK.complete },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {columns.map((column) => {
        const mine = tasks.filter((task) => {
          const status = task.status.toLowerCase();
          if (column.key === "complete") return DONE.has(status);
          if (column.key === "in_progress") return status === "in_progress" || status === "running";
          return status === column.key;
        });

        return (
          <div key={column.key}>
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: column.ink }}
                aria-hidden
              />
              <span className="text-[12.5px] font-semibold">{column.label}</span>
              <span className="ml-auto text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {mine.length}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {mine.length === 0 ? (
                <div
                  className="rounded-card border border-dashed px-3 py-6 text-center text-[12px]"
                  style={{ borderColor: "var(--border)", color: "var(--text-disabled)" }}
                >
                  Nothing here
                </div>
              ) : (
                mine.map((task) => (
                  <Link
                    key={task.id}
                    href={`/whitbyos/work-plans/${planId}/tasks/${task.id}`}
                    className="block rounded-card border border-line bg-surface px-3 py-2.5 no-underline"
                    style={{ borderLeft: `3px solid ${column.ink}` }}
                  >
                    <div className="text-[13px] leading-[1.45]" style={{ color: "var(--ink)" }}>
                      {task.title}
                    </div>
                    <div
                      className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {task.ownerName ? (
                        <OwnerAvatar
                          name={task.ownerName}
                          initials={task.ownerInitials ?? "?"}
                          userId={task.ownerUserId}
                          hasPhoto={task.ownerHasPhoto}
                          size={18}
                        />
                      ) : null}
                      {task.due_date ? <span>{shortDate(task.due_date)}</span> : null}
                      {task.checklist.length > 0 ? (
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                          {task.checklist.filter((item) => item.done).length}/
                          {task.checklist.length} steps
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Tasks against their own dates, so a stream with none says so. */
function Timeline({ tasks }: { tasks: PlanTask[] }) {
  const dated = tasks.filter((task) => task.due_date);

  if (dated.length === 0) {
    return (
      <div
        className="rounded-card border border-line px-4 py-10 text-center text-[13px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        No task here has a date yet, so there is nothing to lay out in time.
      </div>
    );
  }

  const times = dated.map((task) => new Date(task.due_date!).getTime());
  const from = Math.min(...times);
  const width = Math.max(Math.max(...times) - from, 1);

  return (
    <div className="rounded-card border border-line p-4">
      <div className="flex flex-col gap-2">
        {dated.map((task) => {
          const at = ((new Date(task.due_date!).getTime() - from) / width) * 100;
          return (
            <div key={task.id} className="flex items-center gap-3">
              <span className="w-[200px] shrink-0 truncate text-[13px]">{task.title}</span>
              <span
                className="relative h-6 flex-1 rounded-[4px]"
                style={{ background: "var(--canvas)" }}
              >
                <span
                  className="absolute top-1 h-4 w-4 rounded-full"
                  style={{
                    // Clamped so a task on the last day is not half off the end.
                    left: `calc(${Math.min(at, 100)}% - ${at > 95 ? 16 : 0}px)`,
                    background: DONE.has(task.status.toLowerCase())
                      ? "var(--success-fg)"
                      : "var(--accent)",
                  }}
                  title={shortDate(task.due_date)}
                />
              </span>
              <span className="w-[70px] shrink-0 text-right text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {shortDate(task.due_date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-line p-4">
      <div className="mb-2 text-[13px] font-semibold">{title}</div>
      <div className="text-[12.5px] leading-[1.8]" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import { getRequest } from "@/client-portal/lib/data/requests";
import { getRequestPlan } from "@/client-portal/lib/data/plans";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { param, type SearchParams } from "@/client-portal/lib/routing";
import { toWhitbyPlan } from "@/client-portal/lib/plan-view";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import { shortDate } from "@/whitbyos/lib/format";
import { computeStreamCharts } from "@/whitbyos/lib/plan-math";
import { workstreamStatusLabel } from "@/whitbyos/lib/workstream-status";
import type { PlanTask } from "@/whitbyos/lib/work-plans";
import { StreamChartsView } from "@/whitbyos/work-plans/[id]/streams/[streamId]/StreamCharts";

const DONE = new Set(["complete", "completed", "done"]);

const VIEWS = [
  { slug: "", label: "List" },
  { slug: "table", label: "Table" },
  { slug: "kanban", label: "Kanban" },
  { slug: "timeline", label: "Timeline" },
  { slug: "charts", label: "Charts" },
];

/**
 * WP.17g–i — one Work Stream of a shared plan, in the same five views Whitby
 * gives a stream (a Grid of one stream is not a view, so neither side has it).
 *
 * The rail keeps Owner and Key Dates. Whitby's Providers panel attaches and
 * detaches firms, and its Dependencies panel is made of the edges the portal
 * is not sent, so neither is here.
 */
export default async function PlanStreamScreen({
  requestId,
  planId,
  streamId,
  searchParams,
}: {
  requestId: string;
  planId: string;
  streamId: string;
  searchParams: SearchParams;
}) {
  const [request, shared, context] = await Promise.all([
    getRequest(requestId),
    getRequestPlan(requestId, planId),
    getPortalContext(),
  ]);
  if (!request || !shared) notFound();

  const plan = toWhitbyPlan(shared, request.title);
  const position = plan.workstreams.findIndex((row) => row.id === streamId);
  const source = shared.streams.find((row) => row.id === streamId);
  if (position === -1 || !source) notFound();

  const stream = plan.workstreams[position]!;
  const viewParam = param(searchParams, "view") ?? "";
  const view = VIEWS.some((row) => row.slug === viewParam) ? viewParam : "";

  const planPath = `/client-portal/requests/${requestId}/plans/${planId}`;
  const here = `${planPath}/streams/${streamId}`;
  const done = stream.tasks.filter((task) => DONE.has(task.status.toLowerCase())).length;

  // Documents filed against a stream are Whitby's to count; the client's own
  // are on the Request's Documents tab. So the tile is not drawn (`clientView`)
  // rather than drawn at a zero that may not be true.
  const charts =
    view === "charts"
      ? computeStreamCharts({
          tasks: source.tasks.map((task) => ({
            status: task.status,
            waiting_state: task.waiting ? "waiting" : null,
            created_at: task.createdAt,
            completed_at: task.completedAt,
            kind: task.kind,
          })),
          targetDate: source.targetDate,
          documents: 0,
        })
      : null;

  return (
    <div className="px-4 pb-10 pt-5 sm:px-5 lg:px-6">
      {/* The breadcrumb says where you are; the arrow on the bar is how you
          leave, and it goes to the plan this stream is part of. */}
      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        <Link href={`/client-portal/requests/${requestId}`} className="no-underline" style={{ color: "inherit" }}>
          {request.title}
        </Link>
        {" / Work Plans / "}
        <Link href={planPath} className="no-underline" style={{ color: "var(--text-secondary)" }}>
          {plan.name}
        </Link>
      </div>

      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-4">
        {/* The stream's name is on the bar; what is left of the line it headed
            is where the stream stands. */}
        <div className="flex min-w-0 items-center gap-2.5">
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
                    ? { background: "var(--surface-active)", color: "var(--ink)", fontWeight: 600 }
                    : { color: "var(--text-secondary)", fontWeight: 500 }
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <p className="mb-5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {done} of {stream.tasks.length} task{stream.tasks.length === 1 ? "" : "s"} complete ·
        Work Stream {position + 1} of {plan.workstreams.length}
      </p>

      {stream.purpose ? (
        <p className="-mt-3 mb-5 max-w-[640px] text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {stream.purpose}
        </p>
      ) : null}

      <DataNotice context={context} />

      {view === "charts" ? (
        charts ? (
          <StreamChartsView charts={charts} clientView />
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
              <Kanban tasks={stream.tasks} />
            ) : view === "timeline" ? (
              <Timeline tasks={stream.tasks} />
            ) : (
              <Table tasks={stream.tasks} compact={view === ""} />
            )}
          </div>

          <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[260px]">
            <Panel title="Owner">
              {stream.ownerName ? (
                <span className="flex items-center gap-2">
                  <OwnerAvatar
                    name={stream.ownerName}
                    initials={stream.ownerInitials}
                    userId={null}
                    size={20}
                  />
                  {stream.ownerName}
                </span>
              ) : (
                <span style={{ color: "var(--text-tertiary)" }}>Nobody assigned yet</span>
              )}
            </Panel>

            <Panel title="Key Dates">
              {source.createdAt ? <div>Started {shortDate(source.createdAt)}</div> : null}
              {source.targetDate ? <div>Target {shortDate(source.targetDate)}</div> : null}
              {!source.createdAt && !source.targetDate ? (
                <span style={{ color: "var(--text-tertiary)" }}>No dates set yet</span>
              ) : null}
            </Panel>
          </aside>
        </div>
      )}
    </div>
  );
}

/* The three task views below are WP.17g–i's own, as Whitby's stream page draws
   them — already read-only there, so they are the same markup here. */

function Table({ tasks, compact }: { tasks: PlanTask[]; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-line">
      {!compact ? (
        <div
          className="grid grid-cols-[3fr_1.2fr_1.2fr_1fr] border-b border-line px-4 py-2.5 text-[11.5px] font-semibold"
          style={{ background: "var(--surface-soft)", color: "var(--text-tertiary)" }}
        >
          <span>Task</span>
          <span>Owner</span>
          <span>Status</span>
          <span>Due</span>
        </div>
      ) : null}

      {tasks.map((task) => {
        const complete = DONE.has(task.status.toLowerCase());
        return (
          <div
            key={task.id}
            className="grid grid-cols-[3fr_1.2fr_1.2fr_1fr] items-center border-b border-line px-4 py-3 text-[13.5px] last:border-b-0"
          >
            <span
              className="min-w-0 truncate pr-3"
              style={
                complete
                  ? { color: "var(--text-secondary)", textDecoration: "line-through" }
                  : undefined
              }
            >
              {task.title}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>{task.ownerName ?? "Unassigned"}</span>
            <span style={{ color: "var(--text-secondary)" }}>
              {complete ? "Complete" : task.status === "not_started" ? "Not Started" : "Running"}
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>
              {task.due_date ? shortDate(task.due_date) : "No date"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Kanban({ tasks }: { tasks: PlanTask[] }) {
  const columns = [
    { key: "not_started", label: "Not Started" },
    { key: "in_progress", label: "Running" },
    { key: "waiting", label: "Waiting" },
    { key: "complete", label: "Complete" },
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
            <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
              <span className="text-[12.5px] font-semibold">{column.label}</span>
              <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
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
                  <div key={task.id} className="rounded-card border border-line bg-surface px-3 py-2.5">
                    <div className="text-[13px] leading-[1.45]">{task.title}</div>
                    {task.due_date ? (
                      <div className="mt-1 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                        {shortDate(task.due_date)}
                      </div>
                    ) : null}
                  </div>
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

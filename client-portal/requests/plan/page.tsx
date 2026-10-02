import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import { getRequest } from "@/client-portal/lib/data/requests";
import { getRequestPlan } from "@/client-portal/lib/data/plans";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { param, type SearchParams } from "@/client-portal/lib/routing";
import { chartInput, toWhitbyPlan, trendRows } from "@/client-portal/lib/plan-view";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { computePlanCharts, computePlanTrends } from "@/whitbyos/lib/plan-math";
import { relativeTime, shortDate } from "@/whitbyos/lib/format";
// A plan's `target_date` is a `date` column — a day with no time and no zone.
// Whitby's `shortDate` reads it as midnight UTC and draws it in the reader's
// zone, which west of UTC turns "Sep 30" into "Sep 29"; the portal's reads it
// in UTC, where the day is the day. The Work Plans tab writes the same date
// with the same function, so the tab and this screen cannot disagree about
// when a plan is due.
import { shortDate as planDate } from "@/client-portal/lib/format";
import { TIMELINE_SCALES, type TimelineScale } from "@/whitbyos/lib/timeline";
import {
  KANBAN_GROUPS,
  KANBAN_SORTS,
  type KanbanGroup,
  type KanbanSort,
} from "@/whitbyos/lib/kanban";
import type { WorkPlanDetail } from "@/whitbyos/lib/work-plans";
import {
  PlanProgressBar,
  healthLabel,
  planStatusColour,
  planStatusLabel,
  urgencyLabel,
} from "@/whitbyos/work-plans/components/PlanMeters";
import {
  GridView,
  KanbanView,
  PLAN_VIEWS,
  TimelineView,
  ViewSwitch,
  type PlanView,
} from "@/whitbyos/work-plans/[id]/components/PlanViews";
import {
  ALL_COLUMNS,
  PlanTable,
  type ColumnKey,
  type TableOptions,
} from "@/whitbyos/work-plans/[id]/components/PlanTable";
import { ChartsView } from "@/whitbyos/work-plans/[id]/components/ChartsView";
import { GridRail, Panel, TableRail } from "@/whitbyos/work-plans/[id]/components/ViewRails";
import { PlanStreamList } from "./components/PlanStreamList";

/**
 * WP.17, as the client sees a plan the professional shared.
 *
 * The same screen at the same address shape — `/requests/<id>/plans/<planId>`
 * beside Whitby's `/work-plans/<id>` — with the same six views held in the same
 * `?view=` parameters, drawn by Whitby's own components in `clientView` mode.
 * The numbers come from `plan-math.ts`, which Whitby's charts use too. So the
 * client and their attaché looking at one plan see one plan.
 *
 * What is not here is what the professional works with rather than what the
 * work is: Save as Playbook, Export, Edit, visibility, Ask Whitby, the add and
 * remove controls, and the Dependencies and Considerations panels. Priorities,
 * checklists and dependencies never reach the portal (client-portal/014), so
 * the views that would draw them draw nothing in their place.
 */
export default async function PlanScreen({
  requestId,
  planId,
  searchParams,
}: {
  requestId: string;
  planId: string;
  searchParams: SearchParams;
}) {
  const [request, shared, context] = await Promise.all([
    getRequest(requestId),
    getRequestPlan(requestId, planId),
    getPortalContext(),
  ]);
  if (!request || !shared) notFound();

  const plan = toWhitbyPlan(shared, request.title);
  const requestPath = `/client-portal/requests/${requestId}`;
  const basePath = `${requestPath}/plans/${planId}`;

  const viewParam = param(searchParams, "view");
  const view = (PLAN_VIEWS.some((row) => row.slug === viewParam) ? viewParam : "list") as PlanView;

  const tscale = param(searchParams, "tscale");
  const timelineScale = (TIMELINE_SCALES.some((row) => row.value === tscale)
    ? tscale
    : "month") as TimelineScale;

  const kgroup = param(searchParams, "kgroup");
  const kanbanGroup = (KANBAN_GROUPS.some((row) => row.value === kgroup)
    ? kgroup
    : "status") as KanbanGroup;

  // Priorities are not sent to the portal, so a link asking to sort by one
  // sorts by due date — the board's own default.
  const ksort = param(searchParams, "ksort");
  const kanbanSort = (ksort !== "priority" && KANBAN_SORTS.some((row) => row.value === ksort)
    ? ksort
    : "due") as KanbanSort;

  const filter = param(searchParams, "filter") ?? "";
  const asked = (param(searchParams, "cols") ?? "").split(",").filter(Boolean);
  const kept = asked.filter((key): key is ColumnKey => (ALL_COLUMNS as string[]).includes(key));
  const table: TableOptions = {
    q: param(searchParams, "q") ?? "",
    group: param(searchParams, "group") !== "off",
    sort: param(searchParams, "sort") === "task" ? "task" : "due",
    filter: ["open", "done"].includes(filter) ? filter : "",
    columns: kept.length > 0 || asked.length > 0 ? kept : ALL_COLUMNS,
  };

  // Whitby fetches these only for the views that draw them; here they are
  // arithmetic over rows already read, so the rule is only about work.
  const charts = ["charts", "table", "grid"].includes(view)
    ? computePlanCharts(chartInput(shared))
    : null;
  const trends =
    view === "grid"
      ? computePlanTrends(
          shared.streams.map((stream) => stream.id),
          trendRows(shared),
        )
      : new Map<string, number[]>();

  return (
    <div className="px-4 pb-10 pt-5 sm:px-5 lg:px-6">
      {/* The breadcrumb stays: it names each step back, which a plan four
          levels down the portal needs said. The control that takes one is the
          arrow on the bar, and the plan's own name is up there beside it — so
          the heading that used to sit under this line has gone. */}
      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
        <Link href="/client-portal/requests" className="no-underline" style={{ color: "inherit" }}>
          Requests
        </Link>
        {" / "}
        <Link href={requestPath} className="no-underline" style={{ color: "inherit" }}>
          {request.title}
        </Link>
        {" / "}
        <Link href={`${requestPath}?tab=plans`} className="no-underline" style={{ color: "inherit" }}>
          Work Plans
        </Link>
        {" / "}
        <span style={{ color: "var(--ink)" }}>{plan.name}</span>
      </div>

      {plan.desired_outcome ? (
        <p
          className="mb-[18px] max-w-[640px] text-[13px] leading-[1.5]"
          style={{ color: "var(--text-secondary)" }}
        >
          {plan.desired_outcome}
        </p>
      ) : null}

      {/* WP.17's meta line for a running plan — a draft never reaches here. */}
      <div
        className="mb-[18px] flex flex-wrap items-center gap-2 text-[12.5px]"
        style={{ color: "var(--text-soft)" }}
      >
        <span style={{ color: planStatusColour(plan.status), fontWeight: 600 }}>
          {planStatusLabel(plan.status)}
        </span>
        {plan.target_date ? (
          <>
            <span>·</span>
            <span>Due {planDate(plan.target_date)}</span>
          </>
        ) : null}
        <span>·</span>
        <span>Urgency: {urgencyLabel(plan.urgency)}</span>
        <span>·</span>
        <span>{healthLabel(plan.health)}</span>
        {plan.approvalsWaiting > 0 ? (
          <span className="ml-1">
            <Pill tone="danger">
              {plan.approvalsWaiting} approval{plan.approvalsWaiting === 1 ? "" : "s"} pending
            </Pill>
          </span>
        ) : null}
      </div>

      <PlanProgressBar percent={plan.progress} done={plan.taskDone} total={plan.taskTotal} />

      <ViewSwitch basePath={basePath} active={view} />

      <DataNotice context={context} />

      {view === "charts" ? (
        charts ? (
          <ChartsView charts={charts} />
        ) : null
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="mb-3.5 text-[14px] font-semibold">
              Work Streams ({plan.workstreams.length})
            </div>

            {plan.workstreams.length === 0 ? (
              <div
                className="rounded-card border-2 border-dashed p-8 text-center text-[13px]"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-faint)" }}
              >
                Your team has not added any Work Streams to this plan yet.
              </div>
            ) : view === "table" ? (
              <PlanTable plan={plan} basePath={basePath} options={table} clientView />
            ) : view === "grid" ? (
              <GridView
                plan={plan}
                basePath={basePath}
                trends={trends}
                providers={new Map()}
                clientView
              />
            ) : view === "kanban" ? (
              <KanbanView
                plan={plan}
                basePath={basePath}
                group={kanbanGroup}
                sort={kanbanSort}
                clientView
              />
            ) : view === "timeline" ? (
              <TimelineView
                plan={plan}
                basePath={basePath}
                scale={timelineScale}
                showDependencies={false}
                expanded={(param(searchParams, "open") ?? "").split(",").filter(Boolean)}
                clientView
              />
            ) : (
              <PlanStreamList
                streams={plan.workstreams}
                basePath={basePath}
                tick={context.viewOnly ? undefined : { requestId, returnTo: basePath }}
              />
            )}
          </div>

          {view === "table" ? (
            <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[280px]">
              <TableRail plan={plan} charts={charts} basePath={basePath} />
            </aside>
          ) : view === "grid" ? (
            <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[280px]">
              <GridRail plan={plan} charts={charts} basePath={basePath} />
            </aside>
          ) : view === "list" ? (
            <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[280px]">
              <ListRail plan={plan} requestPath={requestPath} />
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * WP.17's List rail, as far as it is the client's: Key Dates, who owns the
 * plan and what is waiting on approval, and the Request it belongs to. Whitby's
 * Dependencies and Considerations panels are the team's working notes and are
 * not drawn; its Linked counts of documents, worksheets and providers are left
 * out because the client's own Documents tab is the honest count for them.
 */
function ListRail({ plan, requestPath }: { plan: WorkPlanDetail; requestPath: string }) {
  return (
    <>
      <Panel title="Key Dates">
        <span>Created {shortDate(plan.created_at)}</span>
        {plan.target_date ? <span>Target completion {planDate(plan.target_date)}</span> : null}
        <span>Last updated {relativeTime(plan.updated_at)}</span>
      </Panel>

      <Panel title="Contacts & Approvals">
        <span>{plan.ownerName}, Owner</span>
        {plan.approvalsWaiting > 0 ? (
          <span style={{ color: "var(--warning-fg)" }}>
            {plan.approvalsWaiting} approval{plan.approvalsWaiting === 1 ? "" : "s"} waiting
          </span>
        ) : (
          <span>No approvals waiting</span>
        )}
      </Panel>

      <Panel title="Linked">
        <Link href={requestPath} className="no-underline" style={{ color: "var(--accent)" }}>
          Request: {plan.request_title}
        </Link>
      </Panel>
    </>
  );
}

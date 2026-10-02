import { notFound } from "next/navigation";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { getRequest } from "@/client-portal/lib/data/requests";
import { listUpdates } from "@/client-portal/lib/data/updates";
import { listActionItems } from "@/client-portal/lib/data/home";
import { listForms } from "@/client-portal/lib/data/forms";
import { listDocuments } from "@/client-portal/lib/data/documents";
import { listCalendar } from "@/client-portal/lib/data/calendar";
import { listTasks, filterTasksByRequest, toTaskStatus } from "@/client-portal/lib/data/tasks";
import { listRequestPlans } from "@/client-portal/lib/data/plans";
import { getRequestExtras } from "@/client-portal/lib/data/request-detail";
import { planTotals } from "@/client-portal/lib/plan-view";
import { REQUEST_STATUS } from "@/client-portal/lib/status";
import { healthView, urgencyView } from "@/client-portal/lib/vocab";
import { tabParam, type SearchParams } from "@/client-portal/lib/routing";
import { PageBody } from "@/client-portal/components/PageHeader";
import { SubNav } from "@/client-portal/components/SubNav";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { UpdateFeed } from "@/client-portal/components/UpdateFeed";
import { ListPanel } from "@/client-portal/components/Panel";
import type { PortalPlan, PortalTask } from "@/client-portal/types";
import { RequestTabPanel, type RequestTaskRow } from "./components/RequestTabPanel";
import { RequestOverview } from "./components/RequestOverview";
import { RequestFacts } from "./components/RequestFacts";
import { WorkSummary } from "./components/WorkSummary";
import { OverviewFold } from "./components/OverviewFold";

/**
 * Whitby's Request tabs first, in Whitby's order — Overview, Tasks, Notes,
 * Documents, Work Plans, Forms (3.3o–3.3f) — then the two the portal has and
 * Whitby does not. Whitby's Providers tab is absent: nothing in Whitby can
 * share a provider option with a client yet (see `RequestOverview`).
 *
 * WORK PLANS, AND WHAT IT IS NOT
 *
 * This tab was removed once, and for a fair reason: it was a list of links —
 * a plan's name, a task count, an arrow — and on a real account it was usually
 * a standing "No work plan shared yet" next to a Forms tab holding the very
 * thing it said had not been shared. A plan reaches a client as a Work Plan
 * only when the professional ticks "Share this Work Plan with the client" on
 * WP.17v; what a plan sends them in the ordinary course is its client ask, and
 * `shareClientAsk` delivers that as a form submission — `event:
 * "form_requested"`, `area: "forms"` — so it arrives under Forms.
 *
 * What was wrong with it was the list, not the tab. The plan itself is drawn
 * here now — WP.17's meta line, its progress meter and its Work Streams — out
 * of Whitby's own components, with the five other views a link away on
 * `/requests/<id>/plans/<planId>`, which draws them in `clientView` mode. That
 * screen already existed and nothing reached it; its own "Back to Work Plans"
 * pointed at `?tab=plans`, which is this.
 *
 * The tab is still shown when nothing has been shared, because a client
 * reading a Request should be able to see that the plan is a thing their team
 * can share rather than a thing the portal does not have.
 */
const TABS = [
  "overview",
  "tasks",
  "notes",
  "documents",
  "plans",
  "forms",
  "updates",
  "calendar",
] as const;

const LABELS: Record<(typeof TABS)[number], string> = {
  overview: "Overview",
  tasks: "Tasks",
  notes: "Notes",
  documents: "Documents",
  plans: "Work Plans",
  forms: "Forms",
  updates: "Progress Updates",
  calendar: "Calendar",
};

/**
 * The client-safe Request view (SRS 13.11), laid out as Whitby lays out the
 * same Request.
 *
 * Everything internal — Considerations, internal Notes, provider research and
 * scoring, risks, internal-only Tasks, any Work Plan nobody shared — is absent
 * because nothing here queries for it, not because it is filtered out
 * downstream. What is here arrives by one of four explicit acts of the
 * professional, each read through a path that returns nothing else:
 *
 *   - a Task marked client-visible (SRS 7.1.5) — `listTasks()`
 *   - a Work Plan shared on WP.17v — `listRequestPlans()`, client-portal/014
 *   - a Note marked Visible to the client — `getRequestExtras()`, same file
 *   - the people named on the Request, by name and role only — the same
 */
export default async function RequestDetailScreen({
  requestId,
  searchParams,
}: {
  requestId: string;
  searchParams: SearchParams;
}) {
  const tab = tabParam(searchParams, TABS, "overview");
  const request = await getRequest(requestId);
  if (!request) notFound();

  const [context, updates, actions, forms, documents, calendar, tasks, plans, extras] =
    await Promise.all([
      getPortalContext(),
      listUpdates(),
      listActionItems(),
      listForms(),
      listDocuments(),
      listCalendar(),
      listTasks(),
      listRequestPlans(requestId),
      getRequestExtras(requestId),
    ]);

  const base = `/client-portal/requests/${requestId}`;

  // Everything on this screen is selected by Request id, never by title: two
  // Requests can share a title, and a Task named to the account rather than to
  // a Request carries the context "General" and matches no title at all.
  const scopedUpdates = updates.filter((item) => item.requestId === requestId);
  const scopedActions = actions.filter((item) => item.requestId === requestId);
  const scopedDocuments = documents.filter((doc) => doc.requestId === requestId);
  const scopedForms = forms.filter((form) => form.requestId === requestId);
  const scopedTasks = filterTasksByRequest(tasks, requestId);
  const scopedCalendar = calendar.filter((item) => item.requestId === requestId);
  const taskRows = requestTaskRows(scopedTasks, plans, extras.taskOwners);
  const openTasks = taskRows.filter((task) => task.status !== "completed").length;

  // Whitby's "Step 3 of 7" counts the tasks across a Request's plans. The
  // portal counts the plans it was shown, which are the ones on the Work Plans
  // tab — so the number is one the client can check.
  const steps = planTotals(plans);
  const completed = request.status === "completed";

  // A Request's own target date first. Many are set on the Work Plan instead,
  // and a shared plan's date is one the client can already read on the Work
  // Plans tab — so "Not set" above a plan that says "Due Oct 3" was the screen
  // contradicting itself. The latest shared plan's date stands in, labelled.
  const planTarget =
    plans
      .map((plan) => plan.targetDate)
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1) ?? null;
  const targetDate = request.targetDate ?? planTarget;

  /** What is behind each tab, so none of them has to be opened to find out. */
  const TAB_COUNTS: Record<(typeof TABS)[number], number | undefined> = {
    overview: scopedActions.length || undefined,
    tasks: openTasks || undefined,
    notes: extras.notes.length || undefined,
    documents: scopedDocuments.length || undefined,
    plans: plans.length || undefined,
    forms: scopedForms.length || undefined,
    updates: scopedUpdates.length || undefined,
    calendar: scopedCalendar.length || undefined,
  };

  const status = REQUEST_STATUS[request.status];
  const urgency = urgencyView(request.urgency);
  const health = healthView(request.health);

  return (
    <PageBody>
      {/*
       * The request's name and the way back off it are both on the bar — see
       * `lib/page-title.ts`. Together they were a line of link, a line of
       * heading and 40px of air before anything about the request itself; what
       * is left is what the heading was standing in front of, which is where it
       * stands, how urgent it is, and how it is going.
       *
       * That summary is the Overview's. On any other tab it folds away and
       * the tabs rise into its place — see `OverviewFold`.
       */}
      <OverviewFold id={requestId} open={tab === "overview"}>
        <RequestFacts
          status={status.label}
          statusTone={status.tone}
          steps={steps}
          urgency={urgency}
          health={health}
          progress={
            completed
              ? 100
              : steps.total > 0
                ? Math.round((steps.done / steps.total) * 100)
                : request.progress
          }
          taskCount={steps.total > 0 ? steps.total : scopedTasks.length}
          targetDate={targetDate}
          targetFromPlan={!request.targetDate && Boolean(planTarget)}
          closedAt={request.closedAt}
          needsYou={scopedActions.length}
          nextStep={request.nextStep}
          waitingOn={request.waitingOn}
          timeZone={context.timezone}
        />

        {request.description ? (
          <p
            className="mb-4 max-w-[680px] text-[13.5px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {request.description}
          </p>
        ) : null}
      </OverviewFold>

      {/* Whitby puts the closing summary above the tabs, where it is read
          whichever tab is open. */}
      <WorkSummary
        summary={request.workSummary}
        closedAt={request.closedAt}
        timeZone={context.timezone}
      />

      {/*
       * Every tab counted, not just Overview.
       *
       * Eight tabs of which six are usually empty is eight navigations to find
       * that out, and a client who opens Documents, Forms and Notes in turn to
       * be told "nothing here" three times has learnt only that the screen
       * would not tell them. The numbers were on the server before the page was
       * sent. Overview's is drawn in red because it is the only one that counts
       * things waiting on the reader rather than things that exist.
       */}
      <SubNav
        active={tab}
        items={TABS.map((key) => ({
          key,
          label: LABELS[key],
          href: key === "overview" ? base : `${base}?tab=${key}`,
          count: TAB_COUNTS[key],
          countTone: key === "overview" ? "danger" : "warning",
        }))}
      />
      <DataNotice context={context} />

      {/* Keyed on the tab, so each one settles in as it arrives. */}
      <div key={tab} className="pa-panel-in">
        {tab === "overview" ? (
          <RequestOverview
            requestId={requestId}
            tasks={taskRows}
            canTick={!context.viewOnly}
            actions={scopedActions}
            calendar={scopedCalendar}
            documents={scopedDocuments}
            extras={extras}
            targetDate={targetDate}
            closedAt={request.closedAt}
            accountName={context.accountName}
            timeZone={context.timezone}
          />
        ) : tab === "updates" ? (
          // The same panel the Updates screen draws, with nothing to filter:
          // this tab is one request's feed, and the request is the filter.
          <ListPanel>
            <UpdateFeed
              updates={scopedUpdates}
              showRequest={false}
              emptyTitle="No updates on this request yet"
              emptyBody="Your team will post here as the work moves forward."
            />
          </ListPanel>
        ) : (
          <RequestTabPanel
            tab={tab}
            requestId={requestId}
            tasks={taskRows}
            canTick={!context.viewOnly}
            notes={extras.notes}
            plans={plans}
            requestTitle={request.title}
            forms={scopedForms}
            documents={scopedDocuments}
            calendar={calendar}
            timeZone={context.timezone}
          />
        )}
      </div>
    </PageBody>
  );
}

/**
 * The Tasks tab's rows: the Request's client-visible tasks, then every task in
 * a shared plan that is not already among them.
 *
 * Whitby's 3.3t lists every task on the Request. The client's version is the
 * part of that list they were given, and a task that is both client-visible and
 * in a shared plan is one task, listed once.
 */
function requestTaskRows(
  shared: PortalTask[],
  plans: PortalPlan[],
  owners: Record<string, string>,
): RequestTaskRow[] {
  const rows: RequestTaskRow[] = shared.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dueAt: task.dueAt,
    completedAt: task.completedAt,
    ownerName: owners[task.id] ?? null,
    planName: null,
    // These are the rows `listTasks()` returned, which is exactly what
    // `setTaskDone` authorises against — so these, and only these, carry the
    // client's own tick.
    canComplete: true,
  }));

  const seen = new Map(rows.map((row) => [row.id, row]));

  for (const plan of plans) {
    for (const stream of plan.streams) {
      for (const task of stream.tasks) {
        const existing = seen.get(task.id);
        if (existing) {
          existing.planName = plan.name;
          existing.ownerName = existing.ownerName ?? task.ownerName;
          continue;
        }
        const row: RequestTaskRow = {
          id: task.id,
          title: task.title,
          status: toTaskStatus(task.status),
          dueAt: task.dueAt,
          completedAt: task.completedAt,
          ownerName: task.ownerName,
          planName: plan.name,
          // A task in a shared plan is the client's to tick as well
          // (client-portal/023): `setTaskDone` finds it in this same plan read.
          canComplete: true,
        };
        rows.push(row);
        seen.set(row.id, row);
      }
    }
  }

  return rows;
}

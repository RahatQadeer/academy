import Link from "next/link";
import { BackLink } from "@/whitbyos/components/BackLink";
import { notFound } from "next/navigation";
import { StillDrafting } from "@/whitbyos/work-plans/components/StillDrafting";
import { PlanQuestions } from "@/whitbyos/work-plans/components/PlanQuestions";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { Pill } from "@/base/components/Pill";
import { StatusPill } from "@/whitbyos/components/StatusPill";
import { DarkToast, Toast } from "@/whitbyos/components/Toast";
import { ExportDialog } from "@/whitbyos/work-plans/[id]/components/ExportDialog";
import { exportQuery, readExportOptions } from "@/whitbyos/lib/plan-export";
import { getCurrentWorkspaceName } from "@/whitbyos/lib/workspace";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import {
  HealthPill,
  PlanProgressBar,
  healthLabel,
  planStatusColour,
  planStatusLabel,
  urgencyLabel,
} from "@/whitbyos/work-plans/components/PlanMeters";
import { WorkStreamList } from "@/whitbyos/work-plans/[id]/components/WorkStreamList";
import {
  researchPlanAgain,
  savePlanAsPlaybook,
  savePlanVisibility,
  saveStreamVisibility,
} from "@/whitbyos/work-plans/actions";
import {
  GridView,
  KanbanView,
  PLAN_VIEWS,
  TimelineView,
  ViewSwitch,
  type PlanView,
} from "@/whitbyos/work-plans/[id]/components/PlanViews";
import { TIMELINE_SCALES, type TimelineScale } from "@/whitbyos/lib/timeline";
import {
  KANBAN_GROUPS,
  KANBAN_SORTS,
  type KanbanGroup,
  type KanbanSort,
} from "@/whitbyos/lib/kanban";
import { GridRail, TableRail } from "@/whitbyos/work-plans/[id]/components/ViewRails";
import { AskWhitbyDock } from "@/whitbyos/work-plans/[id]/components/AskWhitbyDock";
import { whitbySuggestions } from "@/whitbyos/lib/whitby-suggestions";
import { FeasibilityBanner } from "@/whitbyos/work-plans/[id]/components/FeasibilityBanner";
import { RisksPanel } from "@/whitbyos/work-plans/[id]/components/RisksPanel";
import { ConsiderationsPanel } from "@/whitbyos/work-plans/[id]/components/ConsiderationsPanel";
import { NoticedTabs } from "@/whitbyos/work-plans/[id]/components/NoticedSection";
import { DependenciesPanel } from "@/whitbyos/work-plans/[id]/components/DependenciesPanel";
import { ContactsPanel, EmergencyStrip, planResources } from "@/whitbyos/work-plans/[id]/components/ContactsPanel";
import { PlanEditMode } from "@/whitbyos/work-plans/[id]/components/PlanEditMode";
import { ALL_COLUMNS, PlanTable, type ColumnKey, type TableOptions } from "@/whitbyos/work-plans/[id]/components/PlanTable";
import { ChartsView } from "@/whitbyos/work-plans/[id]/components/ChartsView";
import { ConfirmRemoveDialog } from "@/whitbyos/work-plans/[id]/components/ConfirmRemoveDialog";
import { EditPlanDialog } from "@/whitbyos/work-plans/[id]/components/EditPlanDialog";
import { EditTaskDialog } from "@/whitbyos/work-plans/[id]/components/EditTaskDialog";
import { EditWorkstreamDialog } from "@/whitbyos/work-plans/[id]/components/EditWorkstreamDialog";
import { VisibilityDialog } from "@/whitbyos/work-plans/[id]/components/VisibilityDialog";
import {
  readPlanClientShare,
  readPlanVisibility,
  readStreamVisibility,
  type ClientShare,
} from "@/whitbyos/lib/plan-visibility";
import {
  getPlanCharts,
  getPlanTrends,
  listStreamProviders,
  getTaskEdit,
  getWorkPlan,
  listDependencyOptions,
  getWorkstreamEdit,
  listAssignees,
  type StreamProvider,
} from "@/whitbyos/lib/work-plans";
import { removeTask, removeWorkstream, saveScratchPlan } from "@/whitbyos/work-plans/actions";
import { relativeTime, shortDate } from "@/whitbyos/lib/format";
import { listRefineTurns } from "@/whitbyos/lib/workplan";
import { getClientAsk } from "@/whitbyos/lib/client-ask";
import { answeredNeeds, clientNeeds, firmNeeds } from "@/whitbyos/lib/plan-requirements";
import {
  WhitbyDidThis,
  whitbyCanStart,
  whitbyDrafts,
} from "@/whitbyos/work-plans/[id]/components/WhitbyDidThis";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** WP.17 — a Work Plan, its Work Streams, and what it is linked to. */
export default async function WorkPlanDetailPage({
  planId,
  searchParams,
}: {
  planId: string;
  searchParams?: SearchParams;
}) {
  const plan = await getWorkPlan(planId);
  if (!plan) notFound();
  const showClients = await usesClientWorkspaces();

  /*
   * A plan that is still being written has nothing to show yet — 097.
   *
   * Everything below reads Work Streams, tasks, charts and panels off a plan
   * that has none of them for another minute or two. One sentence instead,
   * and the professional gets on with something else while the drafting runs
   * behind them.
   *
   * A draft that failed says so rather than looking unfinished forever; that
   * is the only other state this branch handles, because a plan that was
   * never drafted has no drafting state at all.
   */
  /* "No client" is what the read gives for a plan with none; it is a
     sentence's worth of nothing, not a name. */
  const draftingFor =
    showClients && plan.client_name !== "No client" ? plan.client_name : null;

  /*
   * Whitby asks before it drafts.
   *
   * Two moments live in this one state. First the questions are being
   * worked out, which is a short model call and shows the same waiting
   * screen the drafting does; then they arrive and the screen becomes the
   * questions. `StillDrafting` refreshes the route every few seconds, so
   * the second replaces the first without anybody pressing anything.
   *
   * A description that raised nothing to ask never lands here: it moves
   * itself on to `drafting` and this branch is not reached.
   */
  if (plan.draftingState === "asking") {
    return plan.draftingQuestions.length > 0 ? (
      <PlanQuestions
        planId={plan.id}
        planName={plan.name}
        clientName={draftingFor}
        questions={plan.draftingQuestions}
        saved={plan.draftingAnswers}
      />
    ) : (
      <StillDrafting planName={plan.name} clientName={draftingFor} />
    );
  }

  if (plan.draftingState === "drafting") {
    return <StillDrafting planName={plan.name} clientName={draftingFor} />;
  }

  /* A draft that did not survive says so here rather than opening as a plan
     with nothing in it and no explanation. */
  if (plan.draftingState === "failed" && plan.workstreams.length === 0) {
    return (
      <StateMessage
        glyph="!"
        tone="danger"
        title="This plan could not be drafted"
        description={
          plan.draftingError ??
          "The drafting stopped before anything was written. Nothing was saved to the plan."
        }
        action={
          <Link
            href="/whitbyos/work-plans/new"
            className="rounded-control px-4 py-[9px] text-[13.5px] font-semibold no-underline"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Start another plan
          </Link>
        }
      />
    );
  }

  // What the client has been asked for and what has come back. Null until
  // somebody presses the button, which is also how the panel knows to say
  // "not asked" rather than "waiting".
  const {
    ask: clientAsk,
    edits: clientAskEdits,
    proposals: clientAskProposals,
  } = await getClientAsk(planId);

  /*
   * How many things the client still owes, for the card on the rail.
   *
   * Counted here rather than inside the card so the card is a card: the
   * same read the checklist screen does, minus whatever has come back.
   */
  const needs = clientNeeds(plan.workstreams, clientAskEdits);
  /* The professional's own half of the same question. Unlike the client's it
     needs no edits and no ask: nothing here is sent anywhere. */
  const yours = firmNeeds(plan.workstreams);
  /* The third argument, for the same reason the panel passes it: a
     suggestion sits in the answer box from the moment it goes out, and
     without this the rail would count the firm's own words as the client's
     and say nothing was outstanding. */
  const answered = answeredNeeds(needs, clientAsk?.responses, {
    proposals: clientAskProposals,
    submitted: Boolean(clientAsk?.submittedAt),
  });
  const stillNeeded = needs.filter((need) => !answered.has(need.slug)).length;

  const basePath = `/whitbyos/work-plans/${plan.id}`;
  const draft = String(plan.status).toLowerCase() === "draft";
  const taskParam = one(searchParams?.task);
  const streamParam = one(searchParams?.stream);
  const error = one(searchParams?.error);
  const editing = one(searchParams?.edit) === "1";
  // WP.15 — the same screen inside the Create Work Plan frame, before the plan
  // has been adopted. WP.16 is this with the saved toast on top.
  const wizard = one(searchParams?.wizard) === "scratch";
  const justSaved = one(searchParams?.saved) === "1";
  /**
   * WP.11 and WP.14 — the same screen as Step 4 of Create Work Plan, before
   * the plan has been adopted.
   *
   * It is a URL mode, not a status, for the reason WP.15 is: a draft reached
   * from the Work Plans list is WP.17's screen, and the same draft reached
   * straight out of the generator is the wizard's last step. The origin rides
   * along because the reference names it — "Imported · Relocation_Checklist.
   * xlsx" — and nothing on the plan records where it came from.
   */
  // WP.22 collects the export's options; WP.23 is the toast it comes back to,
  // whose Download link carries the same answers on to WP.24.
  const exporting = one(searchParams?.export) === "1";
  const exported = one(searchParams?.exported) === "1";
  const exportOptions = readExportOptions(searchParams);
  const review = REVIEW_ORIGINS.find((origin) => origin === one(searchParams?.review));
  const reviewSource = one(searchParams?.from) ?? "";

  const viewParam = one(searchParams?.view);
  const view = (PLAN_VIEWS.some((row) => row.slug === viewParam) ? viewParam : "list") as PlanView;
  const removing = one(searchParams?.remove) === "1";
  // WP.17e's own controls: the scale, the dependency overlay and which streams
  // are opened out into their tasks.
  const timelineScale = (TIMELINE_SCALES.some((row) => row.value === one(searchParams?.tscale))
    ? one(searchParams?.tscale)
    : "month") as TimelineScale;
  // WP.17d's Group by and sort, held in the URL like every other view's controls.
  const kanbanGroup = (KANBAN_GROUPS.some((row) => row.value === one(searchParams?.kgroup))
    ? one(searchParams?.kgroup)
    : "status") as KanbanGroup;
  const kanbanSort = (KANBAN_SORTS.some((row) => row.value === one(searchParams?.ksort))
    ? one(searchParams?.ksort)
    : "manual") as KanbanSort;
  /**
   * WP.17v and WP.17u — the two visibility modals.
   *
   * `vstream` rather than the `stream` the edit dialog already uses: one id in
   * the URL cannot mean "edit this stream" and "who can see this stream" at
   * once, and reusing it would open both dialogs over each other.
   */
  const visibility = one(searchParams?.visibility) ?? "";
  const visibilityStreamId = one(searchParams?.vstream) ?? "";
  const structureEditing = one(searchParams?.editing) === "1";
  /**
   * WP.6c — the Ask Whitby panel, which is a mode rather than a status.
   *
   * The reference shows it on WP.6c (a running plan reached from "Edit with
   * Whitby"), and on WP.11, WP.14 and WP.16 — the screens you land on straight
   * after Whitby built or saved something. It does not show on WP.15, which is
   * a draft still inside the wizard, nor on WP.7, WP.17, WP.20 or WP.21.
   *
   * So: on every Review & Edit screen, and otherwise only where the URL asks
   * for it. Checked against the export — WP.6, WP.11, WP.14 and WP.16 carry
   * the panel; WP.15 and WP.17 do not.
   */
  const askWhitby = one(searchParams?.whitby) === "1" || Boolean(review);

  // WP.18 takes precedence: "?task=new&stream=<id>" is Add Task filed under
  // that stream, not the Work Stream dialog.
  const dialog = await resolveDialog(plan, taskParam, streamParam);

  // WP.17v and WP.17u read the team, so they are only fetched when one of the
  // two modals is actually open.
  const planViewers = visibility === "plan" ? await readPlanVisibility(plan.id) : null;
  const streamViewers =
    visibility === "stream" && visibilityStreamId
      ? await readStreamVisibility(plan.id, visibilityStreamId)
      : null;

  // One small read on every visit: a plan the client can see is worth knowing
  // about before anybody types into it.
  const clientShare = await readPlanClientShare(plan.id);

  // Only for the Charts tab: it reads three fields no other view shows, and a
  // visit to WP.17 should not pay for a tab it is not looking at.
  // The Charts view draws all of them; the Table's and Grid's rails draw a few
  // of the same figures, so they are fetched for those two as well.
  const charts = ["charts", "table", "grid"].includes(view) ? await getPlanCharts(plan.id) : null;
  // One query for every card on the Grid, not one per card.
  const trends = view === "grid" ? await getPlanTrends(plan.id) : new Map<string, number[]>();
  // WP.17c names each stream's provider on its card.
  const providers =
    view === "grid"
      ? await listStreamProviders(plan.workstreams.map((stream) => stream.id))
      : new Map<string, StreamProvider[]>();

  // Everywhere this plan sends somebody, gathered off the tasks already in
  // hand. No query: Whitby wrote these onto the steps when it drafted them.
  const contacts = planResources(plan.workstreams.flatMap((stream) => stream.tasks));

  /**
   * What the last "Look it up again" did.
   *
   * The action redirects with this and nothing read it, so pressing the button
   * reloaded the page and said nothing — and on a lookup that failed a second
   * time, the banner simply stayed where it was, which is indistinguishable
   * from the press not having registered.
   */
  const lookup = one(searchParams?.lookup);

  // "Show all" belongs in the URL: somebody who opened the rest and then
  // ticked a task off should still be looking at the rest.
  const showAllNoticed = one(searchParams?.all) === "1";

  // "+ New chat" puts the exchanges away; they are the plan's version history
  // and are still there, just not in front of the box.
  const fresh = one(searchParams?.fresh) === "1";

  /**
   * The kinds of outside firm this plan needs and the workspace has nobody
   * for, each named once however many tasks want one.
   */
  const providersNeeded = [
    ...new Set(
      plan.workstreams
        .flatMap((stream) => stream.tasks)
        .map((task) => task.providerNeed?.category)
        .filter((category): category is string => Boolean(category)),
    ),
  ];

  const providersUsed = new Set(
    plan.workstreams
      .flatMap((stream) => stream.tasks)
      .map((task) => task.providerId)
      .filter(Boolean),
  ).size;

  // WP.11 and WP.14 put Ask Whitby at the top of a draft's rail; a running
  // plan is past the point of being redrafted in a sentence.
  // Read whether or not the panel is open: it opens locally now, so waiting
  // for a round trip at that moment is exactly what this change removed.
  const turns = await listRefineTurns(plan.id);
  /*
   * The plan's own Whitby, declared once.
   *
   * It sat beside List / Table / Grid, which are six ways of looking at the
   * same thing, and this is the one control on the screen that rewrites
   * what you are looking at. It stands with Add Work Stream and Edit now,
   * which is what it does when you use it — and Charts, the one view with
   * no such row, renders this same element rather than a second copy.
   *
   * This is not the Whitby in the corner of every page. That one knows
   * which plan it is on and will make a task against it, but it cannot
   * rewrite a plan. Two controls, one name; still to be settled.
   */
  const askWhitbyDock = (
    <AskWhitbyDock
      requestId={plan.request_id}
      /* So "create a task" from this panel lands on this plan rather than
         opening a new one. */
      planId={plan.id}
      planName={plan.name}
      turns={fresh ? [] : turns}
      suggestions={whitbySuggestions(plan)}
      returnTo={`${basePath}?whitby=1`}
      closeHref={basePath}
      freshHref={`${basePath}?whitby=1&fresh=1`}
      error={error}
      initiallyOpen={askWhitby}
    />
  );


  // Only WP.22 names the workspace, and it is already on the session.
  const letterhead = exporting ? await getCurrentWorkspaceName() : "";

  // WP.17b's toolbar keeps what it is set to in the URL, so a view someone
  // arranged survives a refresh and can be handed to somebody else.
  const sortParam = one(searchParams?.sort);
  const table: TableOptions = {
    q: one(searchParams?.q) ?? "",
    group: one(searchParams?.group) !== "off",
    sort: sortParam === "task" ? "task" : "due",
    filter: ["open", "done"].includes(one(searchParams?.filter) ?? "")
      ? (one(searchParams?.filter) as string)
      : "",
    columns: (() => {
      const asked = (one(searchParams?.cols) ?? "").split(",").filter(Boolean);
      const kept = asked.filter((key): key is ColumnKey =>
        (ALL_COLUMNS as string[]).includes(key),
      );
      // Nothing asked for means everything, which is the table's own default.
      return kept.length > 0 || asked.length > 0 ? kept : ALL_COLUMNS;
    })(),
  };

  const body = (
    <div
      className={
        wizard || review
          ? "relative px-5 py-7 sm:px-8 xl:px-12"
          : "relative px-5 py-9 sm:px-8 xl:px-12"
      }
      data-pa-workplan-page
    >
      {/* Not while the wizard is still walking somebody through it: that has
          its own Back, one step rather than all the way out. */}
      {wizard || review ? null : (
        <BackLink href="/whitbyos/work-plans" label="Back to Work Plans" />
      )}

      {/*
       * A plan with no client says nothing about clients.
       *
       * This read "No client / Work Plans / TEST 5" on the firm's own work,
       * which is a label announcing an absence. Whose a plan is should be
       * read off what the plan has on it, not off a line saying what it has
       * not: no client in the trail, no checklist card on the rail, no
       * client switch in its visibility.
       */}
      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
        {showClients && plan.client_id ? (
          <>
            {plan.client_name}
            {" / "}
          </>
        ) : null}
        <Link href="/whitbyos/work-plans" className="no-underline" style={{ color: "inherit" }}>
          Work Plans
        </Link>
        {" / "}
        <span style={{ color: "var(--ink)" }}>{plan.name}</span>
      </div>

      {/*
        The head of the page, on white like everything else on it.
        It sat on the page's own grey while the summary, the streams and the
        rail below it were all white cards — so the one block that says what
        this plan is read as the gap above the page rather than as part of it.
        Tight under it, because the pills and the bar are the rest of the same
        sentence.
      */}
      <div
        data-pa-workplan-header
        className="mb-3 rounded-card border border-line bg-surface p-4"
        style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
      >
        {/*
          Title and Save / Export on one row at desktop — where they lived
          before. Narrow screens stack the actions under the name; wide ones
          keep them up on the right.
        */}
        <div
          className={
            structureEditing
              ? "min-w-0"
              : "flex flex-col gap-3 sm:gap-3.5 lg:flex-row lg:items-start lg:justify-between lg:gap-6"
          }
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <h1 className="min-w-0 break-words text-[20px] font-bold leading-[1.3] tracking-[-0.02em] sm:text-[23px]">
                {plan.name}, Work Plan
              </h1>
              <Link
                href={`${basePath}?edit=1`}
                scroll={false}
                aria-label="Edit this plan's name, outcome and dates"
                title="Edit this plan's name, outcome and dates"
                className="shrink-0 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium no-underline"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                Edit
              </Link>
              {plan.archived_at ? <Pill tone="warning">Archived</Pill> : null}
              {clientShare?.sharedAt ? <Pill tone="accent">Shared with client</Pill> : null}
              {wizard ? <Pill tone="accent">Manual</Pill> : null}
              {review ? <Pill tone="accent">{originPill(review, reviewSource)}</Pill> : null}
            </div>
          </div>

          {!structureEditing ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
              {/* A plain anchor, not a Link: client-side navigation cannot hand
                  back a file, and the route answers with an attachment. */}
              {wizard || review ? (
                <>
                  {/* WP.11 and WP.14 keep Export beside Save — a plan can be sent
                      for a second opinion before it is adopted. WP.15's scratch
                      draft does not, and neither does this. */}
                  {review ? (
                    <Link
                      /* The options dialog, the same as the header's own Export
                         PDF. This used to open the preview page instead, so the
                         same word meant two different things on two screens, and
                         the one reached from review needed two more presses to
                         produce a file. */
                      href={`${basePath}?export=1`}
                      scroll={false}
                      className="inline-flex items-center justify-center gap-1.5 rounded-control border border-line-strong bg-transparent px-4 py-[9px] text-[13.5px] font-medium no-underline transition-colors hover:bg-surface-soft"
                      style={{ color: "var(--ink)" }}
                    >
                      ↓ Export PDF
                    </Link>
                  ) : null}

                  <form action={saveScratchPlan}>
                    <input type="hidden" name="plan_id" value={plan.id} />
                    <Submit unsized variant="primary" className="px-4 py-[9px] text-[13.5px]">
                      Save Work Plan
                    </Submit>
                  </form>
                </>
              ) : (
                <>
                  {/* A draft reached from the Work Plans list rather than from the
                      wizard still has to be adoptable. Without this the only route
                      to "active" is the review step, and a draft anyone navigated
                      away from is stranded, §6.4.13 has a plan go live because the
                      professional adopts it, and this is where they are. */}
                  {draft ? (
                    <form action={saveScratchPlan}>
                      <input type="hidden" name="plan_id" value={plan.id} />
                      <Submit
                        unsized
                        variant="primary"
                        className="px-4 py-[9px] text-[13.5px]"
                      >
                        Save Work Plan
                      </Submit>
                    </form>
                  ) : null}

                  {/* WP.17c — the other direction from building one from a Playbook:
                      a plan that worked becomes the shape for the next. */}
                  <form action={savePlanAsPlaybook}>
                    <input type="hidden" name="plan_id" value={plan.id} />
                    <SubmitPlain
                      className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium"
                      style={{ background: "var(--surface)", color: "var(--ink)" }}
                    >
                      Save as Playbook
                    </SubmitPlain>
                  </form>

                  {/* WP.22 — the options first. The document itself is WP.24,
                      which the browser turns into the PDF; the Markdown file is
                      one press further, from the preview's own bar. */}
                  <Link
                    href={`${basePath}?export=1`}
                    scroll={false}
                    className="inline-flex items-center justify-center gap-1.5 rounded-control border border-line-strong bg-transparent px-4 py-[9px] text-[13.5px] font-medium no-underline transition-colors hover:bg-surface-soft"
                    style={{ color: "var(--ink)" }}
                  >
                    ↓ Export PDF
                  </Link>

                  {/* WP.17v — the fourth control in the header, a 34px square
                      rather than a padded button, and the only way into the
                      whole-plan visibility list. */}
                  <Link
                    href={`${basePath}?visibility=plan`}
                    scroll={false}
                    title="Visibility & more"
                    aria-label="Visibility & more"
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-control border border-line-strong text-[15px] no-underline transition-colors hover:bg-surface-soft"
                    style={{ color: "var(--ink)" }}
                  >
                    ⋯
                  </Link>
                </>
              )}
            </div>
          ) : null}
        </div>

        {/*
          What this plan is for, first, and what to do about it second.

          While reviewing, the only line here was "Whitby drafted 4 Work
          Streams — review and adjust before saving", which says what just
          happened rather than what the plan is. The outcome is the one
          sentence that answers "what is this?", and it was written by the
          drafter for exactly that — so it leads, and the instruction sits
          under it in the quieter voice an instruction wants.
        */}
        {plan.desired_outcome ? (
          <p
            className="mt-2.5 max-w-[36rem] text-[13px] leading-[1.55]"
            style={{ color: "var(--text-secondary)" }}
          >
            {plan.desired_outcome}
          </p>
        ) : null}
        {review ? (
          <p
            className="max-w-[36rem] text-[12.5px] leading-[1.5]"
            style={{
              color: "var(--text-tertiary)",
              margin: plan.desired_outcome ? "5px 0 0" : 0,
            }}
          >
            {originLine(review, reviewSource, plan.workstreams.length)}
          </p>
        ) : null}

        {/*
          Its state, under what it is.

          Draft, urgency, health and the date are how this plan is doing,
          and they were in the block below with the progress bar, one card
          away from the name they belong to. They read as the rest of the
          title, so that is where they sit.
        */}
        {draft ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill status={plan.status} />
            <Pill tone="warning">Urgency: {urgencyLabel(plan.urgency)}</Pill>
            <HealthPill health={plan.health} prefix="Health: " />
            {plan.target_date ? <Pill>Due {shortDate(plan.target_date)}</Pill> : null}
            {plan.approvalsWaiting > 0 ? (
              <Pill tone="danger">
                {plan.approvalsWaiting} approval{plan.approvalsWaiting === 1 ? "" : "s"} pending
              </Pill>
            ) : null}
          </div>
        ) : (
          <div
            className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]"
            style={{ color: "rgba(55,53,47,.55)" }}
          >
            <span style={{ color: planStatusColour(plan.status), fontWeight: 600 }}>
              {planStatusLabel(plan.status)}
            </span>
            {plan.target_date ? (
              <>
                <span>·</span>
                <span>Due {shortDate(plan.target_date)}</span>
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
        )}
      </div>

      {structureEditing ? null : (
      <>
      {/*
        The plan's vital signs, and the reference draws them two ways.

        A draft gets the pill row — WP.11, WP.14, WP.15 and WP.16 all do —
        because each of those is a thing being set, and a pill is what a value
        you can change looks like everywhere else in this app. A running plan
        gets one quiet line with dots between — WP.7, WP.17, WP.20 and WP.21 —
        because by then they are being watched rather than chosen, and five
        pills side by side read as five separate alarms.
      */}
      {/* One block, not four bands.
          The chips, the bar and the feasibility line are three readings of the
          same question — where is this plan — and they were three loose rows
          at three different rhythms, which is what made the top of this screen
          read as a pile. Bounded together, with one gap between them, they
          read as one summary and the views below start cleanly. */}
      <div
        className="mb-4 flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
        style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
      >
      <PlanProgressBar
        percent={plan.progress}
        done={plan.taskDone}
        total={plan.taskTotal}
        gap={0}
      />

      {/* Above the views, because whether the plan can reach its date decides
          how to read everything below it. */}
      <FeasibilityBanner feasibility={plan.feasibility} targetDate={plan.target_date} />

      {/*
       * What is not settled, directly under the deadline.
       *
       * These sat beneath the Work Streams, on the reasoning that a risk is
       * about the plan rather than a step in it and reading the exceptions
       * first is reading them before the thing they except. On a plan with
       * three streams that held; on one with twelve it put the risks below
       * a screen and a half of tasks, which is where nobody found them.
       *
       * The client asked for them here, and the deadline above them is the
       * thing they are mostly about.
       */}
      <div className="mb-5">
        <NoticedTabs
          basePath={basePath}
          active={one(searchParams?.noticed) ?? ""}
          tabs={[
            {
              key: "waiting",
              label: "Waiting on",
              count: plan.dependencyLines.length,
              body: (
                <DependenciesPanel
                  items={plan.dependencyLines}
                  basePath={basePath}
                  all={showAllNoticed}
                />
              ),
            },
            {
              key: "considerations",
              label: "Considerations",
              count: plan.considerations.length,
              body: (
                <ConsiderationsPanel
                  items={plan.considerations}
                  basePath={basePath}
                  all={showAllNoticed}
                />
              ),
            },
            {
              key: "risks",
              label: "Risks",
              count: plan.risks.length,
              tone: "danger" as const,
              body: (
                <RisksPanel
                  risks={plan.risks}
                  streamNames={
                    new Map(plan.workstreams.map((stream) => [stream.id, stream.name]))
                  }
                  basePath={basePath}
                  all={showAllNoticed}
                />
              ),
            },
          ]}
        />
      </div>


      {/* Last inside the summary, so it is the line nearest the work. */}
      <EmergencyStrip entries={contacts} />

      {/* A lookup that did not happen, said out loud.
          The search before drafting is never fatal, so it fails quietly — and
          a plan carrying no phone numbers looks exactly like work that needed
          none. This is the difference, and the way to fix it without
          rebuilding a plan somebody has already edited. */}
      {plan.researchState === "failed" ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] px-3.5 py-2.5"
          style={{ background: "var(--warning-bg)", border: "1px solid var(--border-strong)" }}
        >
          <span className="text-[12.5px]" style={{ color: "var(--ink)" }}>
            Whitby could not reach the web when this plan was drafted, so the
            offices and pages on it are unverified.
          </span>

          <form action={researchPlanAgain} className="shrink-0">
            <input type="hidden" name="plan_id" value={plan.id} />
            <SubmitPlain
              className="rounded-control border px-3 py-1.5 text-[12.5px] font-medium"
              style={{ borderColor: "var(--warning-fg)", color: "var(--warning-fg)" }}
            >
              Look it up again
            </SubmitPlain>
          </form>
        </div>
      ) : null}
      {/*
       * The client's list lives on its own screen now.
       *
       * It stood here, above the work, and it is the longest thing this page
       * had: everything the client has to send before anything can start,
       * one row each, with an approval on every row. On a plan with fourteen
       * of them it pushed the Work Streams off the first screen — and it is
       * not what somebody opens a plan to look at.
       *
       * The rail carries a card saying how many are outstanding, which is
       * the part that belongs on this page. See `checklist/page.tsx`.
       */}
      </div>


      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <ViewSwitch basePath={basePath} active={view} />
      </div>
      {/* Charts is the one view with no Work Streams heading to stand in,
          so it gets the same element rather than a second copy of it. */}
      {view === "charts" ? <div className="mb-3.5 flex justify-end">{askWhitbyDock}</div> : null}
      </>
      )}

      {/* WP.17j is the one view without the Work Streams heading or the right
          rail: the charts are the body, full width. */}
      {structureEditing ? (
        <PlanEditMode plan={plan} basePath={basePath} />
      ) : view === "charts" ? (
        charts ? (
          <ChartsView charts={charts} />
        ) : null
      ) : (
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start" data-pa-workplan-body>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[14px] font-semibold tracking-[-0.01em]">
              Work Streams ({plan.workstreams.length})
            </span>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {askWhitbyDock}
              <Link
                href={`${basePath}?stream=new`}
                scroll={false}
                className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium no-underline"
                style={{ color: "var(--ink)" }}
              >
                + Add Work Stream
              </Link>
              {/* This said "Edit" and opened the plan's own details — the same
                  dialog as the Edit beside the title, three feet above. Sitting
                  over the list of Work Streams it read as editing them, which
                  is what the header button did, under a name that promised
                  reordering and did none.

                  One control, beside what it changes, saying what it does:
                  rename a Work Stream, move its owner, remove it, or remove a
                  task. */}
              <Link
                href={`${basePath}?editing=1`}
                scroll={false}
                className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium no-underline"
                style={{ color: "var(--ink)" }}
              >
                Edit Work Streams
              </Link>
            </div>
          </div>

          {plan.workstreams.length === 0 ? (
            <div
              className="rounded-card border-2 border-dashed p-8 text-center text-[13px]"
              style={{ borderColor: "var(--border-strong)", color: "rgba(55,53,47,.45)" }}
            >
              No Work Streams yet, add your first one, or generate structure
              from a Playbook or upload.
            </div>
          ) : view === "table" ? (
            <PlanTable plan={plan} basePath={basePath} options={table} />
          ) : view === "grid" ? (
            <GridView
                plan={plan}
                basePath={basePath}
                trends={trends}
                providers={providers}
              />
          ) : view === "kanban" ? (
            <KanbanView
                plan={plan}
                basePath={basePath}
                group={kanbanGroup}
                sort={kanbanSort}
              />
          ) : view === "timeline" ? (
            <TimelineView
                plan={plan}
                basePath={basePath}
                scale={timelineScale}
                showDependencies={one(searchParams?.deps) !== "off"}
                expanded={(one(searchParams?.open) ?? "").split(",").filter(Boolean)}
              />
          ) : (
            <WorkStreamList
              streams={plan.workstreams}
              planId={plan.id}
              basePath={basePath}
              rowActions={Boolean(review) || wizard}
            />
          )}

          {/*
           * Directly under the work, inside the same column, rather than under
           * the whole row.
           *
           * It used to sit after the flex row, which put it below whichever of
           * the two columns was taller — and the rail, with Whitby's panel and
           * five more, is always taller than a short plan's streams. So on most
           * plans these three landed a screen and a half beneath the tasks with
           * nothing but white between, and nobody scrolled to them.
           */}
        </div>

        {/* Three views carry a rail, and each carries its own. The List's is
            about the engagement, the Table's about the shape of the work, the
            Grid's about how far each stream has got. Kanban, Timeline and
            Charts have none, each needs the width more. */}
        {view === "table" ? (
          <aside
            data-pa-workplan-rail
            className="flex w-full shrink-0 flex-col gap-4 lg:w-[280px]"
          >
            <TableRail plan={plan} charts={charts} basePath={basePath} />
          </aside>
        ) : view === "grid" ? (
          <aside
            data-pa-workplan-rail
            className="flex w-full shrink-0 flex-col gap-4 lg:w-[280px]"
          >
            <GridRail plan={plan} charts={charts} basePath={basePath} />
          </aside>
        ) : view === "list" ? (
        <aside
          data-pa-workplan-rail
          className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-4 lg:w-[300px]"
        >
          {/*
           * What Whitby got on with while nobody was looking.
           *
           * Above the client's card because it is the newer information: the
           * checklist is a standing list that changes when the client acts,
           * this is what changed since the plan was adopted. Draws nothing at
           * all when there is nothing, which is every plan that has no `auto`
           * tasks and every plan drafted before migration 101.
           */}
          <WhitbyDidThis
            rows={whitbyDrafts(plan.workstreams)}
            canStart={whitbyCanStart(plan.workstreams)}
            planId={plan.id}
            basePath={basePath}
          />

          {/*
           * What only you can do, above what only they can.
           *
           * The pair the brief asks for. Yours first because it is the half
           * nobody will chase you about: a client who has not sent their
           * passport will be reminded, and a decision sitting on your desk
           * will not be.
           */}
          {yours.length > 0 ? (
            <Link
              href={`${basePath}/yours`}
              className="group flex items-center gap-3 rounded-card border px-4 py-3.5 no-underline transition-shadow hover:shadow-[0_2px_10px_-4px_rgba(23,48,78,.22)]"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 24%, var(--chrome-line))",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">Your Checklist</span>
                <span
                  className="mt-0.5 block text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {yours.length === 1
                    ? "One thing only you can do"
                    : `${yours.length} things only you can do`}
                </span>
              </span>

              <span
                className="shrink-0 rounded-full px-2 py-[3px] text-[12px] font-semibold tabular-nums"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {yours.length}
              </span>

              <span
                aria-hidden
                className="shrink-0 text-[13px] transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--text-disabled)" }}
              >
                →
              </span>
            </Link>
          ) : null}

          {/*
           * What the client still owes, as a card rather than a list.
           *
           * The list itself is a screen of its own: fourteen rows with an
           * approval on each is a sitting, not a glance, and it used to sit
           * between the deadline and the work. This says how much is
           * outstanding, which is the part a plan wants on it.
           */}
          {showClients && plan.client_id ? (
            <Link
              href={`${basePath}/checklist`}
              className="group flex items-center gap-3 rounded-card border px-4 py-3.5 no-underline transition-shadow hover:shadow-[0_2px_10px_-4px_rgba(23,48,78,.22)]"
              style={{
                borderColor:
                  stillNeeded > 0
                    ? "var(--warning-border)"
                    : "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                background: stillNeeded > 0 ? "var(--warning-bg)" : "var(--surface)",
                color: "var(--ink)",
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">Client Checklist</span>
                <span
                  className="mt-0.5 block text-[12.5px]"
                  style={{
                    color: stillNeeded > 0 ? "var(--warning-fg)" : "var(--text-tertiary)",
                  }}
                >
                  {needs.length === 0
                    ? "Nothing to ask for yet"
                    : stillNeeded === 0
                      ? "Everything has come back"
                      : `${stillNeeded} still to come from the client`}
                </span>
              </span>

              {stillNeeded > 0 ? (
                <span
                  className="shrink-0 rounded-full px-2 py-[3px] text-[12px] font-semibold tabular-nums"
                  style={{ background: "var(--warning-fg)", color: "#fff" }}
                >
                  {stillNeeded}
                </span>
              ) : null}

              <span
                aria-hidden
                className="shrink-0 text-[13px] transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--text-disabled)" }}
              >
                →
              </span>
            </Link>
          ) : null}

          <Panel title="Key Dates">
            <Line>Created {shortDate(plan.created_at)}</Line>
            {plan.target_date ? (
              <Line>Target completion {shortDate(plan.target_date)}</Line>
            ) : null}
            <Line>Last updated {relativeTime(plan.updated_at)}</Line>
          </Panel>

          {/* Named "Contacts & Approvals" and showing neither: one name, and a
              count that was always nought. It says who to go to about this
              plan, and which pieces of it are waiting on somebody to say
              yes. */}
          <Panel title="Owner &amp; approvals">
            <Line>
              {plan.ownerName}, Owner. Ask them about this plan.
            </Line>

            {plan.approvalTasks.length === 0 ? (
              <Line>Nothing is waiting to be approved.</Line>
            ) : (
              <>
                <Line tone="warning">
                  {plan.approvalTasks.length} task
                  {plan.approvalTasks.length === 1 ? "" : "s"} need approving before they
                  go out
                </Line>

                {/* "and 7 more" was a sentence about seven tasks nobody
                    could reach: the four above it open, and the seven behind
                    it were a count. The same control the rest of the rail
                    uses opens them. */}
                <div className="mt-1.5 flex flex-col gap-1">
                  {/* One, and the rest on a press. A rail panel that runs
                      four approvals deep pushes Where to go and Linked off
                      the screen; the first is the one being waited on. */}
                  <ShowMore step={1}>
                    {plan.approvalTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`${basePath}/tasks/${task.id}`}
                        className="block leading-[1.4] no-underline"
                      >
                        {task.title}
                      </Link>
                    ))}
                  </ShowMore>
                </div>
              </>
            )}
          </Panel>

          {/* Above Linked, and on the rail rather than in the tabs below: a
              number is something somebody reaches for while working, not a
              conclusion they scroll to the bottom for. */}
          {contacts.length > 0 ? (
            <Panel title={`Where to go (${contacts.length})`}>
              <ContactsPanel entries={contacts} />
            </Panel>
          ) : null}

          <Panel title="Linked">
            <Line>
              <Link href={`/whitbyos/requests/${plan.request_id}`}>
                Request: {plan.request_title}
              </Link>
            </Line>
            {plan.playbookName ? <Line>Playbook: {plan.playbookName}</Line> : null}
            <Line>
              {plan.documentCount} Document{plan.documentCount === 1 ? "" : "s"} ·{" "}
              {plan.worksheetCount} Worksheet{plan.worksheetCount === 1 ? "" : "s"}
            </Line>
            <Line>
              {plan.providerCount} Provider{plan.providerCount === 1 ? "" : "s"} offered
            </Line>
            {/* Two different facts that both used to read as "Providers": one
                is what has been put in front of the client to choose from, the
                other is which of the firm's own the plan's steps actually use.
                A plan naming two providers while the rail said "0 Providers"
                was the count being right about a question nobody asked. */}
            {providersUsed > 0 ? (
              <Line>
                {providersUsed} Provider{providersUsed === 1 ? "" : "s"} used by tasks
              </Line>
            ) : null}

            {/* The kinds of firm this plan needs and the directory has none
                for. It was on the tasks and on their Work Streams, which is
                where you act on it, and nowhere that answers "what does this
                whole plan still need somebody for". */}
            {providersNeeded.length > 0 ? (
              <>
                <Line tone="warning">
                  {providersNeeded.length} still to find
                </Line>
                <div className="mt-0.5 flex flex-col gap-0.5 leading-[1.4]">
                  {providersNeeded.slice(0, 4).map((category) => (
                    <span key={category}>{category}</span>
                  ))}
                  {providersNeeded.length > 4 ? (
                    <span>and {providersNeeded.length - 4} more</span>
                  ) : null}
                </div>
              </>
            ) : null}
          </Panel>

        </aside>
        ) : null}
      </div>
      )}



      {/* WP.17v — the whole plan. Its footnote is what sends anyone who needs
          finer control on to WP.17u. */}
      {planViewers ? (
        <VisibilityDialog
          title="Work Plan Visibility"
          description={`Controls who can see the entire ${planViewers.subject} Work Plan. Task assignment is separate. This only governs visibility.`}
          footnote={'Need finer control? Set visibility per Work Stream from that stream\u2019s "⋯" menu instead.'}
          people={planViewers.people}
          action={savePlanVisibility}
          hidden={{ plan_id: plan.id }}
          closeHref={basePath}
          error={error}
          client={showClients && plan.client_id ? planClientSwitch(planViewers.client) : null}
        />
      ) : null}

      {/* WP.17u — one stream, named in the heading as the reference names it. */}
      {streamViewers ? (
        <VisibilityDialog
          title={`Work Stream Visibility: ${streamViewers.subject}`}
          description="Controls who can see this Work Stream specifically, separate from the whole Work Plan's visibility."
          people={streamViewers.people}
          action={saveStreamVisibility}
          hidden={{ plan_id: plan.id, workstream_id: visibilityStreamId }}
          closeHref={basePath}
          error={error}
          client={showClients && plan.client_id ? streamClientSwitch(streamViewers.client) : null}
        />
      ) : null}

      {dialog?.kind === "task" && dialog.task && removing ? (
        <ConfirmRemoveDialog
          title="Remove this task?"
          detail={`"${dialog.task.title}"${
            dialog.task.checklist.length > 0
              ? ` and its checklist (${dialog.task.checklist.length} item${
                  dialog.task.checklist.length === 1 ? "" : "s"
                })`
              : ""
          } will be permanently removed from ${
            plan.workstreams.find((s) => s.id === dialog.task!.workstream_id)?.name ??
            "this plan"
          }. This cannot be undone.`}
          confirmLabel="Remove Task"
          action={removeTask}
          hidden={{ plan_id: plan.id, task_id: dialog.task.id }}
          closeHref={`${basePath}?task=${dialog.task.id}`}
        />
      ) : dialog?.kind === "stream" && dialog.stream && removing ? (
        <ConfirmRemoveDialog
          title={`Remove ${dialog.stream.name}?`}
          detail={dependentSentence(plan, dialog.stream.id, dialog.stream.taskCount)}
          confirmLabel="Remove Work Stream"
          action={removeWorkstream}
          hidden={{ plan_id: plan.id, workstream_id: dialog.stream.id }}
          closeHref={`${basePath}?stream=${dialog.stream.id}`}
          width={440}
        />
      ) : dialog?.kind === "task" ? (
        <EditTaskDialog
          planId={plan.id}
          task={dialog.task}
          // The same task as the plan holds it, found rather than re-queried:
          // the plan is already in hand and carries everything Whitby wrote.
          briefing={
            dialog.task
              ? plan.workstreams
                  .flatMap((stream) => stream.tasks)
                  .find((task) => task.id === dialog.task!.id) ?? null
              : null
          }
          streams={plan.workstreams}
          assignees={dialog.assignees}
          dependencies={dialog.dependencies}
          defaultStreamId={dialog.defaultStreamId}
          planTargetDate={plan.target_date ? plan.target_date.slice(0, 10) : null}
          closeHref={basePath}
          error={error}
        />
      ) : exporting ? (
        <ExportDialog
          planId={plan.id}
          planName={plan.name}
          basePath={basePath}
          letterhead={letterhead}
        />
      ) : null}

      {/* The toast that used to stand here said "Work plan exported as PDF"
          and then offered the button that did the exporting — it announced a
          thing that had not happened and asked for a second press. The dialog
          hands back the file itself now. It still answers a submit without
          scripting, which is the only way this route is reached that way. */}
      {exported ? (
        <DarkToast
          message="Choose your options and press Export PDF."
          actionLabel="Download PDF"
          actionHref={`/api/whitbyos/work-plans/${plan.id}/export?format=pdf&${exportQuery(exportOptions)}`}
          closeHref={basePath}
          placement="bottom-center"
          mark={false}
        />
      ) : null}

      {/* Four outcomes, four sentences. Three of them used to share two, and
          a plan already carrying four government pages was told the search
          "turned up nothing usable" about a lookup that had just worked. */}
      {lookup ? (
        <Toast
          title={
            lookup === "failed"
              ? "Could not reach the web"
              : lookup === "empty"
                ? "The search found nothing"
                : lookup === "none"
                  ? "Nothing to add"
                  : "Contacts added"
          }
          detail={
            lookup === "failed"
              ? "The search would not answer. It is usually load rather than anything wrong; try once more in a minute."
              : lookup === "empty"
                ? "It ran, and came back with nothing about this kind of work."
                : lookup === "none"
                  ? "The search ran and found nothing this plan does not already have."
                  : `${lookup} task${lookup === "1" ? "" : "s"} now carry pages and numbers from the search.`
          }
          closeHref={basePath}
        />
      ) : null}

      {justSaved ? (
        <Toast
          title="Work Plan saved"
          detail={`${plan.name} is now active.`}
          closeHref={basePath}
        />
      ) : null}

      {editing ? (
        <EditPlanDialog plan={plan} closeHref={basePath} error={error} />
      ) : null}

      {dialog?.kind === "stream" ? (
        <EditWorkstreamDialog
          planId={plan.id}
          stream={dialog.stream}
          closeHref={basePath}
          error={error}
        />
      ) : null}
    </div>
  );

  if (wizard) {
    return (
      <WizardChrome
        steps={["Choose how to build", "Build", "Save"]}
        current={1}
        backHref="/whitbyos/work-plans/new"
        backLabel="Back"
      >
        {body}
      </WizardChrome>
    );
  }

  if (review) {
    return (
      <WizardChrome
        steps={GENERATED_STEPS}
        current={3}
        backHref="/whitbyos/work-plans/new"
        backLabel="Back"
      >
        {body}
      </WizardChrome>
    );
  }

  return body;
}

/**
 * The three ways a plan arrives at WP.11 / WP.14 already built.
 *
 * Scratch is not among them: it has its own three-step frame, because there is
 * nothing to review that the person did not just type.
 */
const REVIEW_ORIGINS = ["whitby", "playbook", "import"] as const;
type ReviewOrigin = (typeof REVIEW_ORIGINS)[number];

/** WP.7 through WP.14 name the same five steps whichever path is taken. */
const GENERATED_STEPS = [
  "Choose how to build",
  "Configure",
  "Generate",
  "Review & Edit",
  "Save",
];

/** WP.11's "From Playbook · …" and WP.14's "Imported · …". */
function originPill(origin: ReviewOrigin, source: string) {
  if (origin === "import") return source ? `Imported \u00b7 ${source}` : "Imported";
  if (origin === "playbook") return source ? `From Playbook \u00b7 ${source}` : "From Playbook";
  return "Built with Whitby";
}

/**
 * The sentence under the title.
 *
 * The Playbook one counts the Work Streams because the reference does — "all 8
 * Work Streams carried over" — and a plan that lost one on the way across
 * should say the smaller number rather than the Playbook's.
 */
function originLine(origin: ReviewOrigin, source: string, streams: number) {
  const count = `${streams} Work Stream${streams === 1 ? "" : "s"}`;

  if (origin === "import") {
    return source
      ? `Converted from ${source} \u2014 review the structure Whitby extracted before saving.`
      : "Review the structure Whitby extracted before saving.";
  }

  if (origin === "playbook") {
    return source
      ? `Generated from the ${source} Playbook \u2014 all ${count} carried over and ready to adjust before saving.`
      : `Generated from a Playbook \u2014 all ${count} carried over and ready to adjust before saving.`;
  }

  return `Whitby drafted ${count} \u2014 review and adjust before saving.`;
}

/**
 * Where the sharing columns are not in the database yet, the switch is still
 * drawn — greyed, and saying why — so the option can be found rather than
 * silently missing.
 */
function CLIENT_SWITCH_UNAVAILABLE(label: string) {
  return {
    label,
    checked: false,
    disabled: true,
    note: "Sharing with the client is not switched on for this workspace yet.",
  };
}

/**
 * The client-portal switch on WP.17v, and the sentence that says exactly what
 * ticking it hands over — the list is `portal_request_plans()`'s, word for
 * word, so the professional is told no more and no less than the client gets.
 */
function planClientSwitch(share: ClientShare | null) {
  if (!share) return CLIENT_SWITCH_UNAVAILABLE("Share this Work Plan with the client");
  const what =
    "The client sees the whole plan in their portal: every Work Stream and task, with statuses, dates and who owns each, in List, Table, Grid, Kanban, Timeline and Charts. Priorities, next actions, checklists, dependencies, Considerations and providers stay internal.";
  return {
    label: "Share this Work Plan with the client",
    checked: share.checked,
    note: share.planDraft ? `${what} Nothing shows while the plan is a draft.` : what,
  };
}

/** WP.17u's switch — taking one stream out of a shared plan. */
function streamClientSwitch(share: ClientShare | null) {
  if (!share) return CLIENT_SWITCH_UNAVAILABLE("Show this Work Stream in the client portal");
  return {
    label: "Show this Work Stream in the client portal",
    checked: share.checked,
    note: share.planShared
      ? "Unticking takes this stream, its tasks and its progress out of the client’s view of the plan."
      : "This Work Plan is not shared with the client, so nothing here reaches them until it is.",
  };
}

/**
 * WP.19b's warning. The export names the streams that depend on the one being
 * removed, so this counts them rather than writing a vaguer sentence.
 */
function dependentSentence(
  plan: NonNullable<Awaited<ReturnType<typeof getWorkPlan>>>,
  streamId: string,
  taskCount: number,
) {
  const dependents = plan.workstreams
    .filter((stream) => stream.tasks.some((task) => task.blockedByStreamId === streamId))
    .map((stream) => stream.name);

  const tasks =
    taskCount > 0
      ? `This Work Stream has ${taskCount} task${taskCount === 1 ? "" : "s"} and their checklists. Removing it removes all of them permanently`
      : "Removing this Work Stream is permanent";

  const blocked =
    dependents.length > 0
      ? `, and ${dependents.join(", ")} (which depend${
          dependents.length === 1 ? "s" : ""
        } on it) will need a new dependency`
      : "";

  return `${tasks}${blocked}. This cannot be undone.`;
}

/**
 * Which dialog the URL is asking for, if any.
 *
 * An id that is not part of this plan resolves to no dialog rather than to
 * someone else's Task: the plan itself was already checked against the
 * workspace, so its own Work Streams are the boundary to measure against.
 */
async function resolveDialog(
  plan: NonNullable<Awaited<ReturnType<typeof getWorkPlan>>>,
  taskParam: string | undefined,
  streamParam: string | undefined,
) {
  const streamIds = new Set(plan.workstreams.map((stream) => stream.id));

  if (taskParam) {
    if (plan.workstreams.length === 0) return null;

    const assignees = await listAssignees();
    const defaultStreamId =
      streamParam && streamIds.has(streamParam) ? streamParam : plan.workstreams[0]!.id;

    if (taskParam === "new") {
      const dependencies = await listDependencyOptions(plan);
      return { kind: "task" as const, task: null, assignees, dependencies, defaultStreamId };
    }

    const task = await getTaskEdit(taskParam);
    if (!task || !task.workstream_id || !streamIds.has(task.workstream_id)) return null;

    const dependencies = await listDependencyOptions(plan, task.id);
    return {
      kind: "task" as const,
      task,
      assignees,
      dependencies,
      defaultStreamId: undefined,
    };
  }

  if (streamParam === "new") {
    return { kind: "stream" as const, stream: null };
  }

  if (streamParam) {
    if (!streamIds.has(streamParam)) return null;
    const stream = await getWorkstreamEdit(streamParam);
    if (!stream) return null;
    return { kind: "stream" as const, stream };
  }

  return null;
}

/** WP.17's side panels: a bordered box, a 13px heading, then 12.5px lines. */
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[10px] border border-line bg-surface p-3.5"
      style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold tracking-[-0.01em]">{title}</span>
        {action}
      </div>
      <div className="text-[12.5px] leading-[1.65]" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

function Line({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <div style={{ color: tone === "warning" ? "var(--warning-fg)" : undefined }}>
      {children}
    </div>
  );
}

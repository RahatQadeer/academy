import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { needsOnboarding } from "@/whitbyos/lib/onboarding";
import { getDashboard, getWidgetPrefs } from "@/whitbyos/lib/dashboard";
import { getHomeWidgets } from "@/whitbyos/lib/home-widgets";
import { getSessionProfile } from "@/base/identity/session";
import { WelcomeTour } from "@/whitbyos/components/home/WelcomeTour";
import { finishTour } from "@/whitbyos/actions";
import { WidgetsDialog } from "@/whitbyos/components/home/WidgetsDialog";
import {
  FeedWidget,
  InsightsWidget,
  LoadWidget,
  PlanProgressWidget,
  OutstandingWidget,
  OverdueTasksWidget,
  ProvidersWidget,
  TeamActivityWidget,
  ThisWeekWidget,
} from "@/whitbyos/components/home/Widgets";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { NewRequestDialog } from "@/whitbyos/requests/components/NewRequestDialog";
import { LogCommunicationDialog } from "@/whitbyos/components/home/LogCommunicationDialog";
import { NewNoteDialog } from "@/whitbyos/components/home/NewNoteDialog";
import { Toast } from "@/whitbyos/components/Toast";
import { listRequestOptions } from "@/whitbyos/lib/quick-log";
import { getOpenClient } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { listWorkPlans } from "@/whitbyos/lib/work-plans";
import { getOverviewBoard } from "@/whitbyos/lib/overview-board";
import { getWorkspaceOverview } from "@/whitbyos/lib/workspace-overview";
import { AreaChart, Donut, donutSlices } from "@/whitbyos/workspaces/OverviewDashboard";
import { Logo } from "@/base/components/Logo";
import { AskFromHome } from "@/whitbyos/components/AskFromHome";
import { openClientWorkspace } from "@/whitbyos/workspaces/actions";

/**
 * Screen 1 — Whitby's Dashboard, and the gate for first-time setup.
 *
 * The export gives it four counts and a two-column body: three widgets in the
 * wide column and the rest in a 300px rail. Which widgets appear is 1.3's
 * list, per person and per workspace.
 *
 * A professional arriving without having completed onboarding is sent through
 * it first (SRS §4.2), so they name their own workspace rather than keeping
 * the placeholder one created at sign-up.
 */
export default async function WhitbyPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (isSupabaseConfigured() && (await needsOnboarding())) {
    // Step 1 is Your Account since v2. Landing on step 2 skipped the step that
    // asks who they are, and left the progress bar starting at two of five.
    redirect("/onboarding/account");
  }

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  // 1.2, 1.2b and 1.2c all open over the Dashboard rather than on their own
  // screen: the point of Quick Add is not losing the screen you were on.
  const creating = one(searchParams?.new);
  const created = one(searchParams?.created);
  const logged = one(searchParams?.logged);
  const error = one(searchParams?.error);

  const choosingWidgets = one(searchParams?.widgets) === "1";
  const needsClients = creating === "request";
  const needsRequests = creating === "communication" || creating === "note";

  const openClient = await getOpenClient();
  const showClients = await usesClientWorkspaces();

  const [data, home, clients, requests, widgets, planList, board, overview] = await Promise.all([
    getDashboard(),
    getHomeWidgets(openClient?.id ?? null),
    needsClients || needsRequests ? listClientOptions() : Promise.resolve([]),
    needsRequests ? listRequestOptions() : Promise.resolve([]),
    getWidgetPrefs(),
    listWorkPlans(),
    getOverviewBoard(),
    getWorkspaceOverview(),
  ]);

  // 1.4 is "shown automatically on a professional's first login". Not while a
  // dialog or search is already open over the screen it is describing.
  const profile = await getSessionProfile();
  const showTour = !profile?.user.tour_seen_at && !creating && !choosingWidgets;

  const on = (key: string) => widgets[key] !== false;

  const allClients = showClients && !openClient;
  const slices = donutSlices(
    allClients
      ? (overview?.cards ?? []).map((card) => ({ name: card.name, value: card.activeRequests }))
      : [
          { name: "Requests", value: home.activeRequests },
          { name: "Overdue", value: home.overdueItems },
          { name: "Due today", value: home.tasksDueToday },
          { name: "Open tasks", value: home.scopedToOneClient ? home.clientWorkspaces : board.tasks.open },
        ],
  );

  const main = [
    on("outstanding") ? <OutstandingWidget key="outstanding" rows={home.outstanding} /> : null,
    on("overdue_tasks") ? <OverdueTasksWidget key="overdue_tasks" rows={home.overdueTasks} /> : null,
    on("feed") ? <FeedWidget key="feed" rows={home.feed} /> : null,
  ].filter(Boolean);

  const side = [
    on("plan_progress") ? (
      <PlanProgressWidget key="plan_progress" rows={planList.ok ? planList.rows : []} />
    ) : null,
    on("this_week") ? <ThisWeekWidget key="this_week" rows={home.thisWeek} /> : null,
    on("insights") ? <InsightsWidget key="insights" insights={home.insights} /> : null,
    on("team_activity") ? <TeamActivityWidget key="team_activity" rows={home.teamActivity} /> : null,
    on("providers") ? <ProvidersWidget key="providers" rows={home.providers} /> : null,
  ].filter(Boolean);

  return (
    /*
     * A column, not the whole window.
     *
     * At 1900px a card's title sat at one end of the screen and its "View all"
     * at the other, and every row was a line of type nobody's eye tracks in
     * one go. 1240 is as wide as two columns of this shape stay readable.
     */
    <div className="mx-auto max-w-[1240px] px-10 py-8">
      {/*
       * The product line, not a greeting.
       *
       * Home used to open with the time of day and the reader's name, which
       * is what every dashboard says and what none of them needed. This is
       * the same line the rest of Private Attaché uses for Whitby — request
       * to plan, then approval only where it matters — so the screen names
       * the system rather than the person looking at it.
       */}
      <p className="ws-section-label">Home</p>
      <div className="mb-5">
        <h1 className="text-[28px] font-bold tracking-[-0.5px]">
          Intelligent coordination
        </h1>
        <p className="mt-1.5 max-w-[38rem] text-[13.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
          Turns a request into a plan, runs it, and asks for approval only where it matters.
        </p>
      </div>

      {/* §6.5.1 — describe the work and Whitby drafts a plan. */}
      <AskFromHome className="mb-5 flex items-center gap-2.5">
        <div className="home-ask min-w-0 flex-1">
          <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-[8px]" aria-hidden>
            <Logo size={32} />
          </span>
          <input
            name="q"
            placeholder="Ask Whitby anything, or describe a new request…"
            aria-label="Ask Whitby anything"
            className="min-w-0 flex-1 border-none bg-transparent py-2 text-[14.5px] outline-none"
          />
        </div>
        <button
          type="submit"
          className="pa-ask-whitby-nav group flex shrink-0 items-center gap-2 rounded-control px-4 py-[9px] text-[13.5px] font-semibold"
        >
          <BriefcaseMark />
          Ask Whitby
          <span aria-hidden className="transition-transform group-hover:translate-x-[3px]">
            →
          </span>
        </button>
      </AskFromHome>

      {/* A client waiting to have someone added cannot be found from any count
          below, so it is said out loud. One goes straight to its review; more
          than one goes to the list of everything waiting. */}
      {data.accessRequests.length > 0 ? (
        data.accessRequests.length === 1 ? (
          <form action={openClientWorkspace} className="home-notice mb-5">
            <input type="hidden" name="client_id" value={data.accessRequests[0]!.clientId} />
            <input
              type="hidden"
              name="next"
              value={`/whitbyos/clients/${data.accessRequests[0]!.clientId}/contacts?review=${data.accessRequests[0]!.id}`}
            />
            <AskFace name={data.accessRequests[0]!.clientName} photo={data.accessRequests[0]!.photo} />
            <p className="m-0 min-w-0 flex-1 text-[13.5px] leading-[1.45]" style={{ color: "var(--ink)" }}>
              <span className="font-semibold">{data.accessRequests[0]!.clientName}</span>
              {" asked for "}
              {data.accessRequests[0]!.personName}
              {" to be added to their account. "}
              <button
                type="submit"
                className="font-semibold hover:underline"
                style={{ color: "var(--accent)", background: "none", border: 0, padding: 0, cursor: "pointer" }}
              >
                Review access request →
              </button>
            </p>
          </form>
        ) : (
          <div className="home-notice mb-5">
            <AskFace name={data.accessRequests[0]!.clientName} photo={data.accessRequests[0]!.photo} />
            <p className="m-0 min-w-0 flex-1 text-[13.5px] leading-[1.45]" style={{ color: "var(--ink)" }}>
              {data.accessRequests.length} client access requests are waiting for a decision.{" "}
              <Link href="/whitbyos/waiting" className="font-semibold no-underline" style={{ color: "var(--accent)" }}>
                Review them →
              </Link>
            </p>
          </div>
        )
      ) : null}

      <p className="ws-section-label">At a glance</p>
      <div className="mb-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Count
          glyph="☰"
          tone="blue"
          label="Active Requests"
          value={home.activeRequests}
          href="/whitbyos/requests"
        />
        <Count
          glyph="!"
          tone="rose"
          label="Overdue Items"
          value={home.overdueItems}
          href="/whitbyos/tasks"
        />
        <Count
          glyph="▦"
          tone="green"
          label="Tasks Due Today"
          value={home.tasksDueToday}
          href="/whitbyos/tasks"
        />
        <Count
          glyph={showClients ? (home.scopedToOneClient ? "☑" : "⊞") : "☰"}
          tone="amber"
          label={
            showClients
              ? home.scopedToOneClient
                ? "Open Tasks"
                : "Workspaces"
              : "Open Requests"
          }
          value={showClients ? home.clientWorkspaces : home.outstanding.length}
          href={
            showClients
              ? home.scopedToOneClient
                ? "/whitbyos/tasks"
                : "/whitbyos/clients"
              : "/whitbyos/requests"
          }
        />
      </div>

      <p className="ws-section-label">The picture</p>
      <div className="mb-5 flex flex-col gap-3">
        <div className="grid w-full gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
          <section className="ws-dash-card flex flex-col p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              {/* Named for what it counts. `getOverviewBoard` answers for the
                  whole firm — Workspace Overview is the screen it was written
                  for — so inside one client's workspace this chart was
                  drawing every client's Requests under a heading that let it
                  be read as theirs. The figures are honest; the heading now
                  says whose they are. */}
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-quiet)" }}>
                {openClient ? "Requests this year, across the firm" : "Requests this year"}
              </h3>
              <span className="rounded-control border px-2.5 py-[3px] text-[12px]" style={{ borderColor: "var(--chrome-line)", color: "var(--text-secondary)" }}>
                {new Date().getFullYear()}
              </span>
            </div>
            <AreaChart months={board.trend} />
          </section>
          <section className="ws-dash-card flex flex-col p-5">
            <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-quiet)" }}>
              {allClients ? "Where the work sits" : "What is open"}
            </h3>
            <Donut slices={slices} total={slices.reduce((sum, slice) => sum + slice.value, 0)} />
          </section>
        </div>
        {on("load") ? <LoadWidget rows={home.load} /> : null}
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start" data-tour="widgets">
        <div className="flex min-w-0 flex-1 flex-col gap-4">{main}</div>
        {side.length > 0 ? (
          /*
           * Sticky, because the rail is three short widgets against a main
           * column of five long ones — and a right-hand third that scrolls
           * away leaves two thirds of the page beside nothing at all. It
           * travels instead, so what it holds is readable the whole way down.
           */
          <div className="flex w-full flex-col gap-4 lg:sticky lg:top-[84px] lg:w-[320px] lg:shrink-0">
            {side}
          </div>
        ) : null}
      </div>

      {showTour ? <WelcomeTour finish={finishTour} usesClientWorkspaces={showClients} /> : null}

      {choosingWidgets ? (
        <WidgetsDialog prefs={widgets} closeHref="/whitbyos" />
      ) : null}

      {creating === "request" ? (
        <NewRequestDialog
          clients={clients}
          closeHref="/whitbyos"
          error={error}
          from="home"
          usesClientWorkspaces={showClients}
        />
      ) : null}

      {creating === "communication" ? (
        <LogCommunicationDialog
          clients={clients}
          requests={requests}
          closeHref="/whitbyos"
          error={error}
        />
      ) : null}

      {creating === "note" ? (
        <NewNoteDialog
          clients={clients}
          requests={requests}
          closeHref="/whitbyos"
          error={error}
        />
      ) : null}

      {created ? (
        <Toast title="Request created" detail={`"${created}" is now open.`} closeHref="/whitbyos" />
      ) : null}

      {logged ? (
        <Toast
          title={logged === "note" ? "Note saved" : "Communication logged"}
          detail={
            logged === "note"
              ? "It is on the record and visible to your team."
              : "It sits alongside Updates, outside synced messaging."
          }
          closeHref="/whitbyos"
        />
      ) : null}
    </div>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function AskFace({ name, photo }: { name: string; photo: string | null }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold"
      style={{
        background: "#f2e2ca",
        color: "var(--warning-fg)",
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--warning-fg) 18%, transparent)",
      }}
      aria-hidden
    >
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

function BriefcaseMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5.5 5.5V4.2A1.2 1.2 0 0 1 6.7 3h2.6a1.2 1.2 0 0 1 1.2 1.2v1.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect
        x="2.4"
        y="5.5"
        width="11.2"
        height="7.8"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M2.4 8.4h11.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** One of screen 1's four counts. A tinted card, like Overview's picture today. */
const COUNT_TONES = {
  blue: {
    bg: "var(--accent-tint)",
    chip: "var(--accent-tint)",
    fg: "var(--accent)",
    bar: "var(--accent)",
  },
  green: {
    bg: "#f4f8f5",
    chip: "var(--success-bg)",
    fg: "var(--success-fg)",
    bar: "var(--success-dot)",
  },
  amber: {
    bg: "var(--warning-bg)",
    chip: "#f2e2ca",
    fg: "var(--warning-fg)",
    bar: "#c4893b",
  },
  rose: {
    bg: "var(--danger-bg)",
    chip: "#ffe2dd",
    fg: "var(--danger-text)",
    bar: "var(--danger-solid)",
  },
} as const;

function Count({
  glyph,
  label,
  value,
  tone,
  href,
}: {
  glyph: string;
  label: string;
  value: number;
  tone: keyof typeof COUNT_TONES;
  href: string;
}) {
  const palette = COUNT_TONES[tone];
  const loud = tone === "rose" && value > 0;

  return (
    <a
      href={href}
      className="home-stat ws-stat flex items-center gap-3 rounded-[10px] border px-3 py-2.5 no-underline transition-transform hover:-translate-y-px"
      style={{
        ["--ws-stat-tint" as string]: palette.bg,
        ["--ws-stat-bar" as string]: palette.bar,
        borderColor: `color-mix(in srgb, ${palette.bar} 12%, var(--chrome-line))`,
        color: "var(--ink)",
      }}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[12px]"
        style={{
          background: `color-mix(in srgb, ${palette.chip} 55%, white)`,
          color: palette.fg,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${palette.bar} 12%, transparent)`,
        }}
      >
        {glyph}
      </span>
      <span className="min-w-0">
        <span
          className="block text-[20px] font-bold leading-none tracking-[-0.4px] tabular-nums"
          style={{ color: loud ? "var(--danger-text)" : "var(--ink)" }}
        >
          {value}
        </span>
        <span className="mt-0.5 block text-[11.5px] font-medium leading-[1.3]">{label}</span>
      </span>
    </a>
  );
}

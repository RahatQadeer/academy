import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listActionItems } from "@/client-portal/lib/data/home";
import { listRequests } from "@/client-portal/lib/data/requests";
import { listProgressUpdates } from "@/client-portal/lib/data/updates";
import { activitySourceCount, listActivity } from "@/client-portal/lib/data/activity";
import { getBillingSummary } from "@/client-portal/lib/data/billing";
import { listCalendar } from "@/client-portal/lib/data/calendar";
import { flag, tabParam, type ScreenProps } from "@/client-portal/lib/routing";
import { PageBody } from "@/client-portal/components/PageHeader";
import { ChipNav } from "@/client-portal/components/ChipNav";
import { ListPanel } from "@/client-portal/components/Panel";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { ActionList } from "@/client-portal/components/ActionList";
import { DeletionAsks } from "@/client-portal/components/DeletionAsks";
import { listDeletionAsks } from "@/client-portal/lib/data/deletions";
import { portalTourSeen } from "@/client-portal/lib/data/tour";
import { PortalWelcomeTour } from "@/client-portal/components/WelcomeTour";
import { finishPortalTour } from "@/client-portal/lib/actions/tour";
import { HomeOverview } from "./components/HomeOverview";
import { RecentActivity } from "./components/RecentActivity";

const TABS = ["overview", "action-needed", "activity"] as const;
const BASE = "/client-portal";

export default async function HomeScreen({ searchParams }: ScreenProps) {
  const tab = tabParam(searchParams, TABS, "overview");
  const [
    context,
    actions,
    requests,
    updates,
    activity,
    activitySources,
    events,
    asks,
    tourSeen,
  ] = await Promise.all([
    getPortalContext(),
    listActionItems(),
    listRequests(),
    listProgressUpdates(),
    listActivity(),
    activitySourceCount(),
    listCalendar(),
    listDeletionAsks(),
    portalTourSeen(),
  ]);

  /*
   * Billing is read only for somebody who holds it.
   *
   * `getBillingSummary` returns zeroes rather than throwing for a reader
   * without the area, and a tile reading "$0.00 · Nothing owed" to a client
   * who was never shown Billing is a statement about their account that this
   * screen has no business making.
   */
  const billing = context.areas.billing ? await getBillingSummary() : null;

  // Only what has not happened yet, soonest first. `listCalendar` orders
  // ascending and spans the whole account, past included.
  const now = Date.now();
  const upcoming = events.filter((event) => Date.parse(event.startAt) >= now);

  /*
   * The six steps, on a client's first visit — Whitby has run its own since
   * 056 and the portal ran nothing, so somebody accepted an invitation and
   * landed on a dashboard of counts and widgets nobody had introduced.
   *
   * Only on Overview: three of its steps point at things the other two tabs do
   * not draw, and a ring around nothing is worse than no ring. `?tour=1` is
   * Preferences' "Show me around again", and the only way in on a sample
   * account.
   */
  const showTour = tab === "overview" && (flag(searchParams, "tour") || !tourSeen);

  return (
    <PageBody>
      {/* The greeting and the day are on the bar — `lib/page-title.ts`. They
          were the tallest header in the portal and the least load-bearing: a
          client who opens Home is looking for what is waiting for them, and
          they were reading their own name to get to it.

          The chips every list in the portal is read through, here over the
          three faces of Home. Overview carries no number: it is a dashboard
          rather than a subset of anything, and a count on it would be a
          fiction. The other two are counted, in red where something is
          waiting. */}
      <ChipNav
        tour="portal-tabs"
        label="Home"
        active={tab}
        className="mb-5"
        chips={[
          { key: "overview", label: "Overview", href: BASE },
          {
            key: "action-needed",
            label: "Action Needed",
            href: `${BASE}?tab=action-needed`,
            count: actions.length + asks.length,
            urgent: true,
          },
          {
            key: "activity",
            label: "Recent Activity",
            href: `${BASE}?tab=activity`,
            count: activity.length,
          },
        ]}
      />
      <DataNotice context={context} />

      {/* Not filed under a tab: something is waiting to be destroyed and the
          answer is the client's. It sits above whatever they came for. */}
      <DeletionAsks asks={asks} here={BASE} />

      {tab === "overview" ? (
        <HomeOverview
          actions={actions}
          requests={requests}
          updates={updates}
          // Six is what the panel holds before it stops being a summary of the
          // feed and becomes a second copy of it.
          activity={activity.slice(0, 6)}
          upcoming={upcoming}
          billing={billing}
          viewerName={context.displayName}
          areas={context.areas}
          timeZone={context.timezone}
        />
      ) : null}

      {tab === "action-needed" ? (
        <ListPanel>
          {/* A task on this list can be ticked off from it (client-portal/020):
              it is the list the client is asked to work through, and sending
              them to another screen to close one is the step this removes. */}
          <ActionList
            items={actions}
            timeZone={context.timezone}
            canTick={!context.viewOnly}
            returnTo="/client-portal?tab=action-needed"
          />
        </ListPanel>
      ) : null}

      {tab === "activity" ? (
        <ListPanel>
          <RecentActivity entries={activity} sources={activitySources} />
        </ListPanel>
      ) : null}

      {showTour ? <PortalWelcomeTour finish={finishPortalTour} /> : null}
    </PageBody>
  );
}

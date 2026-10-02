import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listUpdates } from "@/client-portal/lib/data/updates";
import type { ProgressUpdate } from "@/client-portal/types";
import { flag, param, tabParam, type ScreenProps } from "@/client-portal/lib/routing";
import { PageBody, PageIntro } from "@/client-portal/components/PageHeader";
import { ChipNav } from "@/client-portal/components/ChipNav";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { UpdateFeed } from "@/client-portal/components/UpdateFeed";
import { ListPanel, PanelAction, PanelSearch } from "@/client-portal/components/Panel";
import { ShareUpdateModal } from "./components/ShareUpdateModal";

const TABS = ["recent", "progress", "plans", "follow-up"] as const;

const LABELS: Record<(typeof TABS)[number], string> = {
  recent: "Recent",
  progress: "Progress Updates",
  plans: "Plans & Updates",
  "follow-up": "Needs Follow-Up",
};

const BASE = "/client-portal/updates";

/** Which updates a tab holds — asked once per chip, and once for the list. */
function inTabOf(updates: ProgressUpdate[], tab: (typeof TABS)[number]) {
  return updates.filter((update) => {
    if (tab === "progress") return update.type === "progress_update";
    if (tab === "plans") return update.type === "plans_update";
    if (tab === "follow-up") return update.needsFollowUp;
    return true;
  });
}

/** A chip keeps the search and the category already chosen. */
function tabHrefFor(tab: (typeof TABS)[number], q: string, category: string) {
  const query = new URLSearchParams();
  if (tab !== "recent") query.set("tab", tab);
  if (q) query.set("q", q);
  if (category) query.set("category", category);
  const rest = query.toString();
  return rest ? `${BASE}?${rest}` : BASE;
}

export default async function UpdatesScreen({ searchParams }: ScreenProps) {
  const tab = tabParam(searchParams, TABS, "recent");
  const [context, updates] = await Promise.all([
    getPortalContext(),
    listUpdates(),
  ]);

  const search = (param(searchParams, "q") ?? "").trim();
  const category = param(searchParams, "category") ?? "";

  const inTab = inTabOf(updates, tab);

  /*
   * Search over the headline, the body and the Request.
   *
   * This is the screen a client comes back to in order to find out what was
   * said about something months ago, and it was a reverse-chronological feed
   * with four tabs and no way to ask a question of it. The body is searched
   * here, unlike Messages: an update is one row with its whole text already in
   * hand, so there is nothing further to fetch.
   */
  const visible = inTab.filter((update) => {
    if (category && (update.category ?? "") !== category) return false;
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      (update.headline?.toLowerCase().includes(needle) ?? false) ||
      update.body.toLowerCase().includes(needle) ||
      (update.requestTitle?.toLowerCase().includes(needle) ?? false)
    );
  });

  const categories = [
    ...new Set(updates.map((update) => update.category).filter(Boolean)),
  ].sort() as string[];

  const closeHref = tabHrefFor(tab, search, category);

  return (
    <PageBody>
      <PageIntro note="Where active work stands, and anything you want your team to know." />
      <DataNotice context={context} />

      <ListPanel
        controls={
          <>
            <PanelSearch
              action={BASE}
              placeholder="Search updates"
              value={search}
              hidden={{ tab: tab === "recent" ? undefined : tab }}
              selects={
                categories.length > 0
                  ? [
                      {
                        name: "category",
                        anyLabel: "All categories",
                        value: category,
                        options: categories.map((one) => ({ value: one, label: one })),
                      },
                    ]
                  : []
              }
              trailing={
                // A view-only member is offered nothing to press: their grant
                // is sight of this area, and the action behind the button
                // would refuse them.
                context.viewOnly ? null : (
                  <PanelAction href={`${BASE}?tab=plans&compose=1`}>+ Share an update</PanelAction>
                )
              }
            />
            {/* Needs Follow-Up counted in red: it is the one of the four that
                is asking something of the reader. */}
            <ChipNav
              label="Update kind"
              active={tab}
              chips={TABS.map((key) => ({
                key,
                label: LABELS[key],
                href: tabHrefFor(key, search, category),
                count: inTabOf(updates, key).length,
                urgent: key === "follow-up",
              }))}
            />
          </>
        }
      >
        <UpdateFeed
          updates={visible}
          emptyTitle={search || category ? "Nothing matches that" : emptyTitle(tab)}
          emptyBody={
            search || category
              ? "No update here mentions that. Clear the filters to see the rest."
              : emptyBody(tab) ?? ""
          }
          emptyAction={
            search || category
              ? { label: "Clear filters", href: tabHrefFor(tab, "", "") }
              : undefined
          }
          viewerName={context.displayName}
        />
      </ListPanel>

      {/* The modal is opened by a query param anyone can type, so it is gated
          as well as the button that sets it. */}
      {flag(searchParams, "compose") && !context.viewOnly ? (
        <ShareUpdateModal closeHref={closeHref} />
      ) : null}
    </PageBody>
  );
}

function emptyTitle(tab: (typeof TABS)[number]) {
  if (tab === "plans") return "You haven't shared anything yet";
  if (tab === "follow-up") return "Nothing needs your follow-up right now.";
  return "No updates yet";
}

function emptyBody(tab: (typeof TABS)[number]): string | null {
  if (tab === "plans") {
    return "Tell your team about a trip, a change at home, or anything else they should know. Sharing an update never creates a request on its own.";
  }
  if (tab === "follow-up") {
    return null;
  }
  return "Your team posts here as active work moves forward.";
}

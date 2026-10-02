import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listRequests } from "@/client-portal/lib/data/requests";
import { matchesRequestTab, REQUEST_TABS, type RequestTab } from "@/client-portal/lib/status";
import { flag, param, tabParam, type ScreenProps } from "@/client-portal/lib/routing";
import { PageBody } from "@/client-portal/components/PageHeader";
import { ChipNav } from "@/client-portal/components/ChipNav";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { RequestTable } from "@/client-portal/components/RequestTable";
import { ListPanel, PanelAction, PanelSearch } from "@/client-portal/components/Panel";
import { NewRequestModal } from "./components/NewRequestModal";

const TABS = Object.keys(REQUEST_TABS) as RequestTab[];
const BASE = "/client-portal/requests";

/**
 * A chip keeps the search, the urgency and the sort you already chose.
 * Changing which bucket you are looking at is not a reason to lose the
 * question you were asking of it.
 */
function tabHrefFor(tab: RequestTab, q: string, urgency: string, sort: string) {
  const query = new URLSearchParams();
  if (tab !== "all") query.set("tab", tab);
  if (q) query.set("q", q);
  if (urgency) query.set("urgency", urgency);
  if (sort) query.set("sort", sort);
  const rest = query.toString();
  return rest ? `${BASE}?${rest}` : BASE;
}

export default async function RequestsScreen({ searchParams }: ScreenProps) {
  const tab = tabParam(searchParams, TABS, "all");
  const [context, requests] = await Promise.all([
    getPortalContext(),
    listRequests(),
  ]);

  const search = (param(searchParams, "q") ?? "").trim();
  const urgency = param(searchParams, "urgency") ?? "";
  const sort = param(searchParams, "sort") ?? "";

  const inTab = requests.filter((request) => matchesRequestTab(request.status, tab));

  const matched = inTab.filter((request) => {
    if (urgency && (request.urgency ?? "") !== urgency) return false;
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      request.title.toLowerCase().includes(needle) ||
      (request.description?.toLowerCase().includes(needle) ?? false) ||
      (request.nextStep?.toLowerCase().includes(needle) ?? false)
    );
  });

  /*
   * Most recently updated first by default, which is the order the list was
   * already in and the one a client reads it in: what moved is what they have
   * not seen. "Oldest" is offered because the opposite question — what has been
   * sitting untouched — is the other reason to open this screen.
   */
  const visible = [...matched].sort((a, b) =>
    sort === "oldest"
      ? a.updatedAt.localeCompare(b.updatedAt)
      : sort === "title"
        ? a.title.localeCompare(b.title)
        : b.updatedAt.localeCompare(a.updatedAt),
  );

  const filtered = Boolean(search || urgency);

  return (
    <PageBody>
      <DataNotice context={context} />

      <ListPanel
        controls={
          <>
            <PanelSearch
              action={BASE}
              placeholder="Search requests"
              value={search}
              hidden={{ tab: tab === "all" ? undefined : tab }}
              selects={[
                {
                  name: "urgency",
                  anyLabel: "Any urgency",
                  value: urgency,
                  options: [
                    { value: "critical", label: "Critical" },
                    { value: "high", label: "High" },
                    { value: "medium", label: "Medium" },
                    { value: "low", label: "Low" },
                  ],
                },
              ]}
              sort={{
                name: "sort",
                anyLabel: "Recently updated",
                value: sort,
                options: [
                  { value: "oldest", label: "Least recently updated" },
                  { value: "title", label: "Title A–Z" },
                ],
              }}
              trailing={
                // A view-only member is offered nothing to press: their grant
                // is sight of this area, and the action behind the button
                // would refuse them.
                context.viewOnly ? null : (
                  <PanelAction href={`${BASE}?new=1`}>+ New Request</PanelAction>
                )
              }
            />
            {/* Counted before they are opened: how much is active, how much is
                waiting on somebody, how much is done. */}
            <ChipNav
              label="Request state"
              active={tab}
              chips={TABS.map((key) => ({
                key,
                label: REQUEST_TABS[key],
                href: tabHrefFor(key, search, urgency, sort),
                count: requests.filter((request) => matchesRequestTab(request.status, key)).length,
              }))}
            />
          </>
        }
      >
        <RequestTable
          requests={visible}
          emptyTitle={filtered ? "Nothing matches that" : "No requests yet"}
          emptyBody={
            filtered
              ? "Try a different word, or clear the filters to see everything in this tab."
              : "Anything you need coordinated starts here."
          }
          emptyAction={
            filtered
              ? { label: "Clear filters", href: tabHrefFor(tab, "", "", "") }
              : context.viewOnly
                ? undefined
                : { label: "+ New Request", href: `${BASE}?new=1` }
          }
        />
      </ListPanel>

      {/* The modal is opened by a query param anyone can type, so it is gated
          as well as the button that sets it. */}
      {flag(searchParams, "new") && !context.viewOnly ? (
        <NewRequestModal closeHref={tabHrefFor(tab, search, urgency, sort)} />
      ) : null}
    </PageBody>
  );
}

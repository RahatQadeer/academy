import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug } from "@/base/switcher/products";
import { resolvePortalRoute } from "@/client-portal/routes";
import WhitbyPage from "@/whitbyos/page";
import WhitbyClients from "@/whitbyos/clients/page";
import WhitbyWorkspaces from "@/whitbyos/workspaces/page";
import WhitbyArchivedWorkspaces from "@/whitbyos/workspaces/archived/page";
import WhitbyClientDetail from "@/whitbyos/clients/[id]/page";
import WhitbyClientSetup from "@/whitbyos/clients/[id]/setup/page";
import WhitbyIntegrations from "@/whitbyos/integrations/page";
import WhitbyGmailContext from "@/whitbyos/integrations/gmail/page";
import WhitbyAsk from "@/whitbyos/ask/page";
import WhitbyRequests from "@/whitbyos/requests/page";
import WhitbyTasks from "@/whitbyos/tasks/page";
import WhitbyTask from "@/whitbyos/tasks/[id]/page";
import WhitbyContacts from "@/whitbyos/contacts/page";
import WhitbySettings from "@/whitbyos/settings/page";
import WhitbyPlaybooks from "@/whitbyos/playbooks/page";
import WhitbyUpdates from "@/whitbyos/updates/page";
import WhitbyForms from "@/whitbyos/forms/page";
import WhitbyKnowledge from "@/whitbyos/knowledge/page";
import WhitbyInsights from "@/whitbyos/insights/page";
import WhitbyReports from "@/whitbyos/reports/page";
import WhitbyReportDetail from "@/whitbyos/reports/[id]/page";
import WhitbyKnowledgeDetail from "@/whitbyos/knowledge/[id]/page";
import WhitbyFormBuilder from "@/whitbyos/forms/[id]/page";
import WhitbyPlaybookDetail from "@/whitbyos/playbooks/[id]/page";
import WhitbyNewPlaybook from "@/whitbyos/playbooks/new/page";
import WhitbyPlaybookSource from "@/whitbyos/playbooks/new/source/page";
import WhitbyPlaybookDetails from "@/whitbyos/playbooks/new/details/page";
import WhitbyPlaybookStreams from "@/whitbyos/playbooks/new/streams/page";
import WhitbyPlaybookSaved from "@/whitbyos/playbooks/new/saved/page";
import WhitbySettingsProfile from "@/whitbyos/settings/profile/page";
import WhitbySettingsWorkspace from "@/whitbyos/settings/workspace/page";
import WhitbySettingsOrganization from "@/whitbyos/settings/organization/page";
import WhitbySettingsPublic from "@/whitbyos/settings/public-information/page";
import WhitbySettingsTeam from "@/whitbyos/settings/team/page";
import WhitbySettingsNotifications from "@/whitbyos/settings/notifications/page";
import WhitbySettingsBilling from "@/whitbyos/settings/billing/page";
import WhitbySettingsSecurity from "@/whitbyos/settings/security/page";
import WhitbySettingsArchive from "@/whitbyos/settings/archive/page";
import WhitbySettingsInvoices from "@/whitbyos/settings/invoices/page";
import WhitbyContactDetail from "@/whitbyos/contacts/[id]/page";
import WhitbyCalendar from "@/whitbyos/calendar/page";
import WhitbyMessages from "@/whitbyos/messages/page";
import WhitbyDocuments from "@/whitbyos/documents/page";
import WhitbyInvoices from "@/whitbyos/invoices/page";
import WhitbyProviders from "@/whitbyos/providers/page";
import WhitbyProviderDetail from "@/whitbyos/providers/[id]/page";
import WhitbyWaiting from "@/whitbyos/waiting/page";
import WhitbyWorkPlans from "@/whitbyos/work-plans/page";
import WhitbyCreateWorkPlan from "@/whitbyos/work-plans/new/page";
import WhitbyWorkstreamDetail from "@/whitbyos/work-plans/[id]/streams/[streamId]/page";
import WhitbyTaskDetail from "@/whitbyos/work-plans/[id]/tasks/[taskId]/page";
import WhitbyConfigurePlan from "@/whitbyos/work-plans/new/configure/page";
import WhitbyPlaybookPlan from "@/whitbyos/work-plans/new/playbook/page";
import WhitbyImportPlan from "@/whitbyos/work-plans/new/import/page";
import WhitbyWorkPlanDetail from "@/whitbyos/work-plans/[id]/page";
import WhitbyWorkPlanPrint from "@/whitbyos/work-plans/[id]/print/page";
import WhitbyClientChecklist from "@/whitbyos/work-plans/[id]/checklist/page";
import WhitbyYourChecklist from "@/whitbyos/work-plans/[id]/yours/page";
import WhitbyPlanDrafts from "@/whitbyos/work-plans/[id]/drafts/page";
import WhitbyPlanReview from "@/whitbyos/requests/[id]/plan/page";
import WhitbyRefinePlan from "@/whitbyos/requests/[id]/plan/refine/page";
import WhitbyRequestDetail from "@/whitbyos/requests/[id]/page";
import { REQUEST_TAB_SLUGS } from "@/whitbyos/lib/request-detail";
import { CLIENT_TABS } from "@/whitbyos/clients/[id]/components/ClientTabs";
import { resolveAcademyRoute } from "@/academy/resolveRoute";
import {
  PARTNER_SLUGS,
  resolvePartnerRoute,
} from "@/partner-center/routes";
import PartnerPage from "@/partner-center/page";

type SearchParams = Record<string, string | string[] | undefined>;

/** Landing screen for products that do not use a dedicated resolver. */
const PAGES = {
  whitbyos: WhitbyPage,
  "partner-center": PartnerPage,
} as const;


export function generateStaticParams() {
  return [
    { product: "whitbyos" },
    { product: "client-portal" },
    { product: "academy" },
    { product: "partner-center" },
    ...PARTNER_SLUGS.map((slug) => ({ product: "partner-center", slug })),
  ];
}

/**
 * Fixed screens built inside a product folder, keyed by "<product>/<slug path>".
 * Add one line here when you add a screen; anything unmatched falls back to the
 * product's landing page so no nav item 404s.
 */
const SCREENS: Record<
  string,
  React.ComponentType<{ searchParams?: SearchParams }>
> = {
  "whitbyos/clients": WhitbyClients,
  "whitbyos/workspaces": WhitbyWorkspaces,
  "whitbyos/workspaces/archived": WhitbyArchivedWorkspaces,
  "whitbyos/integrations": WhitbyIntegrations,
  "whitbyos/integrations/gmail": WhitbyGmailContext,
  "whitbyos/ask": WhitbyAsk,
  "whitbyos/requests": WhitbyRequests,
  "whitbyos/tasks": WhitbyTasks,
  "whitbyos/contacts": WhitbyContacts,
  "whitbyos/playbooks": WhitbyPlaybooks,
  "whitbyos/playbooks/new": WhitbyNewPlaybook,
  "whitbyos/playbooks/new/source": WhitbyPlaybookSource,
  "whitbyos/playbooks/new/details": WhitbyPlaybookDetails,
  "whitbyos/playbooks/new/streams": WhitbyPlaybookStreams,
  "whitbyos/playbooks/new/saved": WhitbyPlaybookSaved,
  "whitbyos/updates": WhitbyUpdates,
  "whitbyos/forms": WhitbyForms,
  "whitbyos/knowledge": WhitbyKnowledge,
  "whitbyos/insights": WhitbyInsights,
  "whitbyos/reports": WhitbyReports,
  "whitbyos/settings": WhitbySettings,
  "whitbyos/settings/profile": WhitbySettingsProfile,
  "whitbyos/settings/workspace": WhitbySettingsWorkspace,
  "whitbyos/settings/organization": WhitbySettingsOrganization,
  "whitbyos/settings/public-information": WhitbySettingsPublic,
  "whitbyos/settings/team": WhitbySettingsTeam,
  "whitbyos/settings/notifications": WhitbySettingsNotifications,
  "whitbyos/settings/billing": WhitbySettingsBilling,
  "whitbyos/settings/invoices": WhitbySettingsInvoices,
  "whitbyos/settings/security": WhitbySettingsSecurity,
  "whitbyos/settings/archive": WhitbySettingsArchive,
  "whitbyos/providers": WhitbyProviders,
  "whitbyos/documents": WhitbyDocuments,
  "whitbyos/invoices": WhitbyInvoices,
  "whitbyos/calendar": WhitbyCalendar,
  "whitbyos/messages": WhitbyMessages,
  "whitbyos/waiting": WhitbyWaiting,
  "whitbyos/work-plans": WhitbyWorkPlans,
  // Registered before the dynamic matcher, so "new" is never read as a plan id.
  "whitbyos/work-plans/new": WhitbyCreateWorkPlan,
  "whitbyos/work-plans/new/configure": WhitbyConfigurePlan,
  "whitbyos/work-plans/new/playbook": WhitbyPlaybookPlan,
  "whitbyos/work-plans/new/import": WhitbyImportPlan,
};

const CLIENT_TAB_SLUGS = new Set(CLIENT_TABS.map((tab) => tab.slug));

/**
 * Screens with an id in the path. Kept as an explicit function rather than a
 * pattern table so each route stays readable and typed.
 */
function resolveDynamic(
  product: string,
  segments: string[],
  query: SearchParams,
) {
  // /whitbyos/ask/<id> — one conversation
  if (product === "whitbyos" && segments[0] === "ask" && segments.length === 2) {
    return <WhitbyAsk threadId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/reports/<id>
  if (product === "whitbyos" && segments[0] === "reports" && segments.length === 2) {
    return <WhitbyReportDetail reportId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/knowledge/<id>
  if (product === "whitbyos" && segments[0] === "knowledge" && segments.length === 2) {
    return <WhitbyKnowledgeDetail fileId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/forms/<id>
  if (product === "whitbyos" && segments[0] === "forms" && segments.length === 2) {
    return <WhitbyFormBuilder formId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/playbooks/<id>
  if (product === "whitbyos" && segments[0] === "playbooks" && segments.length === 2) {
    return <WhitbyPlaybookDetail playbookId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/contacts/<id>
  if (product === "whitbyos" && segments[0] === "contacts" && segments.length === 2) {
    return <WhitbyContactDetail contactId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/providers/<id>
  if (product === "whitbyos" && segments[0] === "providers" && segments.length === 2) {
    return <WhitbyProviderDetail providerId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/work-plans/<id> — ?task= and ?stream= open WP.18 / WP.19 over it
  // /whitbyos/work-plans/<id>/streams/<streamId> — WP.17g–i
  if (
    product === "whitbyos" &&
    segments[0] === "work-plans" &&
    segments.length === 4 &&
    segments[2] === "streams"
  ) {
    return (
      <WhitbyWorkstreamDetail
        planId={segments[1]!}
        streamId={segments[3]!}
        searchParams={query}
      />
    );
  }

  // /whitbyos/tasks/<id> — one task, wherever it came from
  if (product === "whitbyos" && segments[0] === "tasks" && segments.length === 2) {
    return <WhitbyTask taskId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/work-plans/<id>/tasks/<taskId> — WP.18 read-side
  if (
    product === "whitbyos" &&
    segments[0] === "work-plans" &&
    segments.length === 4 &&
    segments[2] === "tasks"
  ) {
    return (
      <WhitbyTaskDetail planId={segments[1]!} taskId={segments[3]!} searchParams={query} />
    );
  }

  // /whitbyos/work-plans/<id>/checklist — what the client still has to send
  if (
    product === "whitbyos" &&
    segments[0] === "work-plans" &&
    segments.length === 3 &&
    segments[2] === "checklist"
  ) {
    return <WhitbyClientChecklist planId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/work-plans/<id>/yours — what only the professional can do
  if (
    product === "whitbyos" &&
    segments[0] === "work-plans" &&
    segments.length === 3 &&
    segments[2] === "yours"
  ) {
    return <WhitbyYourChecklist planId={segments[1]!} />;
  }

  // /whitbyos/work-plans/<id>/drafts — what Whitby drafted on this plan
  if (
    product === "whitbyos" &&
    segments[0] === "work-plans" &&
    segments.length === 3 &&
    segments[2] === "drafts"
  ) {
    return <WhitbyPlanDrafts planId={segments[1]!} />;
  }

  // /whitbyos/work-plans/<id>/print — WP.24
  if (
    product === "whitbyos" &&
    segments[0] === "work-plans" &&
    segments.length === 3 &&
    segments[2] === "print"
  ) {
    // The query is WP.22's answers, which decide what the document contains.
    return <WhitbyWorkPlanPrint planId={segments[1]!} searchParams={query} />;
  }

  if (segments[0] === "work-plans" && segments.length === 2) {
    return <WhitbyWorkPlanDetail planId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/requests/<id>/plan/refine — 3.2.1
  if (
    product === "whitbyos" &&
    segments[0] === "requests" &&
    segments.length === 4 &&
    segments[2] === "plan" &&
    segments[3] === "refine"
  ) {
    return <WhitbyRefinePlan requestId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/requests/<id>/plan — 3.2, and 3.2.2 with ?updated=1
  if (
    product === "whitbyos" &&
    segments[0] === "requests" &&
    segments.length === 3 &&
    segments[2] === "plan"
  ) {
    return <WhitbyPlanReview requestId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/requests/<id>
  if (
    product === "whitbyos" &&
    segments[0] === "requests" &&
    segments.length === 2
  ) {
    return <WhitbyRequestDetail requestId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/requests/<id>/<tab> — 3.3t, 3.3n, 3.3d, 3.3w
  if (
    product === "whitbyos" &&
    segments[0] === "requests" &&
    segments.length === 3 &&
    REQUEST_TAB_SLUGS.has(segments[2] as never)
  ) {
    return (
      <WhitbyRequestDetail
        requestId={segments[1]!}
        tab={segments[2] as never}
        searchParams={query}
      />
    );
  }

  // /whitbyos/clients/<id>/setup — 2.2b. Registered before the tab matcher,
  // which would otherwise read "setup" as a tab it does not have and fall
  // through to the product's landing page.
  if (
    product === "whitbyos" &&
    segments[0] === "clients" &&
    segments.length === 3 &&
    segments[2] === "setup"
  ) {
    return <WhitbyClientSetup clientId={segments[1]!} searchParams={query} />;
  }

  // /whitbyos/clients/<id> and /whitbyos/clients/<id>/<tab>
  if (
    product === "whitbyos" &&
    segments[0] === "clients" &&
    segments.length >= 2 &&
    segments.length <= 3
  ) {
    const tab = segments[2] ?? "";
    if (!CLIENT_TAB_SLUGS.has(tab as never)) return null;
    return (
      <WhitbyClientDetail
        clientId={segments[1]!}
        tab={tab as never}
        searchParams={query}
      />
    );
  }

  return null;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ product: string; slug?: string[] }>;
}): Promise<Metadata> {
  const { product: slug, slug: rest } = await params;
  const product = getProductBySlug(slug);
  const path = (rest ?? []).join("/");

  if (slug === "partner-center") {
    if (path === "admin" || path.startsWith("admin/")) {
      return { title: "Partner Admin · Partner Center" };
    }
    return { title: "Partner Center" };
  }

  if (product) {
    return { title: product.name };
  }

  return {};
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ product: string; slug?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { product: slug, slug: rest } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const segments = rest ?? [];
  const path = segments.join("/");
  const query = await searchParams;

  if (slug === "academy") {
    return resolveAcademyRoute(path, segments, query);
  }

  if (slug === "client-portal") {
    return resolvePortalRoute(segments, query);
  }

  if (slug === "partner-center") {
    const screen = await resolvePartnerRoute(path, query);
    if (screen) return screen;
  }

  const Screen = SCREENS[`${slug}/${path}`];
  if (Screen) {
    return <Screen searchParams={query} />;
  }

  const matched = resolveDynamic(slug, segments, query);
  if (matched) return matched;

  const Page = PAGES[slug as keyof typeof PAGES];
  if (!Page) notFound();
  // The landing page reads the query too — Whitby's Home carries the search.
  return <Page searchParams={query} />;
}

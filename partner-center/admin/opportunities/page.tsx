import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { OpportunitiesView } from "@/super-admin/partner-center/opportunities/components/OpportunitiesView";
import {
  loadAdminOpportunities,
  parseOpportunityTab,
} from "@/super-admin/partner-center/lib/load-admin-data";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PartnerAdminOpportunitiesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const tab = parseOpportunityTab(searchParams?.tab);
  const [result, submitted] = await Promise.all([
    loadAdminOpportunities(tab),
    tab === "submitted"
      ? Promise.resolve(null)
      : loadAdminOpportunities("submitted"),
  ]);
  const submittedCount =
    tab === "submitted"
      ? result.items.length
      : (submitted?.items.length ?? 0);

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Opportunities"
          description="Enterprise deals — Accept, In progress, or Close."
        />
        <AdminDataNotice configured={result.configured} />
        {result.error ? (
          <AdminLoadError
            message={result.error}
            retryHref={PA_ADMIN.opportunities}
          />
        ) : null}
        <OpportunitiesView
          items={result.items}
          activeTab={tab}
          submittedCount={submittedCount}
        />
      </div>
    </PartnerAdminShell>
  );
}

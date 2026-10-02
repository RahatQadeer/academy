import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
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
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export default async function OpportunitiesAdminPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tab = parseOpportunityTab(searchParams?.tab);
  const result = await loadAdminOpportunities(tab);

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Opportunities"
          description="Partner-submitted enterprise opportunities."
        />
        <AdminDataNotice configured={result.configured} />
        {result.error ? (
          <AdminLoadError message={result.error} retryHref={PC_ADMIN.opportunities} />
        ) : null}
        <OpportunitiesView
          items={result.items}
          activeTab={tab}
          submittedCount={result.submittedCount}
        />
      </div>
    </PartnerCenterAdminShell>
  );
}

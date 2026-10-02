import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { ApplicationsView } from "@/super-admin/partner-center/applications/components/ApplicationsView";
import {
  loadApplications,
  parseApplicationTab,
} from "@/super-admin/partner-center/lib/load-admin-data";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ApplicationsAdminPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const tab = parseApplicationTab(searchParams?.tab);
  const result = await loadApplications(tab);

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Applications"
          description="Review and decide on applications."
        />
        <AdminDataNotice configured={result.configured} />
        {result.error ? (
          <AdminLoadError message={result.error} retryHref={PC_ADMIN.applications} />
        ) : null}
        <ApplicationsView items={result.items} activeTab={tab} />
      </div>
    </PartnerCenterAdminShell>
  );
}

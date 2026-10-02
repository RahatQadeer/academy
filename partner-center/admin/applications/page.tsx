import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
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
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PartnerAdminApplicationsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const tab = parseApplicationTab(searchParams?.tab);
  const result = await loadApplications(tab);

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Applications"
          description="Review and decide on partner applications."
        />
        <AdminDataNotice configured={result.configured} />
        {result.error ? (
          <AdminLoadError message={result.error} retryHref={PA_ADMIN.applications} />
        ) : null}
        <ApplicationsView items={result.items} activeTab={tab} />
      </div>
    </PartnerAdminShell>
  );
}

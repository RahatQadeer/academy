import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PartnerCenterDashboardView } from "@/super-admin/partner-center/components/PartnerCenterDashboardView";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { AdminDataNotice } from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { loadDashboardStats } from "@/super-admin/partner-center/lib/load-admin-data";

export default async function PartnerCenterAdminPage() {
  const stats = await loadDashboardStats();

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Dashboard"
          description="At-a-glance partner activity."
        />
        <AdminDataNotice configured={stats.configured} />
        <PartnerCenterDashboardView
          pendingApplications={stats.pendingApplications}
          submittedOpportunities={stats.submittedOpportunities}
          activePartners={stats.activePartners}
          failedPayouts={stats.failedPayouts}
        />
      </div>
    </PartnerCenterAdminShell>
  );
}

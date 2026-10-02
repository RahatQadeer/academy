import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { PartnerCenterDashboardView } from "@/super-admin/partner-center/components/PartnerCenterDashboardView";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { AdminDataNotice } from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { loadDashboardStats } from "@/super-admin/partner-center/lib/load-admin-data";

export default async function PartnerAdminDashboardPage() {
  const stats = await loadDashboardStats();

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Dashboard"
          description="What needs attention across partners right now."
        />
        <AdminDataNotice configured={stats.configured} />
        <PartnerCenterDashboardView
          pendingApplications={stats.pendingApplications}
          submittedOpportunities={stats.submittedOpportunities}
          activePartners={stats.activePartners}
          failedPayouts={stats.failedPayouts}
        />
      </div>
    </PartnerAdminShell>
  );
}

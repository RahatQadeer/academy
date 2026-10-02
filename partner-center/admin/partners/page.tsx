import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { PartnersView } from "@/super-admin/partner-center/partners/components/PartnersView";
import { loadPartners } from "@/super-admin/partner-center/lib/load-admin-data";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

export default async function PartnerAdminPartnersPage() {
  const result = await loadPartners();

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Partners"
          description="Active partners and payout readiness."
        />
        <AdminDataNotice configured={result.configured} />
        {result.error ? (
          <AdminLoadError message={result.error} retryHref={PA_ADMIN.partners} />
        ) : null}
        <PartnersView items={result.items} />
      </div>
    </PartnerAdminShell>
  );
}

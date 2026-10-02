import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { PartnersView } from "@/super-admin/partner-center/partners/components/PartnersView";
import { loadPartners } from "@/super-admin/partner-center/lib/load-admin-data";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export default async function PartnersAdminPage() {
  const result = await loadPartners();

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Partners"
          description="Active partners and payout readiness."
        />
        <AdminDataNotice configured={result.configured} />
        {result.error ? (
          <AdminLoadError message={result.error} retryHref={PC_ADMIN.partners} />
        ) : null}
        <PartnersView items={result.items} />
      </div>
    </PartnerCenterAdminShell>
  );
}

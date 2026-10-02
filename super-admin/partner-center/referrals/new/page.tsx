import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { AdminBackLink } from "@/super-admin/partner-center/components/AdminDetailSections";
import {
  AdminDataNotice,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { ReferralCreateForm } from "@/super-admin/partner-center/referrals/components/ReferralCreateForm";
import { isAdminDataConfigured } from "@/super-admin/partner-center/lib/admin-client";
import { loadAdminPartnerOptions } from "@/super-admin/partner-center/lib/load-admin-data";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export default async function CreateReferralAdminPage() {
  const configured = isAdminDataConfigured();
  const partners = configured ? await loadAdminPartnerOptions() : [];

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminBackLink href={PC_ADMIN.referrals} label="Referrals" />
        <AdminPageHeader
          title="Create referral"
          description="Manually attribute a missed referral."
        />
        <AdminDataNotice configured={configured} />
        <ReferralCreateForm partners={partners} />
      </div>
    </PartnerCenterAdminShell>
  );
}

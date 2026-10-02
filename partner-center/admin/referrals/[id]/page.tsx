import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import {
  AdminBackLink,
  AdminDetailField,
  AdminDetailSection,
} from "@/super-admin/partner-center/components/AdminDetailSections";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { loadAdminReferralDetail } from "@/super-admin/partner-center/lib/load-admin-data";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

export default async function PartnerAdminReferralDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadAdminReferralDetail(id);

  if (!result.data) {
    return (
      <PartnerAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink href={PA_ADMIN.referrals} label="Referrals" />
          <AdminDataNotice configured={result.configured} />
          {result.error ? (
            <AdminLoadError message={result.error} retryHref={PA_ADMIN.referral(id)} />
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>Referral not found.</p>
          )}
        </div>
      </PartnerAdminShell>
    );
  }

  const data = result.data;

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminBackLink href={PA_ADMIN.referrals} label="Referrals" />
        <AdminPageHeader title="Referral" description="View only" />
        <AdminDetailSection title="Details">
          <AdminDetailField label="Status" value={data.status} />
          <AdminDetailField label="Program" value={data.program} />
          <AdminDetailField label="Partner" value={data.partnerCompanyName} />
          <AdminDetailField label="Referred email" value={data.referredEmail} />
        </AdminDetailSection>
      </div>
    </PartnerAdminShell>
  );
}

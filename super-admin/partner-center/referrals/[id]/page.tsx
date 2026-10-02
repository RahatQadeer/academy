import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { ReferralCorrectAttribution } from "@/super-admin/partner-center/referrals/components/ReferralCorrectAttribution";
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
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import { loadAdminReferralDetail } from "@/super-admin/partner-center/lib/load-admin-data";
import {
  formatShortDate,
  referralProgramLabel,
  referralStatusLabel,
  referralStatusTone,
} from "@/super-admin/partner-center/lib/format";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export default async function ReferralDetailAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadAdminReferralDetail(id);

  if (!result.data) {
    return (
      <PartnerCenterAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink href={PC_ADMIN.referrals} label="Referrals" />
          <AdminDataNotice configured={result.configured} />
          {result.error ? (
            <AdminLoadError
              message={result.error}
              retryHref={PC_ADMIN.referral(id)}
            />
          ) : (
            <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
              Referral not found.
            </p>
          )}
        </div>
      </PartnerCenterAdminShell>
    );
  }

  const { data } = result;

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminBackLink href={PC_ADMIN.referrals} label="Referrals" />
        <AdminPageHeader
          title={data.referredName || data.referredEmail || "Referral"}
          description={`Attributed to ${data.partnerCompanyName}`}
        />
        <div className="mb-6">
          <AdminStatusPill
            label={referralStatusLabel(data.status)}
            tone={referralStatusTone(data.status)}
          />
        </div>

        <div className="grid gap-5">
          <AdminDetailSection title="Referral">
            <AdminDetailField
              label="Program"
              value={referralProgramLabel(data.program)}
            />
            <AdminDetailField label="Source" value={data.source} />
            <AdminDetailField label="Product" value={data.product} />
            <AdminDetailField
              label="Referral date"
              value={formatShortDate(data.referralDate)}
            />
            <AdminDetailField
              label="Conversion date"
              value={formatShortDate(data.conversionEventDate)}
            />
          </AdminDetailSection>

          <AdminDetailSection title="Referred person">
            <AdminDetailField label="Name" value={data.referredName} />
            <AdminDetailField label="Email" value={data.referredEmail} />
            <AdminDetailField label="User id" value={data.referredUserId} />
          </AdminDetailSection>

          <AdminDetailSection title="Current partner">
            <AdminDetailField label="Company" value={data.partnerCompanyName} />
            <AdminDetailField
              label="Partner profile"
              value={data.partnerProfileId}
            />
          </AdminDetailSection>

          <ReferralCorrectAttribution
            referralId={data.id}
            currentPartnerProfileId={data.partnerProfileId}
            partners={result.partners}
            disabled={data.hasPaidEarnings}
          />
        </div>
      </div>
    </PartnerCenterAdminShell>
  );
}

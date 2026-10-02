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
import { OpportunityReviewActions } from "@/super-admin/partner-center/opportunities/components/OpportunityReviewActions";
import { loadAdminOpportunityDetail } from "@/super-admin/partner-center/lib/load-admin-data";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";
import Link from "next/link";

export default async function PartnerAdminOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadAdminOpportunityDetail(id);

  if (!result.data) {
    return (
      <PartnerAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink href={PA_ADMIN.opportunities} label="Opportunities" />
          <AdminDataNotice configured={result.configured} />
          {result.error ? (
            <AdminLoadError
              message={result.error}
              retryHref={PA_ADMIN.opportunity(id)}
            />
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>Opportunity not found.</p>
          )}
        </div>
      </PartnerAdminShell>
    );
  }

  const data = result.data;

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminBackLink href={PA_ADMIN.opportunities} label="Opportunities" />
        <AdminPageHeader
          title={data.companyName}
          description={`Submitted by ${data.partnerCompanyName}`}
        />
        <AdminDetailSection title="Details">
          <AdminDetailField label="Status" value={data.status} />
          <AdminDetailField
            label="Product interest"
            value={data.productInterestLabel ?? data.productInterest}
          />
          <AdminDetailField
            label="Estimated value"
            value={
              data.estimatedValue != null ? String(data.estimatedValue) : null
            }
          />
          <AdminDetailField label="Expected timing" value={data.expectedTiming} />
          <AdminDetailField label="Context" value={data.additionalContext} fullWidth />
        </AdminDetailSection>
        <OpportunityReviewActions
          opportunityId={data.id}
          status={data.status}
          partnerProfileId={data.partnerProfileId}
          staffKind="partner"
        />
        <div className="mt-4">
          <Link
            href={PA_ADMIN.message(data.partnerProfileId)}
            className="text-[13.5px] font-medium underline"
          >
            Message partner (Partner Manager)
          </Link>
        </div>
      </div>
    </PartnerAdminShell>
  );
}

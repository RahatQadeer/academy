import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { ApplicationReviewActions } from "@/super-admin/partner-center/applications/components/ApplicationReviewActions";
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
import { displayBusinessType } from "@/partner-center/lib/application-map";
import { ACTIVITY_LEVELS } from "@/partner-center/types/application";
import { loadApplicationDetail } from "@/super-admin/partner-center/lib/load-admin-data";
import {
  profileStatusLabel,
  profileStatusTone,
  programInterestLabel,
} from "@/super-admin/partner-center/lib/format";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

function activityLabel(value: string) {
  const match = ACTIVITY_LEVELS.find((item) => item.value === value)?.label;
  return match || value || "—";
}

export default async function PartnerAdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadApplicationDetail(id);

  if (!result.data) {
    return (
      <PartnerAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink href={PA_ADMIN.applications} label="Applications" />
          <AdminDataNotice configured={result.configured} />
          {result.error ? (
            <AdminLoadError message={result.error} retryHref={PA_ADMIN.application(id)} />
          ) : (
            <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
              Application not found.
            </p>
          )}
        </div>
      </PartnerAdminShell>
    );
  }

  const { data } = result;
  const { application } = data;

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminBackLink href={PA_ADMIN.applications} label="Applications" />
        <AdminPageHeader
          title={data.companyName}
          description={`Submitted by ${data.contactName} · ${data.contactEmail}`}
          action={
            <AdminStatusPill
              label={profileStatusLabel(data.status)}
              tone={profileStatusTone(data.status)}
            />
          }
        />

        <div className="grid gap-5">
          <AdminDetailSection title="Business">
            <AdminDetailField label="Applying as" value={application.applying_as} />
            <AdminDetailField label="Legal name" value={application.legal_name} />
            <AdminDetailField label="Website" value={application.website} />
            <AdminDetailField
              label="Business type"
              value={displayBusinessType(application)}
            />
            <AdminDetailField label="Market" value={application.market} />
            <AdminDetailField
              label="Audience served"
              value={application.audience_served}
            />
            <AdminDetailField label="Address" value={application.address} fullWidth />
          </AdminDetailSection>

          <AdminDetailSection title="Contact">
            <AdminDetailField label="Primary contact" value={data.contactName} />
            <AdminDetailField label="Email" value={data.contactEmail} />
            <AdminDetailField label="Phone" value={data.contactPhone} />
          </AdminDetailSection>

          <AdminDetailSection title="Referral intent">
            <AdminDetailField
              label="Programs of interest"
              value={programInterestLabel(application.products_of_interest)}
            />
            <AdminDetailField
              label="Expected activity"
              value={activityLabel(application.expected_activity_level)}
            />
            <AdminDetailField
              label="Referral approach"
              value={application.referral_approach}
              fullWidth
            />
            <AdminDetailField
              label="Additional context"
              value={application.additional_context}
              fullWidth
            />
          </AdminDetailSection>
        </div>

        <ApplicationReviewActions
          profileId={data.id}
          status={data.status}
          defaultPrograms={application.products_of_interest}
          staffKind="partner"
        />
      </div>
    </PartnerAdminShell>
  );
}

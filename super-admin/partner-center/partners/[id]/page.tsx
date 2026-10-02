import Link from "next/link";
import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
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
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import { PartnerDetailShell } from "@/super-admin/partner-center/partners/components/PartnerDetailShell";
import { PartnerDocumentsAdminView } from "@/super-admin/partner-center/partners/components/PartnerDocumentsAdminView";
import { EditPartnerProgramsTermsForm } from "@/super-admin/partner-center/partners/components/EditPartnerProgramsTermsForm";
import {
  loadApplicationDetail,
  loadPartnerDetail,
} from "@/super-admin/partner-center/lib/load-admin-data";
import { loadAdminPartnerDocuments } from "@/super-admin/partner-center/partners/lib/load-partner-documents";
import {
  createAdminClient,
  isAdminDataConfigured,
} from "@/super-admin/partner-center/lib/admin-client";
import { loadPartnerProgramsAndTerms } from "@/super-admin/partner-center/services/savePartnerProgramsAndTerms";
import {
  profileStatusLabel,
  profileStatusTone,
  programInterestLabel,
} from "@/super-admin/partner-center/lib/format";
import { displayBusinessType } from "@/partner-center/lib/application-map";
import { ACTIVITY_LEVELS } from "@/partner-center/types/application";
import {
  PC_ADMIN,
  parsePartnerDetailSection,
} from "@/super-admin/partner-center/lib/paths";

function programLabel(program: string) {
  if (program === "academy") return "Academy";
  if (program === "platform") return "Whitby";
  if (program === "enterprise") return "Enterprise";
  return program;
}

function activityLabel(value: string) {
  const match = ACTIVITY_LEVELS.find((item) => item.value === value)?.label;
  return match || value || "—";
}

export default async function PartnerDetailAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { id } = await params;
  const section = parsePartnerDetailSection(searchParams?.section);
  const result = await loadPartnerDetail(id);

  if (!result.data) {
    return (
      <PartnerCenterAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink href={PC_ADMIN.partners} label="Partners" />
          <AdminDataNotice configured={result.configured} />
          {result.error ? (
            <AdminLoadError message={result.error} retryHref={PC_ADMIN.partner(id)} />
          ) : (
            <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
              Partner not found.
            </p>
          )}
        </div>
      </PartnerCenterAdminShell>
    );
  }

  const { data } = result;
  const programsSummary =
    data.programs.length > 0
      ? data.programs
          .map((p) => `${programLabel(p.program)}${p.active ? "" : " (inactive)"}`)
          .join(", ")
      : "No programs assigned";

  const documentsResult =
    section === "documents" ? await loadAdminPartnerDocuments(id) : null;
  const applicationResult =
    section === "application" ? await loadApplicationDetail(id) : null;
  const termsConfigured = isAdminDataConfigured();
  const termsAdmin = section === "terms" ? createAdminClient() : null;
  const termsData =
    section === "terms" && termsAdmin && termsConfigured
      ? await loadPartnerProgramsAndTerms(termsAdmin, id)
      : null;

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminBackLink href={PC_ADMIN.partners} label="Partners" />
        <AdminPageHeader
          title={data.companyName}
          description={`${data.contactName} · ${data.contactEmail}`}
        />
        <div className="mb-6">
          <AdminStatusPill
            label={profileStatusLabel(data.status)}
            tone={profileStatusTone(data.status)}
          />
        </div>

        <PartnerDetailShell partnerId={data.id} active={section}>
          {section === "details" ? (
            <div className="grid gap-5">
              <AdminDetailSection title="Company">
                <AdminDetailField label="Website" value={data.website} />
                <AdminDetailField label="Programs" value={programsSummary} />
                <AdminDetailField label="Agreement" value={data.agreementStatus} />
              </AdminDetailSection>

              <AdminDetailSection title="Primary contact">
                <AdminDetailField label="Name" value={data.contactName} />
                <AdminDetailField label="Email" value={data.contactEmail} />
                <AdminDetailField label="Phone" value={data.contactPhone} />
              </AdminDetailSection>

              <AdminDetailSection title="Payout readiness">
                <AdminDetailField label="Tax profile" value={data.taxProfileStatus} />
                <AdminDetailField
                  label="Payment setup"
                  value={data.paymentSetupStatus}
                />
                <AdminDetailField
                  label="Payout eligibility"
                  value={data.payoutEligibility.replace(/_/g, " ")}
                />
              </AdminDetailSection>

              <p
                className="m-0 text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Created {data.createdAt} · Updated {data.updatedAt}
              </p>
            </div>
          ) : null}

          {section === "documents" ? (
            !documentsResult?.configured ? (
              <AdminDataNotice configured={false} />
            ) : documentsResult.data ? (
              <PartnerDocumentsAdminView data={documentsResult.data} />
            ) : (
              <AdminLoadError
                message={
                  documentsResult.error ||
                  "Documents could not be loaded."
                }
                retryHref={PC_ADMIN.partnerSection(id, "documents")}
              />
            )
          ) : null}

          {section === "application" ? (
            applicationResult?.data ? (
              <PartnerApplicationPanel
                data={applicationResult.data}
              />
            ) : (
              <AdminLoadError
                message={
                  applicationResult?.error ||
                  "Application could not be loaded."
                }
                retryHref={PC_ADMIN.partnerSection(id, "application")}
              />
            )
          ) : null}

          {section === "terms" ? (
            !termsConfigured ? (
              <AdminDataNotice configured={false} />
            ) : termsData ? (
              <EditPartnerProgramsTermsForm initial={termsData} />
            ) : (
              <AdminLoadError
                message="Partner terms could not be loaded."
                retryHref={PC_ADMIN.partnerSection(id, "terms")}
              />
            )
          ) : null}
        </PartnerDetailShell>
      </div>
    </PartnerCenterAdminShell>
  );
}

function PartnerApplicationPanel({
  data,
}: {
  data: NonNullable<
    Awaited<ReturnType<typeof loadApplicationDetail>>["data"]
  >;
}) {
  const { application } = data;

  return (
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
          fullWidth
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

      {application.info_request?.active || application.info_request?.response ? (
        <AdminDetailSection title="Information request">
          <AdminDetailField
            label="Admin message"
            value={application.info_request.message}
            fullWidth
          />
          {application.info_request.response ? (
            <AdminDetailField
              label="Applicant reply"
              value={application.info_request.response}
              fullWidth
            />
          ) : application.info_request.active ? (
            <AdminDetailField
              label="Status"
              value="Waiting on applicant reply"
            />
          ) : null}
        </AdminDetailSection>
      ) : null}

      {application.decline_reason ? (
        <AdminDetailSection title="Decline reason">
          <AdminDetailField
            label="Reason"
            value={application.decline_reason}
            fullWidth
          />
        </AdminDetailSection>
      ) : null}

      <p className="m-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        Review actions stay on the Applications queue.{" "}
        <Link
          href={PC_ADMIN.application(data.id)}
          className="font-medium"
          style={{ color: "var(--accent)" }}
        >
          Open full application
        </Link>
      </p>
    </div>
  );
}

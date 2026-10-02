import Link from "next/link";
import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { cn } from "@/base/lib/cn";
import { OpportunityAttributionPanel } from "@/super-admin/partner-center/opportunities/components/OpportunityAttributionPanel";
import { OpportunityCorrectAttribution } from "@/super-admin/partner-center/opportunities/components/OpportunityCorrectAttribution";
import { OpportunityDetailShell } from "@/super-admin/partner-center/opportunities/components/OpportunityDetailShell";
import { OpportunityExtendProtection } from "@/super-admin/partner-center/opportunities/components/OpportunityExtendProtection";
import { OpportunityRecordPayment } from "@/super-admin/partner-center/opportunities/components/OpportunityRecordPayment";
import { OpportunityReviewActions } from "@/super-admin/partner-center/opportunities/components/OpportunityReviewActions";
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
import { loadAdminOpportunityDetail } from "@/super-admin/partner-center/lib/load-admin-data";
import {
  formatShortDate,
  opportunityStatusLabel,
  opportunityStatusTone,
} from "@/super-admin/partner-center/lib/format";
import {
  PC_ADMIN,
  parseOpportunityDetailSection,
} from "@/super-admin/partner-center/lib/paths";

export default async function OpportunityDetailAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { id } = await params;
  const result = await loadAdminOpportunityDetail(id);
  const section = parseOpportunityDetailSection(searchParams?.section);

  if (!result.data) {
    return (
      <PartnerCenterAdminShell>
        <div className={cn(PARTNER_PAGE_GUTTER, "pb-20")}>
          <AdminBackLink href={PC_ADMIN.opportunities} label="Opportunities" />
          <AdminDataNotice configured={result.configured} />
          {result.error ? (
            <AdminLoadError
              message={result.error}
              retryHref={PC_ADMIN.opportunity(id)}
            />
          ) : (
            <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
              Opportunity not found.
            </p>
          )}
        </div>
      </PartnerCenterAdminShell>
    );
  }

  const { data, partners } = result;
  const status = data.status || "submitted";
  const statusKey = status.toLowerCase();
  const canRecordPayment =
    statusKey === "accepted" ||
    statusKey === "in_progress" ||
    statusKey === "converted";

  return (
    <PartnerCenterAdminShell>
      <div className={cn(PARTNER_PAGE_GUTTER, "pb-20")}>
        <AdminBackLink href={PC_ADMIN.opportunities} label="Opportunities" />
        <AdminPageHeader
          title={data.companyName || "Opportunity"}
          description={`Submitted by ${data.partnerCompanyName}`}
        />
        <div className="mb-6">
          <AdminStatusPill
            label={opportunityStatusLabel(status)}
            tone={opportunityStatusTone(status)}
          />
        </div>

        <div className="mb-8">
          <OpportunityReviewActions
            opportunityId={data.id}
            status={status}
            partnerProfileId={data.partnerProfileId}
          />
        </div>

        <OpportunityDetailShell opportunityId={data.id} active={section}>
          {section === "details" ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <AdminDetailSection title="Prospect">
                <AdminDetailField label="Contact" value={data.contactName} />
                <AdminDetailField label="Email" value={data.contactEmail} />
                <AdminDetailField label="Title" value={data.contactTitle} />
                <AdminDetailField
                  label="Permission to contact"
                  value={data.permissionToContact ? "Yes" : "No"}
                />
              </AdminDetailSection>

              <AdminDetailSection title="Opportunity">
                <AdminDetailField
                  label="Product interest"
                  value={data.productInterestLabel || data.productInterest}
                />
                <AdminDetailField
                  label="Estimated seats"
                  value={data.estimatedSeats}
                />
                <AdminDetailField
                  label="Estimated value"
                  value={data.estimatedValue}
                />
                <AdminDetailField
                  label="Expected timing"
                  value={data.expectedTiming}
                />
                <AdminDetailField
                  label="Additional context"
                  value={data.additionalContext}
                  fullWidth
                />
                <AdminDetailField
                  label="Attachment"
                  value={
                    data.attachmentTitle ? (
                      <Link
                        href={PC_ADMIN.opportunityAttachment(data.id)}
                        style={{ color: "var(--accent)" }}
                      >
                        {data.attachmentTitle}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                  fullWidth
                />
              </AdminDetailSection>

              <AdminDetailSection title="Attribution">
                <AdminDetailField
                  label="Submitted"
                  value={formatShortDate(data.submittedAt)}
                />
                <AdminDetailField
                  label="Accepted"
                  value={
                    data.acceptedAt ? formatShortDate(data.acceptedAt) : "—"
                  }
                />
                <AdminDetailField
                  label="Protected until"
                  value={
                    data.protectedUntil
                      ? formatShortDate(data.protectedUntil)
                      : "—"
                  }
                />
                <AdminDetailField
                  label="Submitting partner"
                  value={
                    <Link
                      href={PC_ADMIN.partner(data.partnerProfileId)}
                      style={{ color: "var(--accent)" }}
                    >
                      {data.partnerCompanyName}
                    </Link>
                  }
                  fullWidth
                />
              </AdminDetailSection>
            </div>
          ) : null}

          {section === "payments" ? (
            <OpportunityAttributionPanel items={data.attributionItems} />
          ) : null}

          {section === "record-payment" ? (
            <OpportunityRecordPayment
              opportunityId={data.id}
              disabled={!canRecordPayment}
            />
          ) : null}

          {section === "extend-protection" ? (
            <OpportunityExtendProtection
              opportunityId={data.id}
              currentProtectedUntil={data.protectedUntil}
            />
          ) : null}

          {section === "correct-attribution" ? (
            <OpportunityCorrectAttribution
              opportunityId={data.id}
              currentPartnerProfileId={data.partnerProfileId}
              currentPartnerLabel={data.partnerCompanyName}
              partners={partners}
              disabled={data.hasPaidEarnings}
            />
          ) : null}
        </OpportunityDetailShell>
      </div>
    </PartnerCenterAdminShell>
  );
}

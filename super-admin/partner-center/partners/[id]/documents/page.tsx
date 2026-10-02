import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { AdminBackLink } from "@/super-admin/partner-center/components/AdminDetailSections";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { PartnerDocumentsAdminView } from "@/super-admin/partner-center/partners/components/PartnerDocumentsAdminView";
import { loadAdminPartnerDocuments } from "@/super-admin/partner-center/partners/lib/load-partner-documents";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export default async function PartnerDocumentsAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadAdminPartnerDocuments(id);

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminBackLink
          href={PC_ADMIN.partnerSection(id, "documents")}
          label="Partner"
        />
        <AdminPageHeader
          title="Manage documents"
          description={
            result.data?.companyName
              ? `Share and version files for ${result.data.companyName}`
              : "Share and version files for this partner"
          }
        />
        <AdminDataNotice configured={result.configured} />
        {!result.data ? (
          <AdminLoadError
            message={
              result.error ||
              "Partner not found or admin data is not configured."
            }
            retryHref={PC_ADMIN.partnerDocuments(id)}
          />
        ) : (
          <PartnerDocumentsAdminView data={result.data} />
        )}
      </div>
    </PartnerCenterAdminShell>
  );
}

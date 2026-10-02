import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { AdminBackLink } from "@/super-admin/partner-center/components/AdminDetailSections";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { DocumentEditShell } from "@/super-admin/partner-center/partners/components/DocumentEditShell";
import { EditDocumentMetaForm } from "@/super-admin/partner-center/partners/components/EditDocumentMetaForm";
import { loadAdminPartnerDocuments } from "@/super-admin/partner-center/partners/lib/load-partner-documents";
import {
  PC_ADMIN,
  parsePartnerDocumentSection,
} from "@/super-admin/partner-center/lib/paths";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PartnerDocumentDetailAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; docId: string }>;
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const { id, docId } = await params;
  const query = searchParams ? await Promise.resolve(searchParams) : {};
  const section = parsePartnerDocumentSection(query.section);

  const result = await loadAdminPartnerDocuments(id);
  const document = result.data?.items.find((item) => item.id === docId) ?? null;

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminBackLink
          href={PC_ADMIN.partnerDocuments(id)}
          label="Documents"
        />
        <AdminPageHeader
          title={document?.title ?? "Document"}
          description={
            result.data?.companyName
              ? `Edit document for ${result.data.companyName}`
              : "Edit partner document"
          }
        />
        <AdminDataNotice configured={result.configured} />
        {!result.data || !document ? (
          <AdminLoadError
            message={
              result.error ||
              "Document not found or admin data is not configured."
            }
            retryHref={PC_ADMIN.partnerDocuments(id)}
          />
        ) : (
          <DocumentEditShell
            partnerProfileId={id}
            documentId={docId}
            active={section}
          >
            <EditDocumentMetaForm
              key={`${docId}-${section}`}
              partnerProfileId={id}
              document={document}
              supersedeOptions={result.data.supersedeOptions}
              allTitles={result.data.allTitles}
              section={section}
            />
          </DocumentEditShell>
        )}
      </div>
    </PartnerCenterAdminShell>
  );
}

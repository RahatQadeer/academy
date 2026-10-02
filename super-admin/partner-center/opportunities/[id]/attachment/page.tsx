import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/super-admin/lib/is-super-admin";
import { createAdminClient } from "@/super-admin/partner-center/lib/admin-client";
import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { AdminBackLink } from "@/super-admin/partner-center/components/AdminDetailSections";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

const BUCKET = "documents";

export default async function AdminOpportunityAttachmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id: opportunityId } = await params;
  const admin = createAdminClient();

  if (!admin || !opportunityId) {
    return (
      <PartnerCenterAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink
            href={PC_ADMIN.opportunity(opportunityId || "")}
            label="Opportunity"
          />
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Attachment is unavailable.
          </p>
        </div>
      </PartnerCenterAdminShell>
    );
  }

  const { data: row } = await admin
    .from("partner_opportunities")
    .select("id, attachment_document_id")
    .eq("id", opportunityId)
    .maybeSingle();

  const documentId = row?.attachment_document_id as string | null | undefined;
  if (!documentId) {
    return (
      <PartnerCenterAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink
            href={PC_ADMIN.opportunity(opportunityId)}
            label="Opportunity"
          />
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            This opportunity has no attachment.
          </p>
        </div>
      </PartnerCenterAdminShell>
    );
  }

  const { data: document } = await admin
    .from("documents")
    .select("id, file_url, title")
    .eq("id", documentId)
    .maybeSingle();

  const fileUrl = (document?.file_url as string | null)?.trim();
  if (!fileUrl) {
    return (
      <PartnerCenterAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink
            href={PC_ADMIN.opportunity(opportunityId)}
            label="Opportunity"
          />
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Attachment file is missing.
          </p>
        </div>
      </PartnerCenterAdminShell>
    );
  }

  const filename =
    ((document?.title as string | null)?.trim() || "attachment").replace(
      /[^\w.\-]+/g,
      "_",
    );

  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(fileUrl, 60, { download: filename });

  if (error || !signed?.signedUrl) {
    const fallback = await admin.storage
      .from(BUCKET)
      .createSignedUrl(fileUrl, 60);
    if (fallback.data?.signedUrl) {
      redirect(fallback.data.signedUrl);
    }
    return (
      <PartnerCenterAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink
            href={PC_ADMIN.opportunity(opportunityId)}
            label="Opportunity"
          />
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Could not open the attachment.
          </p>
        </div>
      </PartnerCenterAdminShell>
    );
  }

  redirect(signed.signedUrl);
  return null;
}

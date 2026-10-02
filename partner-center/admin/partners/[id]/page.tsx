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
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import { loadPartnerDetail } from "@/super-admin/partner-center/lib/load-admin-data";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";
import {
  profileStatusLabel,
  profileStatusTone,
} from "@/super-admin/partner-center/lib/format";
import Link from "next/link";

export default async function PartnerAdminPartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadPartnerDetail(id);

  if (!result.data) {
    return (
      <PartnerAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminBackLink href={PA_ADMIN.partners} label="Partners" />
          <AdminDataNotice configured={result.configured} />
          {result.error ? (
            <AdminLoadError message={result.error} retryHref={PA_ADMIN.partner(id)} />
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>Partner not found.</p>
          )}
        </div>
      </PartnerAdminShell>
    );
  }

  const data = result.data;

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminBackLink href={PA_ADMIN.partners} label="Partners" />
        <AdminPageHeader
          title={data.companyName}
          description="Read-only partner detail"
          action={
            <AdminStatusPill
              label={profileStatusLabel(data.status)}
              tone={profileStatusTone(data.status)}
            />
          }
        />
        <AdminDetailSection title="Contact">
          <AdminDetailField label="Name" value={data.contactName} />
          <AdminDetailField label="Email" value={data.contactEmail} />
          <AdminDetailField label="Phone" value={data.contactPhone} />
        </AdminDetailSection>
        <div className="mt-4">
          <Link
            href={PA_ADMIN.message(id)}
            className="text-[13.5px] font-medium underline"
          >
            Open Partner Manager messages
          </Link>
        </div>
      </div>
    </PartnerAdminShell>
  );
}

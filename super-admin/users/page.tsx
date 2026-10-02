import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { requireSuperAdmin } from "@/super-admin/lib/is-super-admin";
import { listPartnerAdmins } from "@/partner-center/admin/lib/invite";
import { UsersAdminView } from "@/super-admin/users/components/UsersAdminView";
import { parsePartnerAdminTab } from "@/super-admin/users/lib/parse-tab";

export default async function SuperAdminUsersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireSuperAdmin();
  const tab = parsePartnerAdminTab(searchParams?.tab);
  const rows = await listPartnerAdmins();

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <UsersAdminView
          activeTab={tab}
          initialRows={rows.map((row) => ({
            id: row.id,
            email: row.email,
            status: row.status,
            invite_expires_at: row.invite_expires_at,
            invited_at: row.invited_at,
            activated_at: row.activated_at,
          }))}
        />
      </div>
    </PartnerCenterAdminShell>
  );
}

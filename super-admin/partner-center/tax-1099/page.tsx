import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { createAdminClient } from "@/super-admin/partner-center/lib/admin-client";
import { requireSuperAdmin } from "@/super-admin/lib/is-super-admin";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { load1099Rollups } from "@/partner-center/lib/tax/rollup-1099";
import { loadPlatformTaxConfig } from "@/super-admin/partner-center/services/platform-tax-config";
import { Tax1099AdminView } from "@/super-admin/partner-center/tax-1099/components/Tax1099AdminView";

export default async function Tax1099AdminPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const rawYear = searchParams?.year;
  const parsed =
    typeof rawYear === "string" ? Number(rawYear) : new Date().getFullYear();
  const taxYear =
    Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100
      ? Math.floor(parsed)
      : new Date().getFullYear();

  if (!admin) {
    return (
      <PartnerCenterAdminShell>
        <div className={PARTNER_PAGE_GUTTER}>
          <AdminPageHeader
            title="1099 rollups"
            description="Yearly payout totals for filing."
          />
          <AdminDataNotice configured={false} />
        </div>
      </PartnerCenterAdminShell>
    );
  }

  const [config, loaded] = await Promise.all([
    loadPlatformTaxConfig(admin),
    load1099Rollups(admin, taxYear),
  ]);

  return (
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="1099 rollups"
          description="Yearly payout totals for filing."
        />
        <AdminDataNotice configured />
        {loaded.error ? (
          <AdminLoadError message={loaded.error} retryHref={PC_ADMIN.tax1099} />
        ) : null}
        <Tax1099AdminView
          taxYear={taxYear}
          legalPayerEntity={config.legalPayerEntity}
          rows={loaded.rows}
        />
      </div>
    </PartnerCenterAdminShell>
  );
}

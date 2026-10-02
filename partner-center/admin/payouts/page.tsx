import { PartnerAdminShell } from "@/partner-center/admin/components/PartnerAdminShellServer";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { createAdminClient } from "@/super-admin/partner-center/lib/admin-client";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { PayoutsAdminView } from "@/super-admin/partner-center/payouts/components/PayoutsAdminView";
import {
  loadPayablePartners,
  loadPartnerPayoutHistory,
} from "@/super-admin/partner-center/lib/load-admin-data";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";
import { loadPlatformTaxConfig } from "@/super-admin/partner-center/services/platform-tax-config";

export default async function PartnerAdminPayoutsPage() {
  const [result, history] = await Promise.all([
    loadPayablePartners(),
    loadPartnerPayoutHistory(),
  ]);
  const admin = createAdminClient();
  const taxConfig = admin
    ? await loadPlatformTaxConfig(admin)
    : {
        availablePayoutMethods: [
          "stripe_connect",
          "quickbooks",
          "ach",
          "check",
        ] as import("@/super-admin/partner-center/services/platform-tax-config").PayoutMethodOption[],
      };
  const stripeEnabled =
    taxConfig.availablePayoutMethods.includes("stripe_connect");
  const quickbooksEnabled =
    taxConfig.availablePayoutMethods.includes("quickbooks");
  const achEnabled = taxConfig.availablePayoutMethods.includes("ach");
  const checkEnabled = taxConfig.availablePayoutMethods.includes("check");
  const loadError = result.error ?? history.error;

  return (
    <PartnerAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Payouts"
          description="View-only payout queue. Issuing payouts is Super Admin only."
        />
        <AdminDataNotice configured={result.configured && history.configured} />
        {loadError ? (
          <AdminLoadError message={loadError} retryHref={PA_ADMIN.payouts} />
        ) : null}
        <p className="mb-4 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          Review eligibility here. Issuing payouts stays with Super Admin.
        </p>
        <PayoutsAdminView
          items={result.items}
          historyRows={history.items}
          enabled={{
            stripeEnabled,
            quickbooksEnabled,
            achEnabled,
            checkEnabled,
          }}
        />
      </div>
    </PartnerAdminShell>
  );
}

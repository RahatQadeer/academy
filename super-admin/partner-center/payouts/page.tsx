import Link from "next/link";
import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
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
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { loadPlatformTaxConfig } from "@/super-admin/partner-center/services/platform-tax-config";

function payoutsDescription(opts: {
  stripeEnabled: boolean;
  quickbooksEnabled: boolean;
  achEnabled?: boolean;
  checkEnabled?: boolean;
}) {
  if (
    !opts.stripeEnabled &&
    !opts.quickbooksEnabled &&
    !opts.achEnabled &&
    !opts.checkEnabled
  ) {
    return "Turn on a payout method in Program config.";
  }
  return "Pay eligible partners.";
}

export default async function PayoutsAdminPage() {
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
    <PartnerCenterAdminShell>
      <div className={PARTNER_PAGE_GUTTER}>
        <AdminPageHeader
          title="Payouts"
          description={payoutsDescription({
            stripeEnabled,
            quickbooksEnabled,
            achEnabled,
            checkEnabled,
          })}
        />
        <AdminDataNotice configured={result.configured && history.configured} />
        {loadError ? (
          <AdminLoadError message={loadError} retryHref={PC_ADMIN.payouts} />
        ) : null}

        {!stripeEnabled &&
        !quickbooksEnabled &&
        !achEnabled &&
        !checkEnabled ? (
          <p className="mb-4 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Enable a payout method in{" "}
            <Link
              href={PC_ADMIN.programConfig}
              className="font-medium no-underline"
              style={{ color: "var(--accent)" }}
            >
              Program config
            </Link>{" "}
            to pay partners.
          </p>
        ) : null}

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
    </PartnerCenterAdminShell>
  );
}

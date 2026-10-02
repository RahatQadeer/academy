import { PartnerCenterAdminShell } from "@/super-admin/partner-center/components/PartnerCenterAdminShell";
import { PARTNER_PAGE_GUTTER } from "@/partner-center/lib/layout";
import { cn } from "@/base/lib/cn";
import { createAdminClient } from "@/super-admin/partner-center/lib/admin-client";
import { requireSuperAdmin } from "@/super-admin/lib/is-super-admin";
import { loadEnterpriseProtectionRules } from "@/super-admin/partner-center/services/saveEnterpriseProtectionRules";
import { loadAdminProductInterestOptions } from "@/super-admin/partner-center/services/saveProductInterestOptions";
import { loadPlatformTaxConfig } from "@/super-admin/partner-center/services/platform-tax-config";
import { loadPlatformAttributionConfig } from "@/super-admin/partner-center/services/platform-attribution-config";
import { loadGlobalCommissionRules } from "@/super-admin/partner-center/services/saveCommissionDefaults";
import { loadQuickBooksCredentialStatus } from "@/partner-center/lib/quickbooks/credentials";
import { DEFAULT_PRODUCT_INTEREST_OPTIONS } from "@/partner-center/opportunities/lib/product-interest-options";
import { EnterpriseProtectionForm } from "@/super-admin/partner-center/program-config/components/EnterpriseProtectionForm";
import { ProductInterestOptionsForm } from "@/super-admin/partner-center/program-config/components/ProductInterestOptionsForm";
import { PlatformTaxConfigForm } from "@/super-admin/partner-center/program-config/components/PlatformTaxConfigForm";
import { QuickBooksConnect } from "@/super-admin/partner-center/program-config/components/QuickBooksConnect";
import {
  AttributionPlatformForm,
  CommissionDefaultsForm,
} from "@/super-admin/partner-center/program-config/components/CommissionDefaultsForm";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { FirstPromoterConnect } from "@/super-admin/partner-center/program-config/components/FirstPromoterConnect";
import { ProgramConfigShell } from "@/super-admin/partner-center/program-config/components/ProgramConfigShell";
import { parseProgramConfigSection } from "@/super-admin/partner-center/lib/paths";

export default async function ProgramConfigAdminPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const [
    rules,
    productInterests,
    qbStatus,
    taxConfig,
    attributionConfig,
    commissionRules,
  ] = await Promise.all([
    admin
      ? loadEnterpriseProtectionRules(admin)
      : Promise.resolve({
          id: "",
          acceptanceRequired: true,
          protectionPeriodDays: 180,
          renewalExtensionNotes: "",
          conflictResolutionNotes: "",
        }),
    admin
      ? loadAdminProductInterestOptions(admin)
      : Promise.resolve(
          DEFAULT_PRODUCT_INTEREST_OPTIONS.map((option) => ({
            id: `default-${option.value}`,
            ...option,
          })),
        ),
    admin
      ? loadQuickBooksCredentialStatus(admin)
      : Promise.resolve({
          status: "disconnected" as const,
          connectedAccount: null,
          realmId: null,
          lastSyncAt: null,
          errorState: null,
          scopes: null,
          configured: false,
        }),
    admin
      ? loadPlatformTaxConfig(admin)
      : Promise.resolve({
          id: "",
          legalPayerEntity: "Private Attache",
          availablePayoutMethods: ["stripe_connect", "quickbooks"] as const,
          taxFormType: "w9" as const,
          taxCollectionSource: "stripe_tax" as const,
        }),
    admin
      ? loadPlatformAttributionConfig(admin)
      : Promise.resolve({
          id: "",
          defaultCookieLifeDays: 90,
          attributionMode: "first_touch" as const,
          defaultRefundRule: "proportional" as const,
          conversionEligibility: {
            academy: { paid_enrollment: true, free_enrollment: false },
            platform: {
              first_paid_subscription: true,
              trial: false,
              account_creation: false,
            },
          },
          firstpromoterEnabled: false,
          firstpromoterAccountId: null,
        }),
    admin ? loadGlobalCommissionRules(admin) : Promise.resolve([]),
  ]);

  const qbError =
    typeof searchParams?.qb_error === "string" ? searchParams.qb_error : null;
  const qbConnected =
    typeof searchParams?.qb_connected === "string"
      ? "QuickBooks connected."
      : null;

  const section =
    qbError || qbConnected
      ? "quickbooks"
      : parseProgramConfigSection(searchParams?.section);

  return (
    <PartnerCenterAdminShell>
      <div className={cn(PARTNER_PAGE_GUTTER, "pb-20")}>
        <AdminPageHeader
          title="Program config"
          description="Rates, protection, tax, and integrations."
        />

        <ProgramConfigShell active={section}>
          {section === "commission" ? (
            <CommissionDefaultsForm rules={commissionRules} />
          ) : null}
          {section === "attribution" ? (
            <AttributionPlatformForm initial={attributionConfig} />
          ) : null}
          {section === "enterprise" ? (
            <EnterpriseProtectionForm initial={rules} />
          ) : null}
          {section === "product-interests" ? (
            <ProductInterestOptionsForm initial={productInterests} />
          ) : null}
          {section === "tax" ? (
            <PlatformTaxConfigForm
              initial={{
                ...taxConfig,
                availablePayoutMethods: [...taxConfig.availablePayoutMethods],
              }}
            />
          ) : null}
          {section === "quickbooks" ? (
            <QuickBooksConnect
              status={qbStatus}
              connectedMessage={qbConnected}
              errorMessage={qbError}
            />
          ) : null}
          {section === "firstpromoter" ? (
            <FirstPromoterConnect
              enabled={attributionConfig.firstpromoterEnabled}
              accountId={attributionConfig.firstpromoterAccountId}
            />
          ) : null}
        </ProgramConfigShell>
      </div>
    </PartnerCenterAdminShell>
  );
}

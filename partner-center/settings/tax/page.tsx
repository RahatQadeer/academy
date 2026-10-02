import { SettingsShell } from "@/partner-center/settings/components/SettingsShell";
import { TaxPaymentOverview } from "@/partner-center/settings/components/TaxPaymentOverview";
import { requirePartnerTaxSettingsAccess } from "@/partner-center/lib/access";
import { loadTaxPayment } from "@/partner-center/settings/lib/load-tax-payment";

export default async function PartnerSettingsTaxPage() {
  const access = await requirePartnerTaxSettingsAccess();
  const data = await loadTaxPayment(access);

  return (
    <SettingsShell
      active="tax"
      title="Tax & Payment Profile"
      description={data.companyName}
      wide
    >
      <TaxPaymentOverview data={data} />
    </SettingsShell>
  );
}

import {
  PartnerTaxAccessDenied,
  requirePartnerTaxMutationAccess,
} from "@/partner-center/lib/tax-access";
import { requirePartnerTaxSettingsAccess } from "@/partner-center/lib/access";
import { CompleteTaxSetupForm } from "@/partner-center/settings/components/CompleteTaxSetupForm";
import { loadTaxPayment } from "@/partner-center/settings/lib/load-tax-payment";

export default async function PartnerSettingsTaxSetupPage() {
  const privileged = await requirePartnerTaxMutationAccess();
  if ("denied" in privileged) {
    return <PartnerTaxAccessDenied />;
  }

  const access = await requirePartnerTaxSettingsAccess();
  const data = await loadTaxPayment(access);

  return (
    <div className="px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <CompleteTaxSetupForm tax={data.tax} companyName={data.companyName} />
    </div>
  );
}

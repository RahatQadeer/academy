import {
  PartnerTaxAccessDenied,
  requirePartnerTaxMutationAccess,
} from "@/partner-center/lib/tax-access";
import { requirePartnerTaxSettingsAccess } from "@/partner-center/lib/access";
import { CompleteStripeSetupView } from "@/partner-center/settings/components/CompleteStripeSetupView";
import { loadTaxPayment } from "@/partner-center/settings/lib/load-tax-payment";

export default async function PartnerSettingsTaxStripePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const privileged = await requirePartnerTaxMutationAccess();
  if ("denied" in privileged) {
    return <PartnerTaxAccessDenied />;
  }

  const access = await requirePartnerTaxSettingsAccess();
  const data = await loadTaxPayment(access);
  const query = searchParams ? await searchParams : {};
  const error =
    typeof query.error === "string" ? query.error : undefined;

  return (
    <CompleteStripeSetupView
      taxComplete={data.taxStatus === "complete"}
      initialError={error}
      stripeLinked={Boolean(
        access.context?.profile?.stripe_connect_account_id?.trim(),
      )}
    />
  );
}

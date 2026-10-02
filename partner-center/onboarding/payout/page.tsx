import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import {
  PartnerTaxAccessDenied,
  requirePartnerTaxMutationAccess,
} from "@/partner-center/lib/tax-access";
import { PayoutSetupScreen } from "@/partner-center/onboarding/components/PayoutSetupScreen";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { loadPlatformTaxConfig } from "@/super-admin/partner-center/services/platform-tax-config";
import type { PayoutMethodOption } from "@/super-admin/partner-center/services/platform-tax-config";

export default async function PartnerPayoutPage() {
  const privileged = await requirePartnerTaxMutationAccess();
  if ("denied" in privileged) {
    return <PartnerTaxAccessDenied />;
  }

  const { context } = await requirePartnerChecklistAccess();
  const admin = createAdminClient();
  const config = admin
    ? await loadPlatformTaxConfig(admin)
    : {
        availablePayoutMethods: [
          "stripe_connect",
        ] as PayoutMethodOption[],
      };

  const preferred =
    (context?.profile?.preferred_payout_method as PayoutMethodOption | null) ??
    null;
  const stripeLinked = Boolean(
    context?.profile?.stripe_connect_account_id?.trim(),
  );
  const paymentSetupReady =
    (context?.profile?.payment_setup_status || "").toLowerCase() === "ready";

  return (
    <PayoutSetupScreen
      availableMethods={config.availablePayoutMethods}
      preferredMethod={preferred}
      stripeLinked={stripeLinked}
      paymentSetupReady={paymentSetupReady}
      readOnly={paymentSetupReady || stripeLinked}
    />
  );
}

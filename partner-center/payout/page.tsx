import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PayoutSetupScreen } from "@/partner-center/onboarding/components/PayoutSetupScreen";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import {
  loadPlatformTaxConfig,
  type PayoutMethodOption,
} from "@/super-admin/partner-center/services/platform-tax-config";

export default async function PartnerAppPayoutPage() {
  const { context } = await requirePartnerAppAccess();
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
      variant="app"
      availableMethods={config.availablePayoutMethods}
      preferredMethod={preferred}
      stripeLinked={stripeLinked}
      paymentSetupReady={paymentSetupReady}
    />
  );
}

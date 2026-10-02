import { PayoutGateBanner } from "@/partner-center/home/components/PayoutGateBanner";
import type { PayoutGate } from "@/partner-center/lib/payout-gate";

export function EarningsHoldBanner({
  gate,
}: {
  gate: Exclude<PayoutGate, "eligible">;
}) {
  return <PayoutGateBanner gate={gate} />;
}

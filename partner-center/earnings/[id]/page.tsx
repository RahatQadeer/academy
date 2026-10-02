import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PartnerNotFound } from "@/partner-center/components/states/PartnerNotFound";
import { EarningLedgerView } from "@/partner-center/earnings/components/EarningLedgerView";
import { loadEarningDetail } from "@/partner-center/earnings/lib/load-earning-detail";

export default async function PartnerEarningDetailPage({
  earningId,
}: {
  earningId: string;
}) {
  const { context } = await requirePartnerAppAccess();
  const data = await loadEarningDetail(context, earningId);
  if (!data) return <PartnerNotFound />;
  return <EarningLedgerView data={data} />;
}

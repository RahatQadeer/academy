import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PartnerNotFound } from "@/partner-center/components/states/PartnerNotFound";
import { ReferralDetailView } from "@/partner-center/referrals/components/ReferralDetailView";
import { loadReferralDetail } from "@/partner-center/referrals/lib/load-referral-detail";

export default async function PartnerReferralDetailPage({
  referralId,
}: {
  referralId: string;
}) {
  const { context } = await requirePartnerAppAccess();
  const data = await loadReferralDetail(context, referralId);
  if (!data) return <PartnerNotFound />;
  return <ReferralDetailView data={data} />;
}

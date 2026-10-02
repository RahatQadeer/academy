import { Suspense } from "react";
import { PartnerPageSkeleton } from "@/partner-center/components/states/PartnerPageSkeleton";
import { ReferralsPageContent } from "@/partner-center/referrals/referrals-content";

type SearchParams = Record<string, string | string[] | undefined>;

export default function PartnerReferralsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<PartnerPageSkeleton variant="table" />}>
      <ReferralsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

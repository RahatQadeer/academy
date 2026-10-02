import { Suspense } from "react";
import { PartnerPageSkeleton } from "@/partner-center/components/states/PartnerPageSkeleton";
import { AllEarningsPageContent } from "@/partner-center/earnings/all-earnings-content";

type SearchParams = Record<string, string | string[] | undefined>;

export default function PartnerAllEarningsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<PartnerPageSkeleton variant="cards" />}>
      <AllEarningsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

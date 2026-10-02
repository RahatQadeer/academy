import { Suspense } from "react";
import { PartnerPageSkeleton } from "@/partner-center/components/states/PartnerPageSkeleton";
import { EarningsPageContent } from "@/partner-center/earnings/earnings-content";

type SearchParams = Record<string, string | string[] | undefined>;

export default function PartnerEarningsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<PartnerPageSkeleton variant="cards" />}>
      <EarningsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

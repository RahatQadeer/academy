import { Suspense } from "react";
import { PartnerPageSkeleton } from "@/partner-center/components/states/PartnerPageSkeleton";
import { OpportunitiesPageContent } from "@/partner-center/opportunities/opportunities-content";

type SearchParams = Record<string, string | string[] | undefined>;

export default function PartnerOpportunitiesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<PartnerPageSkeleton variant="table" />}>
      <OpportunitiesPageContent searchParams={searchParams} />
    </Suspense>
  );
}

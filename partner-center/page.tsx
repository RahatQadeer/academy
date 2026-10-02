import { Suspense } from "react";
import { PartnerPageSkeleton } from "@/partner-center/components/states/PartnerPageSkeleton";
import { HomePageContent } from "@/partner-center/home/home-content";

type SearchParams = Record<string, string | string[] | undefined>;

export default function PartnerCenterPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<PartnerPageSkeleton variant="home" />}>
      <HomePageContent searchParams={searchParams} />
    </Suspense>
  );
}

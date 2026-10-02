import { Suspense } from "react";
import { PartnerPageSkeleton } from "@/partner-center/components/states/PartnerPageSkeleton";
import { TeamPageContent } from "@/partner-center/team/team-content";

type SearchParams = Record<string, string | string[] | undefined>;

export default function PartnerTeamPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <Suspense fallback={<PartnerPageSkeleton variant="profile" />}>
      <TeamPageContent searchParams={searchParams} />
    </Suspense>
  );
}

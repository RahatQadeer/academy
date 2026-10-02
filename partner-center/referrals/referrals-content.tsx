import { PartnerLoadError } from "@/partner-center/components/states/PartnerLoadError";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { ReferralsView } from "@/partner-center/referrals/components/ReferralsView";
import { loadReferrals } from "@/partner-center/referrals/lib/load-referrals";
import { parseListFilters } from "@/partner-center/referrals/types";

type SearchParams = Record<string, string | string[] | undefined>;

export async function ReferralsPageContent({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { context } = await requirePartnerAppAccess();
  const filters = parseListFilters(searchParams);
  const result = await loadReferrals(context, filters);
  if (!result.ok) {
    return (
      <PartnerLoadError
        retryHref="/partner-center/referrals"
        message={result.error}
      />
    );
  }
  return <ReferralsView data={result.data} />;
}

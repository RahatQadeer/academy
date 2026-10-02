import { PartnerLoadError } from "@/partner-center/components/states/PartnerLoadError";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { OpportunitiesView } from "@/partner-center/opportunities/components/OpportunitiesView";
import { loadOpportunities } from "@/partner-center/opportunities/lib/load-opportunities";
import { parseListFilters } from "@/partner-center/opportunities/types";

type SearchParams = Record<string, string | string[] | undefined>;

export async function OpportunitiesPageContent({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { context } = await requirePartnerAppAccess();
  const filters = parseListFilters(searchParams);
  const result = await loadOpportunities(context, filters);
  if (!result.ok) {
    return (
      <PartnerLoadError
        retryHref="/partner-center/opportunities"
        message={result.error}
      />
    );
  }
  return <OpportunitiesView data={result.data} />;
}

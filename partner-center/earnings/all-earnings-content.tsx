import { PartnerLoadError } from "@/partner-center/components/states/PartnerLoadError";
import { AllEarningsView } from "@/partner-center/earnings/components/AllEarningsView";
import { loadEarnings } from "@/partner-center/earnings/lib/load-earnings";
import { parseEarningsStatus } from "@/partner-center/earnings/types";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";

type SearchParams = Record<string, string | string[] | undefined>;

export async function AllEarningsPageContent({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { context } = await requirePartnerAppAccess();
  const statusFilter = parseEarningsStatus(searchParams?.status);
  const result = await loadEarnings(context, statusFilter);
  if (!result.ok || !result.data) {
    return (
      <PartnerLoadError
        retryHref="/partner-center/earnings/all"
        message={result.ok ? "Earnings could not be loaded." : result.error}
      />
    );
  }
  return <AllEarningsView data={result.data} />;
}

import { redirect } from "next/navigation";
import { PartnerLoadError } from "@/partner-center/components/states/PartnerLoadError";
import { EarningsView } from "@/partner-center/earnings/components/EarningsView";
import { loadEarnings } from "@/partner-center/earnings/lib/load-earnings";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";

type SearchParams = Record<string, string | string[] | undefined>;

export async function EarningsPageContent({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  // Filters live on /earnings/all — keep old ?status= links working.
  const status = searchParams?.status;
  if (typeof status === "string" && status.trim()) {
    redirect(`/partner-center/earnings/all?status=${encodeURIComponent(status)}`);
  }

  const { context } = await requirePartnerAppAccess();
  const result = await loadEarnings(context, "all");
  if (!result.ok || !result.data) {
    return (
      <PartnerLoadError
        retryHref="/partner-center/earnings"
        message={result.ok ? "Earnings could not be loaded." : result.error}
      />
    );
  }
  return <EarningsView data={result.data} />;
}

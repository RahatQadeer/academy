import { PartnerLoadError } from "@/partner-center/components/states/PartnerLoadError";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { TeamView } from "@/partner-center/team/components/TeamView";
import { loadTeamPage } from "@/partner-center/team/lib/load-team";
import { parseTeamTab } from "@/partner-center/team/types";
import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export async function TeamPageContent({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { context } = await requirePartnerAppAccess();
  if (!context) {
    return (
      <PartnerLoadError
        retryHref="/partner-center/team"
        message="No partner company profile is available yet."
      />
    );
  }

  const result = await loadTeamPage(context);
  const tab = parseTeamTab(searchParams);
  if (!result.ok) {
    return (
      <PartnerLoadError
        retryHref="/partner-center/team"
        message={result.error}
      />
    );
  }
  if (result.data.isIndividual && tab === "team") {
    redirect("/partner-center/team");
  }
  return <TeamView data={result.data} tab={tab} />;
}

import { ProgramTermsView } from "@/partner-center/documents/components/ProgramTermsView";
import { loadProgramTermsDetail } from "@/partner-center/documents/lib/load-program-terms-detail";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PartnerNotFound } from "@/partner-center/components/states/PartnerNotFound";

export default async function PartnerProgramTermsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { context } = await requirePartnerAppAccess();
  if (!context?.profile) return <PartnerNotFound />;

  const program =
    typeof searchParams?.program === "string"
      ? searchParams.program
      : undefined;

  const data = await loadProgramTermsDetail(context, program);
  if (!data) return <PartnerNotFound />;

  return <ProgramTermsView data={data} />;
}

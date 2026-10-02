import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { requirePartnerApprovedAccess } from "@/partner-center/lib/access";
import { ApplicationApproved } from "@/partner-center/onboarding/components/ApplicationApproved";

export default async function PartnerApprovedPage() {
  const { context } = await requirePartnerApprovedAccess();
  const application = parseApplicationData(context?.profile?.application_data);
  let programs: string[] = application.products_of_interest;

  if (isSupabaseConfigured() && context?.profile?.id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("partner_programs")
      .select("program")
      .eq("partner_profile_id", context.profile.id)
      .eq("active", true);
    const assigned = (data ?? [])
      .map((row) => row.program)
      .filter((item): item is string => typeof item === "string");
    if (assigned.length > 0) programs = assigned;
  }

  return (
    <ApplicationApproved
      companyName={context?.company?.name || application.legal_name || null}
      programs={programs}
    />
  );
}

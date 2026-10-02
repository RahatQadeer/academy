import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerChecklistAccess } from "@/partner-center/lib/access";
import {
  PartnerTaxAccessDenied,
  requirePartnerTaxMutationAccess,
} from "@/partner-center/lib/tax-access";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { TaxProfileForm } from "@/partner-center/onboarding/components/TaxProfileForm";

export default async function PartnerTaxPage() {
  const privileged = await requirePartnerTaxMutationAccess();
  if ("denied" in privileged) {
    return <PartnerTaxAccessDenied />;
  }

  const { context } = await requirePartnerChecklistAccess();
  const application = parseApplicationData(context?.profile?.application_data);
  let usPerson = true;
  let legalPayeeName = context?.company?.name || application.legal_name;
  let entityClassification = "";

  if (isSupabaseConfigured() && context?.profile?.id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("partner_tax_profiles")
      .select("legal_payee_name, entity_classification, form_type")
      .eq("partner_profile_id", context.profile.id)
      .maybeSingle();
    if (data) {
      legalPayeeName = data.legal_payee_name || legalPayeeName;
      entityClassification = data.entity_classification || "";
      usPerson = data.form_type !== "w8";
    }
  }

  const readOnly = context?.profile?.tax_profile_status === "complete";

  return (
    <TaxProfileForm
      usPerson={usPerson}
      legalPayeeName={legalPayeeName}
      entityClassification={entityClassification}
      readOnly={readOnly}
    />
  );
}

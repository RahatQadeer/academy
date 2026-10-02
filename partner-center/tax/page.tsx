import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { TaxProfileForm } from "@/partner-center/onboarding/components/TaxProfileForm";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";

export default async function PartnerAppTaxPage() {
  const { context } = await requirePartnerAppAccess();
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

  return (
    <TaxProfileForm
      variant="app"
      usPerson={usPerson}
      legalPayeeName={legalPayeeName}
      entityClassification={entityClassification}
      backHref={PARTNER_PATHS.app}
      successRedirect={PARTNER_PATHS.app}
    />
  );
}

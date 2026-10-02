import type { SupabaseClient } from "@supabase/supabase-js";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { enablePartnerPrograms } from "@/partner-center/lib/enable-programs";
import type { PartnerProgramFamily } from "@/partner-center/types/application";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

type CommissionRuleRow = {
  program: string;
  rate_type: string;
  rate_value: number;
  earning_basis: string | null;
  eligible_period: string | null;
  attribution_window_days: number;
  eligible_revenue_rules: unknown;
  payment_terms: string | null;
  effective_start: string | null;
  effective_end: string | null;
};

async function copyGlobalCommissionRules(
  admin: SupabaseClient,
  partnerProfileId: string,
): Promise<{ error?: string }> {
  const { data: existing } = await admin
    .from("partner_commission_rules")
    .select("id")
    .eq("partner_profile_id", partnerProfileId)
    .limit(1);

  if (existing?.length) return {};

  const { data: globalRules, error: loadError } = await admin
    .from("partner_commission_rules")
    .select(
      "program, rate_type, rate_value, earning_basis, eligible_period, attribution_window_days, eligible_revenue_rules, payment_terms, effective_start, effective_end",
    )
    .is("partner_profile_id", null);

  if (loadError) return { error: loadError.message };
  if (!globalRules?.length) return {};

  const today = new Date().toISOString().slice(0, 10);
  const rows = (globalRules as CommissionRuleRow[]).map((rule) => ({
    partner_profile_id: partnerProfileId,
    program: rule.program,
    rate_type: rule.rate_type,
    rate_value: rule.rate_value,
    earning_basis: rule.earning_basis,
    eligible_period: rule.eligible_period,
    attribution_window_days: rule.attribution_window_days,
    eligible_revenue_rules: rule.eligible_revenue_rules,
    payment_terms: rule.payment_terms,
    effective_start: rule.effective_start ?? today,
    effective_end: rule.effective_end,
  }));

  const { error: insertError } = await admin
    .from("partner_commission_rules")
    .insert(rows);

  if (insertError) return { error: insertError.message };
  return {};
}

export async function approveApplication(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
  profileId: string;
  programs: PartnerProgramFamily[];
}): Promise<{ error?: string }> {
  const { admin, actorUserId, profileId, programs } = input;

  const { data: profile, error: loadError } = await admin
    .from("partner_profiles")
    .select("id, status, application_data")
    .eq("id", profileId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!profile) return { error: "Application not found." };

  const status = (profile.status as string).toLowerCase();
  if (status !== "applied" && status !== "under_review") {
    return { error: "This application is not pending review." };
  }

  const application = parseApplicationData(profile.application_data);
  if (!application.submitted) {
    return { error: "This application has not been submitted yet." };
  }

  const selectedPrograms =
    programs.length > 0 ? programs : application.products_of_interest;

  const programResult = await enablePartnerPrograms(
    admin,
    profileId,
    selectedPrograms,
  );
  if (programResult.error) return programResult;

  const rulesResult = await copyGlobalCommissionRules(admin, profileId);
  if (rulesResult.error) return rulesResult;

  const { error: updateError } = await admin
    .from("partner_profiles")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateError) return { error: updateError.message };

  const audit = await writePartnerAdminAudit(admin, {
    actorUserId,
    entityType: "partner_profile",
    entityId: profileId,
    action: "application_approved",
    previousValue: { status: profile.status },
    newValue: { status: "approved", programs: selectedPrograms },
  });

  if (audit.error) return { error: audit.error };
  return {};
}

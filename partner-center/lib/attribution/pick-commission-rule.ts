import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommissionRuleRow } from "@/partner-center/lib/attribution/types";

export function pickCommissionRule(
  rows: CommissionRuleRow[],
  program: string,
  profileId: string,
): CommissionRuleRow | null {
  const partnerRule = rows.find(
    (row) => row.program === program && row.partner_profile_id === profileId,
  );
  if (partnerRule) return partnerRule;
  return (
    rows.find(
      (row) => row.program === program && !row.partner_profile_id,
    ) ?? null
  );
}

export async function loadCommissionRules(
  supabase: SupabaseClient,
  profileId: string,
  program: string,
): Promise<CommissionRuleRow | null> {
  const { data, error } = await supabase
    .from("partner_commission_rules")
    .select(
      "id, partner_profile_id, program, rate_type, rate_value, earning_basis, eligible_period, attribution_window_days, eligible_revenue_rules, payment_terms, effective_start, effective_end",
    )
    .or(`partner_profile_id.eq.${profileId},partner_profile_id.is.null`)
    .eq("program", program);

  if (error || !data?.length) return null;
  return pickCommissionRule(data as CommissionRuleRow[], program, profileId);
}

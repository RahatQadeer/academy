import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";

import {
  DEFAULT_NEW_CUSTOMER_PERIOD_DAYS,
  parseNewCustomerPeriodDays,
} from "@/partner-center/lib/attribution/waiting-period";
import { coalescePaymentTerms } from "@/partner-center/lib/commission-defaults";

export type ProgramTermsSummary = {
  academy: string;
  platform: string;
  enterprise: string;
  attribution: string;
  payment: string;
  /** SRS §17.1.12 — days before commissions begin accruing. */
  newCustomerPeriodDays: number;
};

type RuleRow = {
  partner_profile_id: string | null;
  program: string;
  rate_type: string;
  rate_value: number | string;
  attribution_window_days: number;
  eligible_revenue_rules: unknown;
  payment_terms: string | null;
};

function formatRate(rule: RuleRow | undefined) {
  if (!rule) return "—";
  const value = Number(rule.rate_value);
  if (rule.rate_type === "flat") {
    return `$${Number.isFinite(value) ? value : 0}`;
  }
  return Number.isFinite(value) ? `${value}%` : "—";
}

function pickRule(rows: RuleRow[], program: string, profileId: string) {
  return (
    rows.find((row) => row.program === program && row.partner_profile_id === profileId) ??
    rows.find((row) => row.program === program && !row.partner_profile_id)
  );
}

/** Neutral placeholders when rules are unavailable — rates stay unknown until loaded. */
export const DEFAULT_PROGRAM_TERMS: ProgramTermsSummary = {
  academy: "—",
  platform: "—",
  enterprise: "—",
  attribution: "—",
  payment: coalescePaymentTerms(null),
  newCustomerPeriodDays: DEFAULT_NEW_CUSTOMER_PERIOD_DAYS,
};

export async function loadProgramTerms(profileId: string): Promise<ProgramTermsSummary> {
  if (!isSupabaseConfigured()) return DEFAULT_PROGRAM_TERMS;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_commission_rules")
    .select(
      "partner_profile_id, program, rate_type, rate_value, attribution_window_days, eligible_revenue_rules, payment_terms",
    )
    .or(`partner_profile_id.eq.${profileId},partner_profile_id.is.null`);

  if (error) return DEFAULT_PROGRAM_TERMS;

  const rows = (data as RuleRow[] | null) ?? [];
  const academy = pickRule(rows, "academy", profileId);
  const platform = pickRule(rows, "platform", profileId);
  const enterprise = pickRule(rows, "enterprise", profileId);
  const windowDays =
    academy?.attribution_window_days ??
    platform?.attribution_window_days ??
    null;
  const payment = coalescePaymentTerms(
    academy?.payment_terms ||
      platform?.payment_terms ||
      enterprise?.payment_terms,
  );
  const periodSource = academy ?? platform ?? enterprise;

  return {
    academy: formatRate(academy),
    platform: formatRate(platform),
    enterprise: formatRate(enterprise),
    attribution: windowDays != null ? `${windowDays} days` : "—",
    payment,
    newCustomerPeriodDays: parseNewCustomerPeriodDays(
      periodSource?.eligible_revenue_rules,
    ),
  };
}

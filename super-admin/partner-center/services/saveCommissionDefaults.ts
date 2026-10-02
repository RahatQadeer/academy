import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  DEFAULT_COMMISSION_RATE_PERCENT,
  DEFAULT_EARNING_BASIS,
  DEFAULT_ELIGIBLE_PERIOD,
  DEFAULT_ENTERPRISE_ATTRIBUTION_WINDOW_DAYS,
} from "@/partner-center/lib/commission-defaults";
import {
  parseEligibleRevenueRules,
  type RefundRule,
  type RevenueComponent,
} from "@/partner-center/lib/attribution/eligible-revenue";
import {
  parsePaymentTerms,
  serializePaymentTerms,
  type PaymentTermsConfig,
} from "@/partner-center/lib/attribution/payment-terms";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type CommissionProgramFamily = "academy" | "platform" | "enterprise";

export type GlobalCommissionRule = {
  id: string;
  program: CommissionProgramFamily;
  rateType: "percentage" | "flat";
  rateValue: number;
  earningBasis: string;
  eligiblePeriod: string;
  attributionWindowDays: number;
  paymentTerms: PaymentTermsConfig;
  excludeRevenue: RevenueComponent[];
  refundRule: RefundRule | null;
  newCustomerPeriodDays: number;
  effectiveStart: string | null;
  effectiveEnd: string | null;
};

export type GlobalCommissionRuleInput = {
  program: CommissionProgramFamily;
  rateType: "percentage" | "flat";
  rateValue: number;
  earningBasis: string;
  eligiblePeriod: string;
  attributionWindowDays: number;
  paymentTerms: PaymentTermsConfig;
  excludeRevenue: RevenueComponent[];
  refundRule: RefundRule | null;
  newCustomerPeriodDays: number;
  effectiveStart: string | null;
  effectiveEnd: string | null;
};

function defaultWindow(program: CommissionProgramFamily) {
  return program === "enterprise"
    ? DEFAULT_ENTERPRISE_ATTRIBUTION_WINDOW_DAYS
    : DEFAULT_ATTRIBUTION_WINDOW_DAYS;
}

function mapRow(row: Record<string, unknown>): GlobalCommissionRule {
  const program = row.program as CommissionProgramFamily;
  const rules = parseEligibleRevenueRules(row.eligible_revenue_rules);
  return {
    id: row.id as string,
    program,
    rateType: row.rate_type === "flat" ? "flat" : "percentage",
    rateValue: Number(row.rate_value) || DEFAULT_COMMISSION_RATE_PERCENT,
    earningBasis:
      ((row.earning_basis as string | null) ?? "").trim() ||
      DEFAULT_EARNING_BASIS,
    eligiblePeriod:
      ((row.eligible_period as string | null) ?? "").trim() ||
      DEFAULT_ELIGIBLE_PERIOD,
    attributionWindowDays:
      (row.attribution_window_days as number) || defaultWindow(program),
    paymentTerms: parsePaymentTerms(row.payment_terms as string | null),
    excludeRevenue: rules.exclude ?? [],
    refundRule: rules.refund_rule ?? null,
    newCustomerPeriodDays: rules.new_customer_period_days ?? 60,
    effectiveStart: (row.effective_start as string | null) ?? null,
    effectiveEnd: (row.effective_end as string | null) ?? null,
  };
}

export async function loadGlobalCommissionRules(
  admin: SupabaseClient,
): Promise<GlobalCommissionRule[]> {
  const { data } = await admin
    .from("partner_commission_rules")
    .select(
      "id, program, rate_type, rate_value, earning_basis, eligible_period, attribution_window_days, eligible_revenue_rules, payment_terms, effective_start, effective_end",
    )
    .is("partner_profile_id", null)
    .order("program");

  const programs: CommissionProgramFamily[] = [
    "academy",
    "platform",
    "enterprise",
  ];
  const byProgram = new Map<CommissionProgramFamily, GlobalCommissionRule>();
  for (const row of data ?? []) {
    const mapped = mapRow(row as Record<string, unknown>);
    byProgram.set(mapped.program, mapped);
  }

  return programs.map((program) => {
    const existing = byProgram.get(program);
    if (existing) return existing;
    return {
      id: "",
      program,
      rateType: "percentage" as const,
      rateValue: DEFAULT_COMMISSION_RATE_PERCENT,
      earningBasis: DEFAULT_EARNING_BASIS,
      eligiblePeriod: DEFAULT_ELIGIBLE_PERIOD,
      attributionWindowDays: defaultWindow(program),
      paymentTerms: parsePaymentTerms(null),
      excludeRevenue: [],
      refundRule: null,
      newCustomerPeriodDays: 60,
      effectiveStart: null,
      effectiveEnd: null,
    };
  });
}

export async function saveGlobalCommissionRule(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
  rule: GlobalCommissionRuleInput;
}): Promise<{ error?: string }> {
  const { rule } = input;
  if (!Number.isFinite(rule.rateValue) || rule.rateValue < 0) {
    return { error: "Rate value must be zero or greater." };
  }
  if (
    !Number.isFinite(rule.attributionWindowDays) ||
    rule.attributionWindowDays < 1
  ) {
    return { error: "Attribution window must be at least 1 day." };
  }

  const revenueRules = {
    new_customer_period_days: rule.newCustomerPeriodDays,
    exclude: rule.excludeRevenue,
    ...(rule.refundRule ? { refund_rule: rule.refundRule } : {}),
  };

  const payload = {
    partner_profile_id: null,
    program: rule.program,
    rate_type: rule.rateType,
    rate_value: rule.rateValue,
    earning_basis: rule.earningBasis,
    eligible_period: rule.eligiblePeriod,
    attribution_window_days: Math.floor(rule.attributionWindowDays),
    eligible_revenue_rules: revenueRules,
    payment_terms: serializePaymentTerms(rule.paymentTerms),
    effective_start: rule.effectiveStart || null,
    effective_end: rule.effectiveEnd || null,
  };

  const { data: existing } = await input.admin
    .from("partner_commission_rules")
    .select("id")
    .is("partner_profile_id", null)
    .eq("program", rule.program)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await input.admin
      .from("partner_commission_rules")
      .update(payload)
      .eq("id", existing.id as string);
    if (error) return { error: error.message };
  } else {
    const { error } = await input.admin
      .from("partner_commission_rules")
      .insert(payload);
    if (error) return { error: error.message };
  }

  await writePartnerAdminAudit(input.admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_commission_rules",
    entityId: (existing?.id as string) || rule.program,
    action: "global_commission_rule_saved",
    newValue: payload,
  });

  return {};
}

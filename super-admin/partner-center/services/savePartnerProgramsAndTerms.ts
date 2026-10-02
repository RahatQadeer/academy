import type { SupabaseClient } from "@supabase/supabase-js";
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
import {
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  DEFAULT_COMMISSION_RATE_PERCENT,
  DEFAULT_EARNING_BASIS,
  DEFAULT_ELIGIBLE_PERIOD,
  DEFAULT_ENTERPRISE_ATTRIBUTION_WINDOW_DAYS,
} from "@/partner-center/lib/commission-defaults";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";
import type { CommissionProgramFamily } from "@/super-admin/partner-center/services/saveCommissionDefaults";

export type PartnerProgramEdit = {
  program: CommissionProgramFamily;
  active: boolean;
  effectiveStart: string | null;
  effectiveEnd: string | null;
};

export type PartnerRuleEdit = {
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

export type FirstPromoterMappingEdit = {
  promoterId: string;
  campaignId: string;
  program: CommissionProgramFamily | "";
};

export type PartnerProgramsAndTermsInput = {
  partnerProfileId: string;
  programs: PartnerProgramEdit[];
  rules: PartnerRuleEdit[];
  cookieLifeDays: number;
  firstpromoter: FirstPromoterMappingEdit;
};

export type PartnerProgramsAndTermsLoad = {
  partnerProfileId: string;
  companyName: string;
  programs: PartnerProgramEdit[];
  rules: PartnerRuleEdit[];
  cookieLifeDays: number;
  firstpromoter: FirstPromoterMappingEdit;
};

function defaultWindow(program: CommissionProgramFamily) {
  return program === "enterprise"
    ? DEFAULT_ENTERPRISE_ATTRIBUTION_WINDOW_DAYS
    : DEFAULT_ATTRIBUTION_WINDOW_DAYS;
}

function emptyRule(program: CommissionProgramFamily): PartnerRuleEdit {
  return {
    program,
    rateType: "percentage",
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
}

export async function loadPartnerProgramsAndTerms(
  admin: SupabaseClient,
  partnerProfileId: string,
): Promise<PartnerProgramsAndTermsLoad | null> {
  const { data: profile } = await admin
    .from("partner_profiles")
    .select("id, company_id")
    .eq("id", partnerProfileId)
    .maybeSingle();
  if (!profile) return null;

  let companyName = "Partner";
  if (profile.company_id) {
    const { data: company } = await admin
      .from("companies")
      .select("name")
      .eq("id", profile.company_id as string)
      .maybeSingle();
    companyName = (company?.name as string | null)?.trim() || companyName;
  }

  const [{ data: programRows }, { data: ruleRows }, { data: link }, { data: fp }] =
    await Promise.all([
      admin
        .from("partner_programs")
        .select("program, active, effective_start, effective_end")
        .eq("partner_profile_id", partnerProfileId),
      admin
        .from("partner_commission_rules")
        .select(
          "program, rate_type, rate_value, earning_basis, eligible_period, attribution_window_days, eligible_revenue_rules, payment_terms, effective_start, effective_end",
        )
        .eq("partner_profile_id", partnerProfileId),
      admin
        .from("partner_links_codes")
        .select("cookie_life_days")
        .eq("partner_profile_id", partnerProfileId)
        .eq("type", "referral_link")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("partner_firstpromoter_mappings")
        .select("promoter_id, campaign_id, program")
        .eq("partner_profile_id", partnerProfileId)
        .limit(1)
        .maybeSingle(),
    ]);

  const programs: CommissionProgramFamily[] = [
    "academy",
    "platform",
    "enterprise",
  ];
  const programByKey = new Map(
    (programRows ?? []).map((row) => [
      row.program as CommissionProgramFamily,
      row,
    ]),
  );
  const ruleByKey = new Map(
    (ruleRows ?? []).map((row) => [
      row.program as CommissionProgramFamily,
      row,
    ]),
  );

  return {
    partnerProfileId,
    companyName,
    programs: programs.map((program) => {
      const row = programByKey.get(program);
      return {
        program,
        active: row ? Boolean(row.active) : false,
        effectiveStart: (row?.effective_start as string | null) ?? null,
        effectiveEnd: (row?.effective_end as string | null) ?? null,
      };
    }),
    rules: programs.map((program) => {
      const row = ruleByKey.get(program);
      if (!row) return emptyRule(program);
      const revenue = parseEligibleRevenueRules(row.eligible_revenue_rules);
      return {
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
        excludeRevenue: revenue.exclude ?? [],
        refundRule: revenue.refund_rule ?? null,
        newCustomerPeriodDays: revenue.new_customer_period_days ?? 60,
        effectiveStart: (row.effective_start as string | null) ?? null,
        effectiveEnd: (row.effective_end as string | null) ?? null,
      };
    }),
    cookieLifeDays: (link?.cookie_life_days as number | null) ?? 90,
    firstpromoter: {
      promoterId: (fp?.promoter_id as string | null) ?? "",
      campaignId: (fp?.campaign_id as string | null) ?? "",
      program: (fp?.program as CommissionProgramFamily | null) ?? "",
    },
  };
}

export async function savePartnerProgramsAndTerms(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
} & PartnerProgramsAndTermsInput): Promise<{ error?: string }> {
  const partnerProfileId = input.partnerProfileId;
  if (!partnerProfileId) return { error: "Partner is required." };

  if (
    !Number.isFinite(input.cookieLifeDays) ||
    input.cookieLifeDays < 1
  ) {
    return { error: "Cookie life must be at least 1 day." };
  }

  for (const program of input.programs) {
    const { data: existing } = await input.admin
      .from("partner_programs")
      .select("id")
      .eq("partner_profile_id", partnerProfileId)
      .eq("program", program.program)
      .maybeSingle();

    const payload = {
      partner_profile_id: partnerProfileId,
      program: program.program,
      active: program.active,
      effective_start: program.effectiveStart || null,
      effective_end: program.effectiveEnd || null,
    };

    if (existing?.id) {
      const { error } = await input.admin
        .from("partner_programs")
        .update(payload)
        .eq("id", existing.id as string);
      if (error) return { error: error.message };
    } else if (program.active) {
      const { error } = await input.admin
        .from("partner_programs")
        .insert(payload);
      if (error) return { error: error.message };
    }
  }

  for (const rule of input.rules) {
    if (!Number.isFinite(rule.rateValue) || rule.rateValue < 0) {
      return { error: `Invalid rate for ${rule.program}.` };
    }
    if (
      !Number.isFinite(rule.attributionWindowDays) ||
      rule.attributionWindowDays < 1
    ) {
      return { error: `Invalid attribution window for ${rule.program}.` };
    }

    const revenueRules = {
      new_customer_period_days: rule.newCustomerPeriodDays,
      exclude: rule.excludeRevenue,
      ...(rule.refundRule ? { refund_rule: rule.refundRule } : {}),
    };

    const payload = {
      partner_profile_id: partnerProfileId,
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
      .eq("partner_profile_id", partnerProfileId)
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
  }

  await input.admin
    .from("partner_links_codes")
    .update({ cookie_life_days: Math.floor(input.cookieLifeDays) })
    .eq("partner_profile_id", partnerProfileId)
    .eq("type", "referral_link");

  const promoterId = input.firstpromoter.promoterId.trim();
  const { data: existingFp } = await input.admin
    .from("partner_firstpromoter_mappings")
    .select("id")
    .eq("partner_profile_id", partnerProfileId)
    .maybeSingle();

  if (promoterId) {
    const fpPayload = {
      partner_profile_id: partnerProfileId,
      promoter_id: promoterId,
      campaign_id: input.firstpromoter.campaignId.trim() || null,
      program: input.firstpromoter.program || null,
      updated_at: new Date().toISOString(),
    };
    if (existingFp?.id) {
      const { error } = await input.admin
        .from("partner_firstpromoter_mappings")
        .update(fpPayload)
        .eq("id", existingFp.id as string);
      if (error) return { error: error.message };
    } else {
      const { error } = await input.admin
        .from("partner_firstpromoter_mappings")
        .insert(fpPayload);
      if (error) return { error: error.message };
    }
  } else if (existingFp?.id) {
    await input.admin
      .from("partner_firstpromoter_mappings")
      .delete()
      .eq("id", existingFp.id as string);
  }

  await writePartnerAdminAudit(input.admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_profiles",
    entityId: partnerProfileId,
    action: "partner_programs_terms_saved",
    newValue: {
      programs: input.programs,
      cookieLifeDays: input.cookieLifeDays,
      firstpromoter: input.firstpromoter,
    },
  });

  return {};
}

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { formatDocumentDate } from "@/partner-center/documents/lib/format";
import type { ProgramTermsDetail } from "@/partner-center/documents/types";
import {
  parseEligibleRevenueRules,
  resolveRefundRule,
  type RefundRule,
  type RevenueComponent,
} from "@/partner-center/lib/attribution/eligible-revenue";
import {
  coalesceEligiblePeriod,
  coalescePaymentTerms,
} from "@/partner-center/lib/commission-defaults";
import { DEFAULT_COOKIE_LIFE_DAYS } from "@/partner-center/lib/referral-capture/constants";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { programLabel } from "@/partner-center/team/lib/labels";
import type { PartnerContext } from "@/partner-center/types/partner";
import {
  earningBasisLabel,
  eligiblePeriodLabel,
  rateOfRevenueLabel,
} from "@/partner-center/earnings/lib/format";

type RuleRow = {
  partner_profile_id: string | null;
  program: string;
  rate_type: string;
  rate_value: number | string;
  earning_basis: string | null;
  eligible_period: string | null;
  attribution_window_days: number;
  eligible_revenue_rules: unknown;
  payment_terms: string | null;
  effective_start: string | null;
  effective_end: string | null;
};

const EXCLUSION_LABELS: Record<RevenueComponent, string> = {
  tax: "Taxes",
  refunds: "Refunds",
  credits: "Credits",
  overages: "AI / usage overages",
  pass_through: "Pass-through expenses",
};

const REFUND_LABELS: Record<RefundRule, string> = {
  full: "Full reversal",
  proportional: "Proportional partial adjustment",
  future_negative_after_payout: "Future negative adjustment after payout",
};

function ruleIsCurrent(row: RuleRow, today: string): boolean {
  if (row.effective_start && row.effective_start > today) return false;
  if (row.effective_end && row.effective_end < today) return false;
  return true;
}

function pickRule(rows: RuleRow[], program: string, profileId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const scoped = rows.filter((row) => row.program === program);
  const current = scoped.filter((row) => ruleIsCurrent(row, today));
  const pool = current.length > 0 ? current : scoped;
  return (
    pool.find((row) => row.partner_profile_id === profileId) ??
    pool.find((row) => !row.partner_profile_id)
  );
}

function formatEligibleRevenue(
  rules: ReturnType<typeof parseEligibleRevenueRules>,
): string {
  const include = rules.include ?? [];
  if (include.length > 0) return include.join(", ");
  return "Collected revenue (less exclusions)";
}

function formatExcludedRevenue(
  rules: ReturnType<typeof parseEligibleRevenueRules>,
): string {
  const exclude = rules.exclude ?? [];
  if (exclude.length === 0) return "None";
  return exclude.map((item) => EXCLUSION_LABELS[item]).join(", ");
}

export async function loadProgramTermsDetail(
  context: PartnerContext | null,
  programParam?: string,
): Promise<ProgramTermsDetail | null> {
  const profile = context?.profile;
  if (!profile) return null;

  const empty: ProgramTermsDetail = {
    program: "platform",
    programTitle: "Program Terms — Referral Program",
    governedByLabel: "—",
    commissionRateLabel: "—",
    attributionWindowLabel: "—",
    eligiblePeriodLabel: "—",
    cookieRuleLabel: "—",
    eligibleRevenueLabel: "—",
    excludedRevenueLabel: "—",
    paymentTermsLabel: "—",
    refundsLabel: "—",
    activePrograms: [],
    priorVersions: [],
  };

  if (!isSupabaseConfigured()) return empty;

  const supabase = await createClient();
  const reader = createAdminClient() ?? supabase;

  const [
    { data: programRows },
    { data: ruleRows },
    { data: link },
    { data: agreement },
    { data: termsMeta },
  ] = await Promise.all([
    reader
      .from("partner_programs")
      .select("program, active")
      .eq("partner_profile_id", profile.id)
      .eq("active", true),
    reader
      .from("partner_commission_rules")
      .select(
        "partner_profile_id, program, rate_type, rate_value, earning_basis, eligible_period, attribution_window_days, eligible_revenue_rules, payment_terms, effective_start, effective_end",
      )
      .or(`partner_profile_id.eq.${profile.id},partner_profile_id.is.null`),
    reader
      .from("partner_links_codes")
      .select("cookie_life_days")
      .eq("partner_profile_id", profile.id)
      .eq("type", "referral_link")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    profile.agreement_document_id
      ? reader
          .from("documents")
          .select("title, version")
          .eq("id", profile.agreement_document_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    reader
      .from("partner_document_meta")
      .select("document_id, program")
      .eq("partner_profile_id", profile.id)
      .eq("document_kind", "program_terms"),
  ]);

  const activePrograms = (programRows ?? []).map((row) => {
    const value = row.program as string;
    return { value, label: programLabel(value) };
  });

  const preferred =
    (programParam &&
      activePrograms.some((item) => item.value === programParam) &&
      programParam) ||
    activePrograms.find((item) => item.value === "platform")?.value ||
    activePrograms[0]?.value ||
    "platform";

  const rules = (ruleRows as RuleRow[] | null) ?? [];
  const rule = pickRule(rules, preferred, profile.id);

  const cookieDays =
    (link?.cookie_life_days as number | null) ?? DEFAULT_COOKIE_LIFE_DAYS;

  let attributionMode: "first_touch" | "last_touch" = "first_touch";
  let platformRefundDefault: RefundRule = "proportional";
  try {
    const { data: attrConfig } = await reader
      .from("partner_platform_attribution_config")
      .select("attribution_mode, default_refund_rule")
      .limit(1)
      .maybeSingle();
    if (attrConfig?.attribution_mode === "last_touch") {
      attributionMode = "last_touch";
    }
    const refund = attrConfig?.default_refund_rule;
    if (
      refund === "full" ||
      refund === "proportional" ||
      refund === "future_negative_after_payout"
    ) {
      platformRefundDefault = refund;
    }
  } catch {
    // table may not exist yet locally
  }

  const revenueRules = parseEligibleRevenueRules(rule?.eligible_revenue_rules);

  let commissionRateLabel = "—";
  if (rule) {
    const rate = rateOfRevenueLabel(rule.rate_type, rule.rate_value);
    const basis = rule.earning_basis?.trim();
    if (rate !== "—" && basis) {
      commissionRateLabel = `${rate} (${earningBasisLabel(basis)})`;
    } else {
      commissionRateLabel = rate;
    }
  }

  let governedByLabel = "Currently applicable terms.";
  if (agreement) {
    const title = (agreement.title as string | null)?.trim();
    const version = agreement.version as number | null;
    if (title && version != null) {
      const withVersion = title.includes(`v${version}`)
        ? title
        : `${title} v${version}`;
      governedByLabel = `Currently applicable terms, governed by ${withVersion}.`;
    } else if (title) {
      governedByLabel = `Currently applicable terms, governed by ${title}.`;
    }
  }

  const programTitle =
    preferred === "platform"
      ? "Program Terms — Referral Program"
      : `Program Terms — ${programLabel(preferred)}`;

  const termsIds = (termsMeta ?? [])
    .filter((row) => {
      const program = row.program as string | null;
      return !program || program === preferred;
    })
    .map((row) => row.document_id as string);

  let priorVersions: ProgramTermsDetail["priorVersions"] = [];
  if (termsIds.length > 0) {
    const { data: termsDocs } = await reader
      .from("documents")
      .select("id, title, version, status, effective_date, created_at")
      .in("id", termsIds)
      .neq("visibility", "restricted")
      .order("version", { ascending: false });

    priorVersions = (termsDocs ?? [])
      .filter((row) => (row.status as string) === "archived")
      .map((row) => ({
        id: row.id as string,
        title: (row.title as string) || "Program Terms",
        version: (row.version as number) ?? 1,
        dateLabel: formatDocumentDate(
          (row.effective_date as string | null) ??
            (row.created_at as string | null),
        ),
        href: `/partner-center/documents/${row.id}`,
      }));
  }

  return {
    program: preferred,
    programTitle,
    governedByLabel,
    commissionRateLabel,
    attributionWindowLabel: rule
      ? `${rule.attribution_window_days} days`
      : "—",
    eligiblePeriodLabel: eligiblePeriodLabel(
      coalesceEligiblePeriod(rule?.eligible_period),
    ),
    cookieRuleLabel: `${
      attributionMode === "first_touch" ? "First-touch" : "Last-touch"
    } attribution via referral link, ${cookieDays}-day cookie`,
    eligibleRevenueLabel: rule
      ? formatEligibleRevenue(revenueRules)
      : "—",
    excludedRevenueLabel: rule
      ? formatExcludedRevenue(revenueRules)
      : "—",
    paymentTermsLabel: coalescePaymentTerms(rule?.payment_terms),
    refundsLabel: rule
      ? REFUND_LABELS[resolveRefundRule(revenueRules, platformRefundDefault)]
      : "—",
    activePrograms:
      activePrograms.length > 0
        ? activePrograms
        : [{ value: preferred, label: programLabel(preferred) }],
    priorVersions,
  };
}

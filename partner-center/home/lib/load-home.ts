import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { rateDisplay } from "@/partner-center/earnings/lib/format";
import { buildActionItems } from "@/partner-center/home/lib/build-actions";
import { buildActivityItems } from "@/partner-center/home/lib/build-activity";
import type { PartialLoadResult } from "@/partner-center/lib/load-result";
import type {
  EarningsTotals,
  HomeDashboard,
  OpportunityCounts,
  ProgramRow,
  ReferralCounts,
} from "@/partner-center/home/types";
import { buildChecklistItems } from "@/partner-center/lib/checklist-state";
import {
  effectiveAmountForRow,
  mapAdjustmentsByEarningId,
  sumEarningsWithAdjustments,
} from "@/partner-center/earnings/lib/sum-earnings";
import { resolvePayoutGate } from "@/partner-center/lib/payout-gate";
import {
  DEFAULT_PROGRAM_TERMS,
  loadProgramTerms,
} from "@/partner-center/lib/program-terms";
import { refreshStalePartnerStripeStatus } from "@/partner-center/lib/stripe-connect";
import { loadPartnerUnreadCount } from "@/partner-center/messages/lib/unread-count";
import { partnerMessagesVisibleSince } from "@/partner-center/messages/lib/message-visibility";
import type { PartnerContext } from "@/partner-center/types/partner";

const EMPTY_REFERRALS: ReferralCounts = {
  referred: 0,
  inProgress: 0,
  converted: 0,
  total: 0,
};

const EMPTY_OPPS: OpportunityCounts = {
  submitted: 0,
  inProgress: 0,
  converted: 0,
  total: 0,
};

const EMPTY_EARNINGS: EarningsTotals = {
  pending: 0,
  payable: 0,
  held: 0,
  paid: 0,
};

type RuleRow = {
  partner_profile_id: string | null;
  program: string;
  rate_type: string;
  rate_value: number | string;
};

function pickRule(rows: RuleRow[], program: string, profileId: string) {
  return (
    rows.find(
      (row) => row.program === program && row.partner_profile_id === profileId,
    ) ?? rows.find((row) => row.program === program && !row.partner_profile_id)
  );
}

function programRateLabel(
  rules: RuleRow[],
  program: string,
  profileId: string,
): string {
  const rule = pickRule(rules, program, profileId);
  return rateDisplay(rule?.rate_type, rule?.rate_value);
}

function countReferrals(
  rows: { status: string }[],
): ReferralCounts {
  const counts = { ...EMPTY_REFERRALS };
  for (const row of rows) {
    counts.total += 1;
    if (row.status === "referred") counts.referred += 1;
    else if (row.status === "in_progress") counts.inProgress += 1;
    else if (row.status === "converted") counts.converted += 1;
  }
  return counts;
}

function countOpportunities(
  rows: { status: string }[],
): OpportunityCounts {
  const counts = { ...EMPTY_OPPS };
  for (const row of rows) {
    counts.total += 1;
    if (row.status === "submitted") counts.submitted += 1;
    else if (row.status === "accepted" || row.status === "in_progress") {
      counts.inProgress += 1;
    } else if (row.status === "converted") counts.converted += 1;
  }
  return counts;
}

function sumEarnings(
  rows: { id: string; amount: number | string; status: string }[],
  adjustmentsByEarningId: Map<string, { amount_delta: number | string }[]>,
): EarningsTotals {
  const summed = sumEarningsWithAdjustments(rows, adjustmentsByEarningId);
  return {
    pending: summed.pending,
    payable: summed.payable,
    held: summed.held,
    paid: summed.paid,
  };
}

export async function loadHomeDashboard(
  context: PartnerContext | null,
): Promise<PartialLoadResult<HomeDashboard>> {
  const companyName = context?.company?.name?.trim() || "Partner";
  let profile = context?.profile;
  if (!profile || !isSupabaseConfigured()) {
    return {
      ok: false,
      error: "No partner profile is available yet.",
    };
  }

  const warnings: string[] = [];

  const supabase = await createClient();
  profile = await refreshStalePartnerStripeStatus({
    supabase,
    profile,
  });
  const profileId = profile.id;
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const [
    referralsRes,
    oppsRes,
    earningsRes,
    programsRes,
    docsRes,
    linkRes,
    rulesRes,
    terms,
    unreadMessages,
  ] = await Promise.all([
    supabase
      .from("partner_referrals")
      .select(
        "id, program, product, status, source, referral_date, conversion_event_date, created_at, referred_contact_id",
      )
      .eq("partner_profile_id", profileId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_opportunities")
      .select(
        "id, status, accepted_at, protected_until, created_at, company_id",
      )
      .eq("partner_profile_id", profileId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_earnings")
      .select("id, amount, status, payable_date, updated_at, created_at")
      .eq("partner_profile_id", profileId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_programs")
      .select("program, active")
      .eq("partner_profile_id", profileId),
    supabase
      .from("documents")
      .select("id, title, effective_date")
      .eq("context_type", "partner_profile")
      .eq("context_id", profileId)
      .eq("status", "action_needed")
      .order("updated_at", { ascending: false }),
    supabase
      .from("partner_links_codes")
      .select("code")
      .eq("partner_profile_id", profileId)
      .eq("type", "referral_link")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("partner_commission_rules")
      .select("partner_profile_id, program, rate_type, rate_value")
      .or(`partner_profile_id.eq.${profileId},partner_profile_id.is.null`),
    loadProgramTerms(profileId),
    authUser
      ? loadPartnerUnreadCount(
          profileId,
          authUser.id,
          partnerMessagesVisibleSince(context),
        )
      : Promise.resolve(0),
  ]);

  const referralRows = referralsRes.error ? [] : (referralsRes.data ?? []);
  if (referralsRes.error) {
    warnings.push("Referral counts could not be loaded.");
  }
  const contactIds = [
    ...new Set(
      referralRows
        .map((row) => row.referred_contact_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const oppRows = oppsRes.error ? [] : (oppsRes.data ?? []);
  if (oppsRes.error) {
    warnings.push("Opportunity counts could not be loaded.");
  }
  const companyIds = [
    ...new Set(
      oppRows
        .map((row) => row.company_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const contactNameById = new Map<string, string>();
  const companyNameById = new Map<string, string>();

  await Promise.all([
    contactIds.length > 0
      ? supabase
          .from("contacts")
          .select("id, first_name, last_name, preferred_name")
          .in("id", contactIds)
          .then(({ data: contacts }) => {
            for (const contact of contacts ?? []) {
              const preferred = (contact.preferred_name as string | null)?.trim();
              const composed = [contact.first_name, contact.last_name]
                .map((part) => (part as string | null)?.trim())
                .filter(Boolean)
                .join(" ");
              const name = preferred || composed;
              if (name) contactNameById.set(contact.id as string, name);
            }
          })
      : Promise.resolve(),
    companyIds.length > 0
      ? supabase
          .from("companies")
          .select("id, name")
          .in("id", companyIds)
          .then(({ data: companies }) => {
            for (const company of companies ?? []) {
              const name = (company.name as string | null)?.trim();
              if (name) companyNameById.set(company.id as string, name);
            }
          })
      : Promise.resolve(),
  ]);

  const referrals = referralRows.map((row) => ({
    id: row.id as string,
    program: row.program as string,
    product: (row.product as string | null) ?? null,
    status: row.status as string,
    source: (row.source as string | null) ?? null,
    referral_date: row.referral_date as string,
    conversion_event_date: (row.conversion_event_date as string | null) ?? null,
    created_at: row.created_at as string,
    contact_name: contactNameById.get(row.referred_contact_id as string) ?? null,
  }));

  const opportunities = oppRows.map((row) => ({
    id: row.id as string,
    status: row.status as string,
    accepted_at: (row.accepted_at as string | null) ?? null,
    protected_until: (row.protected_until as string | null) ?? null,
    created_at: row.created_at as string,
    company_name: companyNameById.get(row.company_id as string) ?? null,
  }));

  const earningsRows = (earningsRes.error ? [] : (earningsRes.data ?? [])).map((row) => ({
    id: row.id as string,
    amount: row.amount as number | string,
    status: row.status as string,
    payable_date: (row.payable_date as string | null) ?? null,
    updated_at: row.updated_at as string,
    created_at: row.created_at as string,
  }));
  if (earningsRes.error) {
    warnings.push("Earnings totals could not be loaded.");
  }

  let adjustmentsByEarningId = new Map<
    string,
    { amount_delta: number | string }[]
  >();
  let adjustmentsFailed = false;
  if (earningsRows.length > 0) {
    const earningIds = earningsRows.map((row) => row.id);
    const { data: adjustmentRows, error: adjustmentsError } = await supabase
      .from("partner_earning_adjustments")
      .select("earning_id, amount_delta")
      .in("earning_id", earningIds);
    if (adjustmentsError) {
      adjustmentsFailed = true;
      warnings.push(
        "Earnings adjustments could not be loaded — totals hidden until reload.",
      );
    } else {
      adjustmentsByEarningId = mapAdjustmentsByEarningId(
        (adjustmentRows ?? []) as {
          earning_id: string;
          amount_delta: number | string;
        }[],
      );
    }
  }

  const referralCounts = countReferrals(referrals);
  const opportunityCounts = countOpportunities(opportunities);
  const earnings = adjustmentsFailed
    ? { ...EMPTY_EARNINGS }
    : sumEarnings(earningsRows, adjustmentsByEarningId);

  const activityEarnings = adjustmentsFailed
    ? []
    : earningsRows.map((row) => ({
        id: row.id,
        amount: effectiveAmountForRow(row, adjustmentsByEarningId),
        status: row.status,
        created_at: row.created_at,
      }));

  const programActive = new Map<string, boolean>();
  for (const row of programsRes.error ? [] : (programsRes.data ?? [])) {
    programActive.set(row.program as string, Boolean(row.active));
  }

  const hasActivePrograms = [...programActive.values()].some(Boolean);

  const rules = (rulesRes.error ? [] : (rulesRes.data ?? [])) as RuleRow[];

  const programs: ProgramRow[] = (
    ["academy", "platform", "enterprise"] as const
  ).map((key) => ({
    key,
    label: key === "academy" ? "Academy" : key === "platform" ? "Whitby" : "Enterprise",
    active: programActive.get(key) === true,
    rateLabel: programRateLabel(rules, key, profileId),
  }));

  const payoutGate = resolvePayoutGate(profile);

  const documents = (docsRes.error ? [] : (docsRes.data ?? [])).map((row) => ({
    id: row.id as string,
    title: (row.title as string) || "Document action required",
    effective_date: (row.effective_date as string | null) ?? null,
  }));

  const referralCode = linkRes.error
    ? null
    : ((linkRes.data?.code as string | undefined) ?? null);
  const { items: checklistItems } = buildChecklistItems(context, {
    hasReferralLink: Boolean(referralCode),
    hasActivePrograms,
  });

  const actions = buildActionItems({
    profile: {
      tax_profile_status: profile.tax_profile_status,
      payment_setup_status: profile.payment_setup_status,
      payout_eligibility: profile.payout_eligibility,
      status: profile.status,
    },
    payableTotal: earnings.payable,
    checklistItems,
    applicationData: profile.application_data,
    documents,
    unreadMessages,
  });

  const activity = buildActivityItems({
    referrals,
    opportunities,
    earnings: activityEarnings,
  });

  const earningsTermsLine = `${terms.academy} Academy · ${terms.platform} Whitby · ${terms.payment}`;

  const dashboard: HomeDashboard = {
    companyName,
    payoutGate,
    referralCounts,
    opportunityCounts,
    earnings,
    earningsTermsLine,
    programs,
    actions,
    activity,
    loadWarnings: warnings.length > 0 ? warnings : undefined,
  };

  return {
    ok: true,
    data: dashboard,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

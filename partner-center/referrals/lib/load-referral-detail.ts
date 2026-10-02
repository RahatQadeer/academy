import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { coalescePaymentTerms } from "@/partner-center/lib/commission-defaults";
import {
  addDays,
  basisLabel,
  earningStatusLabel,
  formatDateTime,
  formatRateLabel,
  formatShortDate,
  programLabel,
  qualifyingActionLabel,
  referralDisplayId,
  sourceLabel,
} from "@/partner-center/referrals/lib/format";
import type {
  ReferralDetail,
  ReferralEarningSummary,
  ReferralTimelineItem,
} from "@/partner-center/referrals/types";
import type { PartnerContext } from "@/partner-center/types/partner";

function contactDisplayName(contact: {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string | null {
  const preferred = contact.preferred_name?.trim();
  if (preferred) return preferred;
  const composed = [contact.first_name, contact.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return composed || null;
}

function pickRule<T extends { partner_profile_id: string | null; program: string }>(
  rows: T[],
  program: string,
  profileId: string,
): T | undefined {
  return (
    rows.find(
      (row) => row.program === program && row.partner_profile_id === profileId,
    ) ?? rows.find((row) => row.program === program && !row.partner_profile_id)
  );
}

function buildTimeline(input: {
  id: string;
  source: string | null;
  referralDate: string;
  createdAt: string;
  attributionEvents: {
    id: string;
    qualifying_action: string;
    event_timestamp: string;
  }[];
}): ReferralTimelineItem[] {
  const items: ReferralTimelineItem[] = [];
  const via = sourceLabel(input.source).toLowerCase();

  for (const event of input.attributionEvents) {
    items.push({
      id: `attr-${event.id}`,
      at: event.event_timestamp,
      dateLabel: formatShortDate(event.event_timestamp),
      parts: [{ text: qualifyingActionLabel(event.qualifying_action) }],
    });
  }

  const recordedAt = input.referralDate || input.createdAt;
  items.push({
    id: `recorded-${input.id}`,
    at: recordedAt,
    dateLabel: formatShortDate(recordedAt),
    parts: [{ text: `Referral recorded through ${via}.` }],
  });

  items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return items;
}

export async function loadReferralDetail(
  context: PartnerContext | null,
  referralId: string,
): Promise<ReferralDetail | null> {
  const profile = context?.profile;
  if (!profile || !isSupabaseConfigured() || !referralId) return null;

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("partner_referrals")
    .select(
      "id, program, product, status, source, referral_date, conversion_event_date, created_at, referred_contact_id, referred_user_id, referral_code_id",
    )
    .eq("partner_profile_id", profile.id)
    .eq("id", referralId)
    .maybeSingle();

  if (error || !row) return null;

  const contactId = row.referred_contact_id as string | null;
  const referredUserId = (row.referred_user_id as string | null) ?? null;
  const linkId = row.referral_code_id as string | null;
  const program = row.program as string;

  const [contactRes, linkRes, rulesRes, eventsRes, userRes] = await Promise.all([
    contactId
      ? supabase
          .from("contacts")
          .select("id, first_name, last_name, preferred_name")
          .eq("id", contactId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    linkId
      ? supabase
          .from("partner_links_codes")
          .select("id, code, type")
          .eq("id", linkId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("partner_commission_rules")
      .select(
        "id, partner_profile_id, program, rate_type, rate_value, earning_basis, attribution_window_days, payment_terms",
      )
      .or(`partner_profile_id.eq.${profile.id},partner_profile_id.is.null`)
      .eq("program", program),
    supabase
      .from("partner_attribution_events")
      .select("id, qualifying_action, event_timestamp, product, created_at")
      .eq("partner_profile_id", profile.id)
      .eq("referral_id", referralId)
      .order("event_timestamp", { ascending: false }),
    referredUserId
      ? supabase
          .from("users")
          .select("id, email, full_name, preferred_name")
          .eq("id", referredUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let companyName: string | null = null;
  if (contactId) {
    const { data: companyLinks } = await supabase
      .from("company_contacts")
      .select("company_id, is_primary")
      .eq("contact_id", contactId);
    const companyIds = (companyLinks ?? []).map(
      (link) => link.company_id as string,
    );
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      const nameById = new Map(
        (companies ?? []).map((company) => [
          company.id as string,
          ((company.name as string | null) ?? "").trim(),
        ]),
      );
      const primary = (companyLinks ?? []).find((link) => link.is_primary);
      const pick =
        (primary && nameById.get(primary.company_id as string)) ||
        [...nameById.values()].find(Boolean) ||
        null;
      companyName = pick || null;
    }
  }

  const contactName = contactRes.data
    ? contactDisplayName({
        preferred_name: contactRes.data.preferred_name as string | null,
        first_name: contactRes.data.first_name as string | null,
        last_name: contactRes.data.last_name as string | null,
      })
    : null;

  let referredUserLabel: string | null = null;
  if (userRes.data) {
    const preferred = (userRes.data.preferred_name as string | null)?.trim();
    const full = (userRes.data.full_name as string | null)?.trim();
    const email = (userRes.data.email as string | null)?.trim();
    referredUserLabel = preferred || full || email || referredUserId;
  }

  const rule = pickRule(
    (rulesRes.data ?? []) as {
      id: string;
      partner_profile_id: string | null;
      program: string;
      rate_type: string;
      rate_value: number | string;
      earning_basis: string | null;
      attribution_window_days: number;
      payment_terms: string | null;
    }[],
    program,
    profile.id,
  );

  const windowDays = rule?.attribution_window_days ?? 90;
  const referralDate =
    (row.referral_date as string) || (row.created_at as string);
  const through = addDays(referralDate, windowDays);
  const attributionWindowLabel = through
    ? `${windowDays} days — through ${formatShortDate(through.toISOString())}`
    : `${windowDays} days`;

  const linkCode = (linkRes.data?.code as string | null) ?? null;
  const baseSource = sourceLabel(row.source as string | null);
  const sourceDetail = linkCode ? linkCode : null;
  const sourceFull = sourceDetail
    ? `${baseSource} — ${sourceDetail}`
    : baseSource;

  const events = (eventsRes.data ?? []).map((event) => ({
    id: event.id as string,
    qualifying_action: event.qualifying_action as string,
    event_timestamp:
      (event.event_timestamp as string) || (event.created_at as string),
    product: (event.product as string | null) ?? null,
  }));

  let earning: ReferralEarningSummary | null = null;
  if (events.length > 0) {
    const eventIds = events.map((event) => event.id);
    const { data: earnings } = await supabase
      .from("partner_earnings")
      .select("id, amount, status, commission_rule_id, created_at")
      .eq("partner_profile_id", profile.id)
      .in("attribution_event_id", eventIds)
      .order("created_at", { ascending: false })
      .limit(1);

    const ear = earnings?.[0];
    if (ear) {
      const paymentTerms = rule?.payment_terms
        ? coalescePaymentTerms(rule.payment_terms)
        : null;
      earning = {
        rateLabel: formatRateLabel(
          rule?.rate_type,
          rule?.rate_value,
          program,
        ),
        basisLabel: basisLabel(rule?.earning_basis),
        amount: Number(ear.amount) || 0,
        status: ear.status as string,
        statusLabel: earningStatusLabel(ear.status as string),
        paymentTerms,
      };
    }
  }

  const title =
    companyName?.trim() ||
    contactName?.trim() ||
    (row.product as string | null)?.trim() ||
    referralDisplayId(row.id as string);

  return {
    id: row.id as string,
    displayId: referralDisplayId(row.id as string),
    title,
    status: row.status as string,
    contactName,
    companyName,
    companyViaContact: Boolean(companyName && contactId),
    referredUserId,
    referredUserLabel,
    program,
    programLabel: programLabel(program),
    product: (row.product as string | null) ?? null,
    sourceLabel: sourceFull,
    sourceDetail,
    referralDateLabel: formatDateTime(row.created_at as string),
    attributionWindowLabel,
    conversionDateLabel: row.conversion_event_date
      ? formatShortDate(row.conversion_event_date as string)
      : null,
    timeline: buildTimeline({
      id: row.id as string,
      source: row.source as string | null,
      referralDate,
      createdAt: row.created_at as string,
      attributionEvents: events,
    }),
    hasAttributionEvents: events.length > 0,
    earning,
  };
}

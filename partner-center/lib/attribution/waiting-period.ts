import type { SupabaseClient } from "@supabase/supabase-js";

/** SRS §17.1.12 — default when Admin has not set a value. */
export const DEFAULT_NEW_CUSTOMER_PERIOD_DAYS = 60;

const ALLOWED_PERIODS = new Set([30, 60, 90]);

/**
 * Reads configurable 30/60/90 from commission rule `eligible_revenue_rules`
 * JSON without a schema migration. Example:
 * `{ "new_customer_period_days": 60 }`
 */
export function parseNewCustomerPeriodDays(
  eligibleRevenueRules: unknown,
): number {
  if (!eligibleRevenueRules || typeof eligibleRevenueRules !== "object") {
    return DEFAULT_NEW_CUSTOMER_PERIOD_DAYS;
  }
  const raw = (eligibleRevenueRules as Record<string, unknown>)
    .new_customer_period_days;
  const days =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(days) || !ALLOWED_PERIODS.has(days)) {
    return DEFAULT_NEW_CUSTOMER_PERIOD_DAYS;
  }
  return days;
}

/** Earliest signal that the partner began referring (link or first referral). */
export async function resolvePartnerReferringStartedAt(
  supabase: SupabaseClient,
  partnerProfileId: string,
): Promise<Date | null> {
  const [links, referrals, profile] = await Promise.all([
    supabase
      .from("partner_links_codes")
      .select("created_at")
      .eq("partner_profile_id", partnerProfileId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("partner_referrals")
      .select("referral_date, created_at")
      .eq("partner_profile_id", partnerProfileId)
      .order("referral_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("partner_profiles")
      .select("created_at, updated_at, status")
      .eq("id", partnerProfileId)
      .maybeSingle(),
  ]);

  const candidates: number[] = [];

  const linkAt = links.data?.created_at
    ? Date.parse(links.data.created_at as string)
    : NaN;
  if (!Number.isNaN(linkAt)) candidates.push(linkAt);

  const referralDay = referrals.data?.referral_date as string | undefined;
  if (referralDay) {
    const parsed = Date.parse(`${referralDay}T00:00:00.000Z`);
    if (!Number.isNaN(parsed)) candidates.push(parsed);
  }
  const referralCreated = referrals.data?.created_at
    ? Date.parse(referrals.data.created_at as string)
    : NaN;
  if (!Number.isNaN(referralCreated)) candidates.push(referralCreated);

  if (profile.data?.status === "active" && profile.data.updated_at) {
    const activated = Date.parse(profile.data.updated_at as string);
    if (!Number.isNaN(activated)) candidates.push(activated);
  }
  const profileCreated = profile.data?.created_at
    ? Date.parse(profile.data.created_at as string)
    : NaN;
  if (!Number.isNaN(profileCreated)) candidates.push(profileCreated);

  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates));
}

export function waitingPeriodEndsAt(
  startedAt: Date,
  periodDays: number,
): Date {
  const end = new Date(startedAt);
  end.setUTCDate(end.getUTCDate() + periodDays);
  return end;
}

export function isNewCustomerWaitingPeriodComplete(
  startedAt: Date | null,
  periodDays: number,
  asOf: Date = new Date(),
): boolean {
  if (!startedAt) return true;
  return asOf.getTime() >= waitingPeriodEndsAt(startedAt, periodDays).getTime();
}

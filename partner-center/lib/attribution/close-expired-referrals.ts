import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCommissionRules } from "@/partner-center/lib/attribution/pick-commission-rule";

const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 90;
const OPEN_STATUSES = ["referred", "in_progress"] as const;

function addDays(isoDate: string, days: number): Date {
  const base = Date.parse(isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00.000Z`);
  const date = new Date(Number.isNaN(base) ? Date.now() : base);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function isExpired(
  referralDate: string,
  windowDays: number,
  asOf: Date,
): boolean {
  return asOf.getTime() > addDays(referralDate, windowDays).getTime();
}

export type CloseExpiredOptions = {
  /** Limit to one partner's open referrals (list-load path). */
  partnerProfileId?: string;
  /** When set, only consider these referral ids (lazy path). */
  referralIds?: string[];
  /** Cap rows scanned for bulk/cron. */
  limit?: number;
  asOf?: Date;
};

export type CloseExpiredResult = {
  closedIds: string[];
  scanned: number;
};

/**
 * Marks open referrals past their attribution window as `not_converted`.
 * Scoped by partner or ids when provided to avoid full-table work on list load.
 */
export async function closeExpiredReferrals(
  supabase: SupabaseClient,
  options: CloseExpiredOptions = {},
): Promise<CloseExpiredResult> {
  const asOf = options.asOf ?? new Date();
  const limit = options.limit ?? 500;

  let query = supabase
    .from("partner_referrals")
    .select("id, partner_profile_id, program, referral_date, status")
    .in("status", [...OPEN_STATUSES])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (options.partnerProfileId) {
    query = query.eq("partner_profile_id", options.partnerProfileId);
  }
  if (options.referralIds?.length) {
    query = query.in("id", options.referralIds);
  }

  const { data: rows, error } = await query;
  if (error || !rows?.length) {
    return { closedIds: [], scanned: 0 };
  }

  const windowByKey = new Map<string, number>();
  async function windowDaysFor(
    partnerProfileId: string,
    program: string,
  ): Promise<number> {
    const key = `${partnerProfileId}:${program}`;
    const cached = windowByKey.get(key);
    if (cached != null) return cached;
    const rule = await loadCommissionRules(
      supabase,
      partnerProfileId,
      program,
    );
    const days = rule?.attribution_window_days ?? DEFAULT_ATTRIBUTION_WINDOW_DAYS;
    windowByKey.set(key, days);
    return days;
  }

  const toClose: string[] = [];
  for (const row of rows) {
    const days = await windowDaysFor(
      row.partner_profile_id as string,
      row.program as string,
    );
    if (isExpired(row.referral_date as string, days, asOf)) {
      toClose.push(row.id as string);
    }
  }

  if (toClose.length === 0) {
    return { closedIds: [], scanned: rows.length };
  }

  const { error: updateError } = await supabase
    .from("partner_referrals")
    .update({ status: "not_converted" })
    .in("id", toClose)
    .in("status", [...OPEN_STATUSES]);

  if (updateError) {
    return { closedIds: [], scanned: rows.length };
  }

  const closedSet = new Set(toClose);
  const { notifyPartnerReferralStatus } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  for (const row of rows) {
    if (!closedSet.has(row.id as string)) continue;
    void notifyPartnerReferralStatus({
      admin: supabase,
      partnerProfileId: row.partner_profile_id as string,
      referralId: row.id as string,
      status: "not_converted",
    }).catch((error: unknown) => {
      console.error(
        "[closeExpiredReferrals] partner notification failed",
        row.id,
        error,
      );
    });
  }

  return { closedIds: toClose, scanned: rows.length };
}

/** Close a single open referral if its window has ended. */
export async function closeReferralIfExpired(
  supabase: SupabaseClient,
  row: {
    id: string;
    partner_profile_id: string;
    program: string;
    referral_date: string;
  },
  asOf: Date = new Date(),
): Promise<boolean> {
  const rule = await loadCommissionRules(
    supabase,
    row.partner_profile_id,
    row.program,
  );
  const days = rule?.attribution_window_days ?? DEFAULT_ATTRIBUTION_WINDOW_DAYS;
  if (!isExpired(row.referral_date, days, asOf)) return false;

  const { error } = await supabase
    .from("partner_referrals")
    .update({ status: "not_converted" })
    .eq("id", row.id)
    .in("status", [...OPEN_STATUSES]);

  if (error) return false;

  const { notifyPartnerReferralStatus } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  void notifyPartnerReferralStatus({
    admin: supabase,
    partnerProfileId: row.partner_profile_id,
    referralId: row.id,
    status: "not_converted",
  }).catch((notifyError: unknown) => {
    console.error(
      "[closeReferralIfExpired] partner notification failed",
      row.id,
      notifyError,
    );
  });

  return true;
}

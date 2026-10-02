import type { SupabaseClient } from "@supabase/supabase-js";
import { closeReferralIfExpired } from "@/partner-center/lib/attribution/close-expired-referrals";
import { loadCommissionRules } from "@/partner-center/lib/attribution/pick-commission-rule";
import type {
  AttributionProduct,
  OpenReferralRow,
} from "@/partner-center/lib/attribution/types";
import { commissionProgramForReferral } from "@/partner-center/lib/referral-capture/infer-program";

function addDays(isoDate: string, days: number): Date {
  const base = Date.parse(isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00.000Z`);
  const date = new Date(Number.isNaN(base) ? Date.now() : base);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function isWithinAttributionWindow(
  referralDate: string,
  windowDays: number,
  eventTime: Date,
): boolean {
  const windowEnd = addDays(referralDate, windowDays);
  return eventTime.getTime() <= windowEnd.getTime();
}

export async function resolveOpenReferral(
  supabase: SupabaseClient,
  referredUserId: string,
  product: AttributionProduct,
  eventTime: Date,
): Promise<OpenReferralRow | null> {
  // Whitby UI may still have an unsigned `platform` row until promote; accept both.
  const programs =
    product === "whitbyos" ? (["whitbyos", "platform"] as const) : ([product] as const);

  const { data: rows, error } = await supabase
    .from("partner_referrals")
    .select(
      "id, partner_profile_id, program, status, referral_date, product",
    )
    .eq("referred_user_id", referredUserId)
    .in("program", [...programs])
    .in("status", ["referred", "in_progress"])
    .order("created_at", { ascending: false });

  if (error || !rows?.length) return null;

  const commissionProgram =
    commissionProgramForReferral(product) ?? product;

  for (const row of rows as OpenReferralRow[]) {
    const rule = await loadCommissionRules(
      supabase,
      row.partner_profile_id,
      commissionProgram,
    );
    const windowDays = rule?.attribution_window_days ?? 90;
    if (
      isWithinAttributionWindow(row.referral_date, windowDays, eventTime)
    ) {
      return row;
    }
    await closeReferralIfExpired(supabase, row, eventTime);
  }

  return null;
}

export async function findExistingAttributionEvent(
  supabase: SupabaseClient,
  partnerProfileId: string,
  externalPaymentId: string,
) {
  const { data } = await supabase
    .from("partner_attribution_events")
    .select("id, referral_id, partner_profile_id")
    .eq("partner_profile_id", partnerProfileId)
    .eq("external_payment_id", externalPaymentId)
    .maybeSingle();

  return data as {
    id: string;
    referral_id: string | null;
    partner_profile_id: string;
  } | null;
}

/** Global lookup by payment id (§17.7.11 — one economic payment → one event). */
export async function findAttributionEventByPaymentId(
  supabase: SupabaseClient,
  externalPaymentId: string,
) {
  const { data } = await supabase
    .from("partner_attribution_events")
    .select("id, referral_id, partner_profile_id")
    .eq("external_payment_id", externalPaymentId)
    .maybeSingle();

  return data as {
    id: string;
    referral_id: string | null;
    partner_profile_id: string;
  } | null;
}

export async function findEarningForEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("partner_earnings")
    .select("id")
    .eq("attribution_event_id", eventId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

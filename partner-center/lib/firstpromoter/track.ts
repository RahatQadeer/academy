import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPlatformAttributionConfig } from "@/super-admin/partner-center/services/platform-attribution-config";

/**
 * Outbound FirstPromoter Tracking API (§17.15.6).
 * Does not create Whitby earnings — Whitby remains SoR.
 */

type TrackSaleInput = {
  partnerProfileId: string;
  referredUserId: string;
  eventId: string;
  amountCollectedCents?: number;
  externalPaymentId?: string;
};

export async function trackFirstPromoterSale(
  supabase: SupabaseClient,
  input: TrackSaleInput,
): Promise<void> {
  const apiKey = process.env.FIRSTPROMOTER_API_KEY?.trim();
  if (!apiKey) return;

  try {
    const config = await loadPlatformAttributionConfig(supabase);
    if (!config.firstpromoterEnabled) return;

    const { data: mapping } = await supabase
      .from("partner_firstpromoter_mappings")
      .select("promoter_id, campaign_id")
      .eq("partner_profile_id", input.partnerProfileId)
      .maybeSingle();

    if (!mapping?.promoter_id) return;

    const amount =
      typeof input.amountCollectedCents === "number"
        ? input.amountCollectedCents / 100
        : undefined;

    const body: Record<string, unknown> = {
      email: undefined,
      uid: input.referredUserId,
      event_id: input.eventId,
      ref_id: mapping.promoter_id as string,
    };
    if (mapping.campaign_id) {
      body.campaign_id = mapping.campaign_id;
    }
    if (amount != null) {
      body.amount = amount;
      body.currency = "USD";
    }
    if (input.externalPaymentId) {
      body.sale_id = input.externalPaymentId;
    }

    const response = await fetch("https://firstpromoter.com/api/v1/track/sale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        "[firstpromoter] track/sale failed",
        response.status,
        text.slice(0, 200),
      );
    }
  } catch (error) {
    console.error("[firstpromoter] track/sale error", error);
  }
}

export async function trackFirstPromoterSignup(
  supabase: SupabaseClient,
  input: {
    partnerProfileId: string;
    referredUserId: string;
    email?: string;
    eventId: string;
  },
): Promise<void> {
  const apiKey = process.env.FIRSTPROMOTER_API_KEY?.trim();
  if (!apiKey) return;

  try {
    const config = await loadPlatformAttributionConfig(supabase);
    if (!config.firstpromoterEnabled) return;

    const { data: mapping } = await supabase
      .from("partner_firstpromoter_mappings")
      .select("promoter_id, campaign_id")
      .eq("partner_profile_id", input.partnerProfileId)
      .maybeSingle();

    if (!mapping?.promoter_id) return;

    const body: Record<string, unknown> = {
      uid: input.referredUserId,
      email: input.email,
      event_id: input.eventId,
      ref_id: mapping.promoter_id as string,
    };
    if (mapping.campaign_id) body.campaign_id = mapping.campaign_id;

    const response = await fetch(
      "https://firstpromoter.com/api/v1/track/signup",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        "[firstpromoter] track/signup failed",
        response.status,
        text.slice(0, 200),
      );
    }
  } catch (error) {
    console.error("[firstpromoter] track/signup error", error);
  }
}

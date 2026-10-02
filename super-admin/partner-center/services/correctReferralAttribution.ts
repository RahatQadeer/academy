import type { SupabaseClient } from "@supabase/supabase-js";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type CorrectReferralAttributionInput = {
  admin: SupabaseClient;
  actorUserId: string | null;
  referralId: string;
  newPartnerProfileId: string;
  reason: string;
};

export async function correctReferralAttribution(
  input: CorrectReferralAttributionInput,
): Promise<{ error?: string }> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    return { error: "A reason is required for attribution correction." };
  }

  const { data: referral, error: loadError } = await input.admin
    .from("partner_referrals")
    .select("id, partner_profile_id, status, source")
    .eq("id", input.referralId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!referral) return { error: "Referral not found." };

  const previousPartnerId = referral.partner_profile_id as string;
  if (previousPartnerId === input.newPartnerProfileId) {
    return { error: "Choose a different partner than the current attribution." };
  }

  const { data: newPartner, error: partnerError } = await input.admin
    .from("partner_profiles")
    .select("id, status")
    .eq("id", input.newPartnerProfileId)
    .maybeSingle();

  if (partnerError) return { error: partnerError.message };
  if (!newPartner) return { error: "Target partner not found." };
  const status = (newPartner.status as string).toLowerCase();
  if (status !== "active" && status !== "approved") {
    return { error: "Target partner must be approved or active." };
  }

  const { data: events } = await input.admin
    .from("partner_attribution_events")
    .select("id")
    .eq("referral_id", input.referralId);
  const eventIds = (events ?? []).map((event) => event.id as string);

  if (eventIds.length > 0) {
    const { data: paid } = await input.admin
      .from("partner_earnings")
      .select("id")
      .in("attribution_event_id", eventIds)
      .eq("status", "paid")
      .limit(1);
    if ((paid ?? []).length > 0) {
      return {
        error:
          "Cannot reassign a referral that already has paid earnings. Reverse or adjust payouts first.",
      };
    }
  }

  const { error: updateReferralError } = await input.admin
    .from("partner_referrals")
    .update({
      partner_profile_id: input.newPartnerProfileId,
      source: "admin",
    })
    .eq("id", input.referralId);

  if (updateReferralError) return { error: updateReferralError.message };

  if (eventIds.length > 0) {
    const { error: eventError } = await input.admin
      .from("partner_attribution_events")
      .update({ partner_profile_id: input.newPartnerProfileId })
      .in("id", eventIds);
    if (eventError) return { error: eventError.message };

    const { error: earningError } = await input.admin
      .from("partner_earnings")
      .update({
        partner_profile_id: input.newPartnerProfileId,
        updated_at: new Date().toISOString(),
      })
      .in("attribution_event_id", eventIds)
      .neq("status", "paid");
    if (earningError) return { error: earningError.message };
  }

  const audit = await writePartnerAdminAudit(input.admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_referral",
    entityId: input.referralId,
    action: "correct_attribution",
    previousValue: {
      partner_profile_id: previousPartnerId,
      source: referral.source,
      status: referral.status,
    },
    newValue: {
      partner_profile_id: input.newPartnerProfileId,
      source: "admin",
    },
    reason,
  });

  if (audit.error) return { error: audit.error };
  return {};
}

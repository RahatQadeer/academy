import type { SupabaseClient } from "@supabase/supabase-js";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type CorrectOpportunityAttributionInput = {
  admin: SupabaseClient;
  actorUserId: string | null;
  opportunityId: string;
  newPartnerProfileId: string;
  reason: string;
};

export async function correctOpportunityAttribution(
  input: CorrectOpportunityAttributionInput,
): Promise<{ error?: string }> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    return { error: "A reason is required for attribution correction." };
  }

  const { data: opportunity, error: loadError } = await input.admin
    .from("partner_opportunities")
    .select("id, partner_profile_id, status")
    .eq("id", input.opportunityId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!opportunity) return { error: "Opportunity not found." };

  const previousPartnerId = opportunity.partner_profile_id as string;
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
    .select("id, external_payment_id")
    .eq("opportunity_id", input.opportunityId);
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
          "Cannot reassign an opportunity that already has paid earnings. Reverse or adjust payouts first.",
      };
    }

    const paymentIds = (events ?? [])
      .map((event) => event.external_payment_id as string | null)
      .filter((id): id is string => Boolean(id));

    if (paymentIds.length > 0) {
      const { data: collisions } = await input.admin
        .from("partner_attribution_events")
        .select("id")
        .eq("partner_profile_id", input.newPartnerProfileId)
        .in("external_payment_id", paymentIds)
        .limit(1);
      if ((collisions ?? []).length > 0) {
        return {
          error:
            "Target partner already has attribution for one of these payment ids. Resolve the duplicate before reassigning.",
        };
      }
    }
  }

  const { error: updateOppError } = await input.admin
    .from("partner_opportunities")
    .update({
      partner_profile_id: input.newPartnerProfileId,
    })
    .eq("id", input.opportunityId);

  if (updateOppError) return { error: updateOppError.message };

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
    entityType: "partner_opportunity",
    entityId: input.opportunityId,
    action: "correct_attribution",
    previousValue: {
      partner_profile_id: previousPartnerId,
      status: opportunity.status,
    },
    newValue: {
      partner_profile_id: input.newPartnerProfileId,
    },
    reason,
  });

  if (audit.error) return { error: audit.error };
  return {};
}

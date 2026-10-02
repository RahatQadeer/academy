import type { SupabaseClient } from "@supabase/supabase-js";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";
import { notifyPartnerOpportunityStatus } from "@/partner-center/lib/notifications/create-partner-notification";
import { loadEnterpriseProtectionRules } from "@/super-admin/partner-center/services/saveEnterpriseProtectionRules";

export type OpportunityAdminAction =
  | "accept"
  | "in_progress"
  | "converted"
  | "not_moving_forward";

function nextStatus(
  action: OpportunityAdminAction,
  current: string,
  acceptanceRequired: boolean,
): { status: string; error?: string; assignProtection?: boolean } {
  const key = current.toLowerCase();

  if (action === "accept") {
    if (key !== "submitted") {
      return { status: current, error: "Only submitted opportunities can be accepted." };
    }
    return { status: "accepted", assignProtection: true };
  }

  if (action === "in_progress") {
    if (key === "accepted") {
      return { status: "in_progress" };
    }
    if (!acceptanceRequired && key === "submitted") {
      return { status: "in_progress", assignProtection: true };
    }
    return {
      status: current,
      error: acceptanceRequired
        ? "Accept the opportunity before marking it in progress."
        : "Only submitted or accepted opportunities can move to in progress.",
    };
  }

  if (action === "converted") {
    if (key !== "accepted" && key !== "in_progress") {
      return {
        status: current,
        error: "Only accepted or in-progress opportunities can be marked converted.",
      };
    }
    return { status: "converted" };
  }

  if (action === "not_moving_forward") {
    if (key === "converted" || key === "not_moving_forward") {
      return { status: current, error: "This opportunity is already closed." };
    }
    return { status: "not_moving_forward" };
  }

  return { status: current, error: "Unknown action." };
}

export async function updateOpportunityStatus(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
  opportunityId: string;
  action: OpportunityAdminAction;
}): Promise<{ error?: string }> {
  const { admin, actorUserId, opportunityId, action } = input;

  const { data: row, error: loadError } = await admin
    .from("partner_opportunities")
    .select("id, status, partner_profile_id, accepted_at, protected_until")
    .eq("id", opportunityId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Opportunity not found." };

  const rules = await loadEnterpriseProtectionRules(admin);
  const currentStatus = row.status as string;
  const resolved = nextStatus(action, currentStatus, rules.acceptanceRequired);
  if (resolved.error) return { error: resolved.error };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: resolved.status,
  };

  if (resolved.assignProtection && !row.protected_until) {
    const protectedUntil = new Date();
    protectedUntil.setDate(
      protectedUntil.getDate() + rules.protectionPeriodDays,
    );
    patch.accepted_at = row.accepted_at ?? now;
    patch.protected_until = protectedUntil.toISOString();
  }

  const { error: updateError } = await admin
    .from("partner_opportunities")
    .update(patch)
    .eq("id", opportunityId);

  if (updateError) return { error: updateError.message };

  // Notify after status is persisted. Do not gate on audit — a failed audit
  // must not leave partners without an in-app opportunity update.
  const notifyResult = await notifyPartnerOpportunityStatus({
    admin,
    partnerProfileId: row.partner_profile_id as string,
    opportunityId,
    status: resolved.status,
  });
  if (!notifyResult.ok) {
    console.error(
      "[updateOpportunityStatus] partner notification failed",
      opportunityId,
      notifyResult.error,
    );
  }

  const audit = await writePartnerAdminAudit(admin, {
    actorUserId,
    entityType: "partner_opportunity",
    entityId: opportunityId,
    action: `opportunity_${action}`,
    previousValue: { status: currentStatus },
    newValue: patch,
  });

  if (audit.error) {
    console.error(
      "[updateOpportunityStatus] audit failed after status update",
      opportunityId,
      audit.error,
    );
    // Status (and notification) already applied — surface audit failure without
    // rolling back the partner-visible change.
    return { error: audit.error };
  }

  return {};
}

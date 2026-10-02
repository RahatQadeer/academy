import type { SupabaseClient } from "@supabase/supabase-js";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export async function extendOpportunityProtection(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
  opportunityId: string;
  protectedUntil: string;
  reason: string;
}): Promise<{ error?: string }> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    return { error: "A reason is required to extend protection." };
  }

  const untilMs = Date.parse(input.protectedUntil);
  if (Number.isNaN(untilMs)) {
    return { error: "Enter a valid protected-until date." };
  }
  if (untilMs <= Date.now()) {
    return { error: "Protected-until must be in the future." };
  }

  const { data: row, error: loadError } = await input.admin
    .from("partner_opportunities")
    .select("id, protected_until, accepted_at, status")
    .eq("id", input.opportunityId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Opportunity not found." };

  const currentUntil = row.protected_until
    ? Date.parse(row.protected_until as string)
    : NaN;
  if (!Number.isNaN(currentUntil) && untilMs <= currentUntil) {
    return {
      error: "Protected-until must be after the current protection end date.",
    };
  }

  const protectedUntil = new Date(untilMs).toISOString();
  const { error: updateError } = await input.admin
    .from("partner_opportunities")
    .update({ protected_until: protectedUntil })
    .eq("id", input.opportunityId);

  if (updateError) return { error: updateError.message };

  const audit = await writePartnerAdminAudit(input.admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_opportunity",
    entityId: input.opportunityId,
    action: "extend_protection",
    previousValue: {
      protected_until: row.protected_until,
      accepted_at: row.accepted_at,
      status: row.status,
    },
    newValue: { protected_until: protectedUntil },
    reason,
  });

  if (audit.error) return { error: audit.error };
  return {};
}

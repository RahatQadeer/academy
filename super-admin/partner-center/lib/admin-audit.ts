import type { SupabaseClient } from "@supabase/supabase-js";

export type PartnerAdminAuditInput = {
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
};

export async function writePartnerAdminAudit(
  admin: SupabaseClient,
  input: PartnerAdminAuditInput,
): Promise<{ error?: string }> {
  // No actor — refuse to write an audit row without a Super Admin session.
  if (!input.actorUserId) return {};

  const { error } = await admin.from("audit_log").insert({
    actor_user_id: input.actorUserId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    previous_value: input.previousValue ?? null,
    new_value: input.newValue ?? null,
    reason: input.reason ?? null,
  });

  if (error) {
    return { error: `Audit record could not be saved: ${error.message}` };
  }

  return {};
}

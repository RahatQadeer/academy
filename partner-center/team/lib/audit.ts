/**
 * Partner Center Company & Team audit helper.
 *
 * Fail-closed (SRS §9.4.1): if this insert fails, the calling action MUST
 * fail — never return success with a silent audit gap. Callers apply the
 * domain write first, then call writeTeamAudit; on failure they attempt a
 * compensating revert and always return an error.
 *
 * Uses the session Supabase client so actor_user_id = auth.uid() satisfies
 * audit_log_insert RLS (see 00003_base_rls.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { partnerFacingError } from "@/partner-center/lib/user-facing-error";

export type TeamAuditInput = {
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
};

export async function writeTeamAudit(
  supabase: SupabaseClient,
  input: TeamAuditInput,
): Promise<{ error?: string }> {
  const { error } = await supabase.from("audit_log").insert({
    actor_user_id: input.actorUserId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    previous_value: input.previousValue ?? null,
    new_value: input.newValue ?? null,
    reason: input.reason ?? null,
  });
  if (error) {
    return {
      error: partnerFacingError(
        "Could not finish saving. Try again.",
        error.message,
      ),
    };
  }
  return {};
}

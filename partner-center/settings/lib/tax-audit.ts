/**
 * Tax & payment audit helper (SRS §17.12.13).
 * Fail-closed: callers must fail the action if this insert fails.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TaxAuditInput = {
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
};

export async function writeTaxAudit(
  supabase: SupabaseClient,
  input: TaxAuditInput,
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
      error: `Audit record could not be saved: ${error.message}`,
    };
  }
  return {};
}

/** Audit preferred payout method changes and Issue Payout records (§17.13.6). */
export async function writePayoutMethodAudit(
  supabase: SupabaseClient,
  input: {
    actorUserId: string;
    entityId: string;
    previousMethod?: string | null;
    newMethod: string;
    reason?: string | null;
    extra?: Record<string, unknown>;
  },
): Promise<{ error?: string }> {
  return writeTaxAudit(supabase, {
    actorUserId: input.actorUserId,
    entityType: "partner_payout_method",
    entityId: input.entityId,
    action: "payout_method_changed",
    previousValue: { payout_method: input.previousMethod ?? null },
    newValue: {
      payout_method: input.newMethod,
      ...(input.extra ?? {}),
    },
    reason: input.reason ?? null,
  });
}

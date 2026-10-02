import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";

/** Soft account lifecycle on public.users (Ticket 6). */
export const ACADEMY_AUDIT_ENTITY_USER = "user";

/** Academy role membership grant / revoke / reactivate (Tickets 5 & 7). */
export const ACADEMY_AUDIT_ENTITY_MEMBERSHIP = "academy_membership";

/**
 * Cookie-backed Academy settings singleton (Ticket 8 / 9).
 * Fixed UUID so audit_log.entity_id stays a real uuid without a settings table.
 */
export const ACADEMY_AUDIT_ENTITY_SETTINGS = "academy_settings";
export const ACADEMY_SETTINGS_ENTITY_ID = "a0000000-0000-4000-8000-00000000acad";

export const ACADEMY_SENSITIVE_AUDIT_ENTITY_TYPES = [
  ACADEMY_AUDIT_ENTITY_USER,
  ACADEMY_AUDIT_ENTITY_MEMBERSHIP,
  ACADEMY_AUDIT_ENTITY_SETTINGS,
] as const;

export type AcademyAdminAuditInput = {
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
};

async function auditWriter(): Promise<SupabaseClient> {
  if (isSupabaseAdminConfigured()) return createAdminClient();
  return createClient();
}

/**
 * Best-effort write into shared public.audit_log.
 * Call after the privileged decision succeeds; never undo the decision if this fails.
 */
export async function writeAcademyAdminAudit(
  input: AcademyAdminAuditInput,
  client?: SupabaseClient,
): Promise<boolean> {
  try {
    if (!input.actorUserId) return false;
    const writer = client ?? (await auditWriter());
    const { error } = await writer.from("audit_log").insert({
      actor_user_id: input.actorUserId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      previous_value: input.previousValue ?? null,
      new_value: input.newValue ?? null,
      reason: input.reason ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

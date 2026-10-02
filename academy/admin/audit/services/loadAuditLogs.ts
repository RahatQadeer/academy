import "server-only";

import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { getSessionProfile } from "@/base/identity/session";
import { canPerform } from "@/academy/lib/capabilities";
import {
  ACADEMY_AUDIT_ENTITY_MEMBERSHIP,
  ACADEMY_AUDIT_ENTITY_SETTINGS,
  ACADEMY_AUDIT_ENTITY_USER,
  ACADEMY_SENSITIVE_AUDIT_ENTITY_TYPES,
  ACADEMY_SETTINGS_ENTITY_ID,
} from "@/academy/lib/adminAudit";
import { UUID } from "@/academy/admin/types";
import { AUDIT_LOG_PAGE_SIZE, type AcademyAuditLogItem, type LoadAuditLogsResult } from "../types";

type AuditRow = {
  id: string;
  actor_user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

const USER_SENSITIVE_ACTIONS = new Set([
  "suspend",
  "soft_delete",
  "restore",
  "restore_deleted",
]);

function displayName(row: IdentityRow | undefined, userId: string) {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `User ${userId.slice(0, 8)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isSensitiveRow(row: AuditRow) {
  if (row.entity_type === ACADEMY_AUDIT_ENTITY_MEMBERSHIP) return true;
  if (row.entity_type === ACADEMY_AUDIT_ENTITY_SETTINGS) return true;
  if (row.entity_type === ACADEMY_AUDIT_ENTITY_USER) {
    return USER_SENSITIVE_ACTIONS.has(row.action);
  }
  return false;
}

/**
 * Super-Admin-only read of sensitive Academy audit rows from shared audit_log.
 * Uses service role because base RLS only shows own / shared-workspace actors.
 */
export async function loadAuditLogs(): Promise<LoadAuditLogsResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const allowed = await canPerform(actor, "audit_logs.view");
    if (!allowed) return { ok: false, reason: "unauthorized" };

    if (!isSupabaseAdminConfigured()) {
      return {
        ok: false,
        reason: "unavailable",
        message: "Audit logs are not configured on this environment.",
      };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("audit_log")
      .select(
        "id, actor_user_id, entity_type, entity_id, action, previous_value, new_value, reason, created_at",
      )
      .in("entity_type", [...ACADEMY_SENSITIVE_AUDIT_ENTITY_TYPES])
      .order("created_at", { ascending: false })
      .limit(AUDIT_LOG_PAGE_SIZE + 1);

    if (error) return { ok: false, reason: "failed", message: "Audit logs could not be loaded." };

    const rows = ((data ?? []) as AuditRow[]).filter(isSensitiveRow);
    const truncated = rows.length > AUDIT_LOG_PAGE_SIZE;
    const page = rows.slice(0, AUDIT_LOG_PAGE_SIZE);

    const identityIds = new Set<string>();
    for (const row of page) {
      if (UUID.test(row.actor_user_id)) identityIds.add(row.actor_user_id);
      if (
        row.entity_type !== ACADEMY_AUDIT_ENTITY_SETTINGS &&
        UUID.test(row.entity_id) &&
        row.entity_id.toLowerCase() !== ACADEMY_SETTINGS_ENTITY_ID
      ) {
        identityIds.add(row.entity_id);
      }
    }

    const names = new Map<string, IdentityRow>();
    if (identityIds.size > 0) {
      // Direct users read — service role has no auth.uid() for academy_admin_user_identities.
      const { data: identityRows, error: identityError } = await admin
        .from("users")
        .select("id, preferred_name, full_name, email")
        .in("id", [...identityIds]);
      if (!identityError) {
        for (const row of (identityRows ?? []) as IdentityRow[]) {
          names.set(row.id.toLowerCase(), row);
        }
      }
    }

    const items: AcademyAuditLogItem[] = page.map((row) => {
      const actorKey = row.actor_user_id.toLowerCase();
      const actorIdentity = names.get(actorKey);
      const isSettings = row.entity_type === ACADEMY_AUDIT_ENTITY_SETTINGS;
      const targetIdentity = isSettings ? undefined : names.get(row.entity_id.toLowerCase());

      return {
        id: row.id,
        actorUserId: row.actor_user_id,
        actorDisplayName: displayName(actorIdentity, row.actor_user_id),
        actorEmail: actorIdentity?.email?.trim() || null,
        entityType: row.entity_type,
        entityId: row.entity_id,
        targetDisplayName: isSettings
          ? "Academy settings"
          : targetIdentity
            ? displayName(targetIdentity, row.entity_id)
            : UUID.test(row.entity_id)
              ? displayName(undefined, row.entity_id)
              : null,
        targetEmail: isSettings ? null : targetIdentity?.email?.trim() || null,
        action: row.action,
        previousValue: asRecord(row.previous_value),
        newValue: asRecord(row.new_value),
        reason: row.reason,
        createdAt: row.created_at,
      };
    });

    return { ok: true, data: { items, truncated } };
  } catch {
    return { ok: false, reason: "failed", message: "Audit logs could not be loaded." };
  }
}

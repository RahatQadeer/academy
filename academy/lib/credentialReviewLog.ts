import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";

export const CREDENTIAL_AUDIT_ENTITY = "academy_credential";

export type CredentialReviewAction = "award" | "return" | "request" | "renew";

/** Award/return notes shown on review screens — never "request". */
export type CredentialReviewNote = {
  action: "award" | "return";
  notes: string;
  at: string;
};

type AuditRow = {
  action: string;
  reason: string | null;
  created_at: string;
};

function asAction(value: string): CredentialReviewAction | null {
  if (value === "award" || value === "return" || value === "request" || value === "renew") {
    return value;
  }
  return null;
}

async function auditClient() {
  if (isSupabaseAdminConfigured()) return createAdminClient();
  return createClient();
}

export async function writeCredentialReviewLog(input: {
  credentialId: string;
  actorUserId: string | null;
  action: CredentialReviewAction;
  notes: string;
  previousStatus?: string;
  nextStatus?: string;
}): Promise<boolean> {
  try {
    const notes = input.notes.trim();
    const client = await auditClient();
    const { error } = await client.from("audit_log").insert({
      actor_user_id: input.actorUserId,
      entity_type: CREDENTIAL_AUDIT_ENTITY,
      entity_id: input.credentialId,
      action: input.action,
      reason: notes || null,
      previous_value: { status: input.previousStatus ?? "credential_review" },
      new_value: {
        status:
          input.nextStatus ??
          (input.action === "award"
            ? "awarded"
            : input.action === "return"
              ? "applied_work"
              : "credential_review"),
        ...(input.action === "request" ? { requested: true } : {}),
      },
    });
    return !error;
  } catch {
    // Decision already saved. Missing the log must not undo award or return.
    return false;
  }
}

export async function loadLatestCredentialReviewNote(
  credentialId: string,
): Promise<CredentialReviewNote | null> {
  const client = await auditClient();
  const { data } = await client
    .from("audit_log")
    .select("action, reason, created_at")
    .eq("entity_type", CREDENTIAL_AUDIT_ENTITY)
    .eq("entity_id", credentialId)
    .in("action", ["award", "return"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as AuditRow | null;
  if (!row) return null;
  const action = asAction(row.action);
  const notes = (row.reason || "").trim();
  if ((action !== "award" && action !== "return") || !notes) return null;
  return { action, notes, at: row.created_at };
}

/** Most recent learner certificate request for this credential, if any. */
export async function loadLatestCertificateRequestAt(
  credentialId: string,
): Promise<string | null> {
  try {
    const client = await auditClient();
    const { data } = await client
      .from("audit_log")
      .select("created_at")
      .eq("entity_type", CREDENTIAL_AUDIT_ENTITY)
      .eq("entity_id", credentialId)
      .eq("action", "request")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = data as { created_at: string } | null;
    return row?.created_at ?? null;
  } catch {
    return null;
  }
}

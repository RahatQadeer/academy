import "server-only";

import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { releasedEmailForDeletedAccount } from "@/base/lib/email";

/**
 * Permanent close: keeps enrollments, credentials, and other FKs on this user id.
 * Rewrites the stored email so the original address can register a new identity.
 * Does not hard-delete auth.users (that would cascade-wipe public.users).
 *
 * Email is released only here — never because a client says the account was deleted.
 */
export async function permanentlyReleaseAccountEmail(userId: string): Promise<
  | { ok: true; releasedEmail: string }
  | { ok: false; reason: "unavailable" | "failed"; message: string }
> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "unavailable", message: "Account close is not configured." };
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("users")
    .select("id, email, status")
    .eq("id", userId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, reason: "failed", message: "That account could not be closed." };
  }

  const released = releasedEmailForDeletedAccount(row.id, row.email);

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email: released,
    ban_duration: "none",
  });
  if (authError) {
    return { ok: false, reason: "failed", message: "That account could not be closed." };
  }

  const { error: updateError } = await admin
    .from("users")
    .update({
      email: released,
      status: "deleted",
    })
    .eq("id", userId);

  if (updateError) {
    return { ok: false, reason: "failed", message: "That account could not be closed." };
  }

  try {
    await admin.auth.admin.signOut(userId, "global");
  } catch {
    // Session invalidation is best-effort; credentials are already rewritten.
  }

  return { ok: true, releasedEmail: released };
}

import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { applyCredentialRenewalTerm } from "@/academy/lib/credentialRenewal/applyRenewalTerm";
import { isCredentialRenewalOpen } from "@/academy/lib/credentialRenewal/eligibility";
import { writeCredentialReviewLog } from "@/academy/lib/credentialReviewLog";
import { formatCredentialDate } from "../lib/format";
import { UUID } from "../../types";
import type { AwardCredentialResult } from "../types";

/**
 * Extend an awarded timed credential by 3 years — only on/after the expiration day.
 */
export async function renewCredential(
  credentialIdRaw: string,
  notesRaw?: string,
): Promise<AwardCredentialResult> {
  const credentialId = credentialIdRaw.trim().toLowerCase();
  if (!UUID.test(credentialId)) {
    return { ok: false, reason: "not_found", message: "This credential could not be found." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, reason: "unauthorized", message: "This area is limited to Academy Admins." };
    }
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) {
      return { ok: false, reason: "unauthorized", message: "This area is limited to Academy Admins." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_credentials")
      .select("id, type, status, expires_at")
      .eq("id", credentialId)
      .maybeSingle();
    if (error) {
      return { ok: false, reason: "failed", message: "This credential could not be renewed." };
    }

    const row = data as {
      id: string;
      type: string;
      status: string;
      expires_at: string | null;
    } | null;
    if (!row || row.status !== "awarded") {
      return {
        ok: false,
        reason: row ? "invalid" : "not_found",
        message: row
          ? "Only awarded credentials can be renewed."
          : "This credential could not be found.",
      };
    }
    if (!row.expires_at) {
      return {
        ok: false,
        reason: "invalid",
        message: "This credential does not expire, so it cannot be renewed.",
      };
    }
    if (!isCredentialRenewalOpen(row.expires_at)) {
      return {
        ok: false,
        reason: "invalid",
        message: `Renewal opens on ${formatCredentialDate(row.expires_at)}. Early renewal is not allowed.`,
      };
    }

    const applied = await applyCredentialRenewalTerm({
      supabase: supabase as never,
      credentialId,
      currentExpiresAt: row.expires_at,
    });
    if (!applied.ok) {
      return { ok: false, reason: "failed", message: applied.message };
    }

    await writeCredentialReviewLog({
      credentialId,
      actorUserId: profile.user.id,
      action: "renew",
      notes: notesRaw?.trim() || "Renewed for a new 3-year term.",
      previousStatus: "awarded",
      nextStatus: "awarded",
    });

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "This credential could not be renewed." };
  }
}

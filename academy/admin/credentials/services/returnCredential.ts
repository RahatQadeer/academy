import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { isAcademyCredentialStatus } from "@/academy/credentials/utils/labels";
import { UUID } from "../../types";
import { REVIEW_NOTES_MAX } from "../types";
import type { ReturnCredentialResult } from "../types";
import { writeCredentialReviewLog } from "@/academy/lib/credentialReviewLog";

export async function returnCredential(
  credentialIdRaw: string,
  notesRaw: string,
): Promise<ReturnCredentialResult> {
  const credentialId = credentialIdRaw.trim().toLowerCase();
  if (!UUID.test(credentialId)) return { ok: false, reason: "not_found", message: "This credential could not be found." };
  const notes = notesRaw.trim();
  if (!notes) {
    return {
      ok: false,
      reason: "invalid",
      message: "Tell the learner what to change before sending this back.",
    };
  }
  if (notes.length > REVIEW_NOTES_MAX) {
    return { ok: false, reason: "invalid", message: "That note is too long." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized", message: "This area is limited to Academy Admins." };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) {
      return { ok: false, reason: "unauthorized", message: "This area is limited to Academy Admins." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_credentials")
      .select("id, status")
      .eq("id", credentialId)
      .maybeSingle();
    if (error) return { ok: false, reason: "failed", message: "This credential could not be returned." };

    const row = data as { id: string; status: string } | null;
    if (!row || !isAcademyCredentialStatus(row.status)) {
      return { ok: false, reason: "not_found", message: "This credential could not be found." };
    }
    if (row.status !== "credential_review") {
      return {
        ok: false,
        reason: "invalid",
        message: "Only credentials in Credential Review can be sent back.",
      };
    }

    const { error: updateError } = await supabase
      .from("academy_credentials")
      .update({
        status: "applied_work",
        awarded_at: null,
        expires_at: null,
        certificate_requested_at: null,
      })
      .eq("id", credentialId);
    if (updateError) return { ok: false, reason: "failed", message: "This credential could not be returned." };
    await writeCredentialReviewLog({
      credentialId,
      actorUserId: profile.user.id,
      action: "return",
      notes,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "This credential could not be returned." };
  }
}

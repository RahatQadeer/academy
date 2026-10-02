import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessLearnerArea } from "@/academy/lib/authorization";
import { notifyAdminsOfRenewalRequest } from "@/academy/lib/credentialRenewal/notify";
import { isCredentialRenewalOpen } from "@/academy/lib/credentialRenewal/eligibility";
import { formatCredentialDate } from "@/academy/credentials/utils/labels";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RequestCredentialRenewalResult =
  | { ok: true; renewalRequestId: string }
  | { ok: false; reason: "unauthorized" | "not_found" | "invalid" | "failed"; message: string };

export async function requestCredentialRenewal(
  credentialIdRaw: string,
  messageRaw?: string,
): Promise<RequestCredentialRenewalResult> {
  const credentialId = credentialIdRaw.trim().toLowerCase();
  if (!UUID.test(credentialId)) {
    return { ok: false, reason: "not_found", message: "This certificate could not be found." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, reason: "unauthorized", message: "Sign in to request renewal." };
    }
    if (!(await canAccessLearnerArea({ id: profile.user.id }))) {
      return { ok: false, reason: "unauthorized", message: "Learner access is required." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_credentials")
      .select("id, user_id, status, expires_at, program_id, academy_programs ( name )")
      .eq("id", credentialId)
      .maybeSingle();

    if (error) {
      return { ok: false, reason: "failed", message: "The renewal request could not be created." };
    }

    const row = data as {
      id: string;
      user_id: string;
      status: string;
      expires_at: string | null;
      program_id: string;
      academy_programs: { name: string | null } | { name: string | null }[] | null;
    } | null;

    if (!row || row.user_id !== profile.user.id) {
      return { ok: false, reason: "not_found", message: "This certificate could not be found." };
    }
    if (row.status !== "awarded") {
      return {
        ok: false,
        reason: "invalid",
        message: "Only awarded certificates can be renewed.",
      };
    }
    if (!row.expires_at) {
      return {
        ok: false,
        reason: "invalid",
        message: "This certificate does not expire, so renewal is not required.",
      };
    }

    const { data: openRow } = await supabase
      .from("academy_credential_renewal_requests")
      .select("id, status")
      .eq("credential_id", credentialId)
      .in("status", [
        "pending_admin",
        "awaiting_form",
        "awaiting_payment",
        "awaiting_form_and_payment",
        "under_review",
      ])
      .maybeSingle();

    if (openRow) {
      return {
        ok: true,
        renewalRequestId: (openRow as { id: string }).id,
      };
    }

    if (!isCredentialRenewalOpen(row.expires_at)) {
      return {
        ok: false,
        reason: "invalid",
        message: `Renewal opens on ${formatCredentialDate(row.expires_at)}. You can request renewal on or after that day.`,
      };
    }

    const learnerMessage = messageRaw?.trim().slice(0, 2000) || null;
    const { data: created, error: insertError } = await supabase
      .from("academy_credential_renewal_requests")
      .insert({
        credential_id: credentialId,
        learner_user_id: profile.user.id,
        status: "pending_admin",
        expires_at_snapshot: row.expires_at,
        learner_message: learnerMessage,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !created) {
      return { ok: false, reason: "failed", message: "The renewal request could not be created." };
    }

    await supabase
      .from("academy_credentials")
      .update({ renewal_status: "pending_renewal" })
      .eq("id", credentialId);

    const program = Array.isArray(row.academy_programs)
      ? row.academy_programs[0]
      : row.academy_programs;
    const programName = program?.name?.trim() || "Academy program";
    const learnerName =
      profile.user.full_name?.trim() ||
      profile.user.preferred_name?.trim() ||
      profile.user.email?.trim() ||
      "Learner";

    await notifyAdminsOfRenewalRequest({
      renewalRequestId: (created as { id: string }).id,
      credentialId,
      learnerName,
      programName,
    });

    return { ok: true, renewalRequestId: (created as { id: string }).id };
  } catch {
    return { ok: false, reason: "failed", message: "The renewal request could not be created." };
  }
}

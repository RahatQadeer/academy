import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { isAcademyCredentialStatus, isAcademyCredentialType } from "../utils/labels";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RequestCertificateResult =
  | { ok: true; alreadyRequested: boolean; requestedAt: string | null }
  | { ok: false; message: string };

/**
 * Learner requests certificate issuance after all course requirements are met.
 * Persists certificate_requested_at via academy_request_certificate RPC.
 */
export async function requestCertificate(
  credentialIdRaw: string,
): Promise<RequestCertificateResult> {
  const credentialId = credentialIdRaw.trim().toLowerCase();
  if (!UUID.test(credentialId)) {
    return { ok: false, message: "This certificate could not be found." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, message: "Sign in to request your certificate." };
    }

    const supabase = await createClient();

    const { data: existing, error: loadError } = await supabase
      .from("academy_credentials")
      .select("id, user_id, type, status, certificate_requested_at")
      .eq("id", credentialId)
      .maybeSingle();

    if (loadError) {
      return { ok: false, message: "Your request could not be submitted. Try again." };
    }

    const row = existing as {
      id: string;
      user_id: string;
      type: string;
      status: string;
      certificate_requested_at: string | null;
    } | null;

    if (!row || !isAcademyCredentialType(row.type) || !isAcademyCredentialStatus(row.status)) {
      return { ok: false, message: "This certificate could not be found." };
    }
    if (row.user_id !== profile.user.id) {
      return { ok: false, message: "This certificate could not be found." };
    }
    if (row.status === "awarded") {
      return { ok: false, message: "This certificate has already been issued." };
    }
    if (row.certificate_requested_at) {
      return {
        ok: true,
        alreadyRequested: true,
        requestedAt: row.certificate_requested_at,
      };
    }

    const { data, error } = await supabase.rpc("academy_request_certificate", {
      p_credential_id: credentialId,
    });

    if (error) {
      return { ok: false, message: "Your request could not be submitted. Try again." };
    }

    const payload = data as {
      status?: string;
      reason?: string;
      already_requested?: boolean;
      requested_at?: string | null;
    } | null;

    if (payload?.status !== "ok") {
      if (payload?.reason === "assignments_pending" || payload?.reason === "not_ready") {
        return {
          ok: false,
          message:
            "Finish all lessons and wait until every assignment is reviewed before requesting your certificate.",
        };
      }
      if (payload?.reason === "already_awarded") {
        return { ok: false, message: "This certificate has already been issued." };
      }
      return { ok: false, message: "Your request could not be submitted. Try again." };
    }

    return {
      ok: true,
      alreadyRequested: Boolean(payload.already_requested),
      requestedAt: payload.requested_at ?? null,
    };
  } catch {
    return { ok: false, message: "Your request could not be submitted. Try again." };
  }
}

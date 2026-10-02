import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { isAcademyCredentialStatus, isAcademyCredentialType } from "@/academy/credentials/utils/labels";
import {
  coerceCredentialValidity,
  credentialTypeForProgram,
  normalizeLegacyProgramType,
} from "@/academy/lib/courseMetadata";
import type { AcademyProgramType } from "@/academy/lib/domain";
import { UUID } from "../../types";
import { expiryFromAward } from "../lib/format";
import type { AwardCredentialResult } from "../types";
import { writeCredentialReviewLog } from "@/academy/lib/credentialReviewLog";

export async function awardCredential(
  credentialIdRaw: string,
  notesRaw?: string,
): Promise<AwardCredentialResult> {
  const credentialId = credentialIdRaw.trim().toLowerCase();
  if (!UUID.test(credentialId)) return { ok: false, reason: "not_found", message: "This credential could not be found." };

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
      .select(
        "id, type, status, program_id, certificate_number, academy_programs ( type, recognition, credential_validity )",
      )
      .eq("id", credentialId)
      .maybeSingle();
    if (error) return { ok: false, reason: "failed", message: "This credential could not be awarded." };

    const row = data as {
      id: string;
      type: string;
      status: string;
      program_id: string;
      certificate_number: string | null;
      academy_programs:
        | {
            type: string | null;
            recognition: string | null;
            credential_validity: string | null;
          }
        | {
            type: string | null;
            recognition: string | null;
            credential_validity: string | null;
          }[]
        | null;
    } | null;
    if (!row || !isAcademyCredentialType(row.type) || !isAcademyCredentialStatus(row.status)) {
      return { ok: false, reason: "not_found", message: "This credential could not be found." };
    }
    if (row.status === "awarded") return { ok: true };
    if (row.status !== "credential_review") {
      return {
        ok: false,
        reason: "invalid",
        message: "Only credentials in Credential Review can be awarded.",
      };
    }

    const { data: readyRaw, error: readyError } = await supabase.rpc(
      "academy_credential_assignments_ready",
      { p_credential_id: credentialId },
    );
    if (readyError) return { ok: false, reason: "failed", message: "This credential could not be awarded." };
    if (readyRaw !== true) {
      return {
        ok: false,
        reason: "invalid",
        message: "All required assignments must be reviewed and graded before this certificate can be awarded.",
      };
    }

    const programMeta = Array.isArray(row.academy_programs)
      ? row.academy_programs[0]
      : row.academy_programs;
    const programType = normalizeLegacyProgramType(
      String(programMeta?.type ?? "course"),
    ) as AcademyProgramType;
    const recognition = programMeta?.recognition;
    const awardType = credentialTypeForProgram(recognition, programType);

    const validity = coerceCredentialValidity(
      programMeta?.credential_validity,
      programType,
      recognition,
    );
    const expires = validity === "three_years";

    const awardedAt = new Date();
    const expiresAt = expires ? expiryFromAward(awardedAt) : null;

    let certificateNumber = row.certificate_number;
    if (!certificateNumber) {
      const { data: allocated, error: allocError } = await supabase.rpc(
        "academy_next_certificate_number",
      );
      if (allocError || typeof allocated !== "string" || !/^[0-9]{7}$/.test(allocated)) {
        return { ok: false, reason: "failed", message: "This credential could not be awarded." };
      }
      certificateNumber = allocated;
    }

    const { error: updateError } = await supabase
      .from("academy_credentials")
      .update({
        type: awardType,
        status: "awarded",
        awarded_at: awardedAt.toISOString(),
        expires_at: expiresAt,
        renewal_status: expires ? "active" : null,
        certificate_number: certificateNumber,
      })
      .eq("id", credentialId);
    if (updateError) return { ok: false, reason: "failed", message: "This credential could not be awarded." };
    await writeCredentialReviewLog({
      credentialId,
      actorUserId: profile.user.id,
      action: "award",
      notes: notesRaw ?? "",
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "This credential could not be awarded." };
  }
}

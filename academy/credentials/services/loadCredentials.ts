import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { isAcademyProgramType, type AcademyProgramType } from "@/academy/lib/domain";
import type { CredentialItem, CredentialsLoadResult } from "../types";
import { CREDENTIALS_LIMIT } from "../types";
import { isAcademyCredentialStatus, isAcademyCredentialType } from "../utils/labels";
import {
  isCertificateLockedByAssignments,
  parseAssignmentStats,
} from "@/academy/assignments/utils/eligibility";

type ProgramEmbed = {
  id: string;
  name: string;
  type: string;
};

type CredentialRow = {
  id: string;
  user_id: string;
  program_id: string;
  type: string;
  status: string;
  awarded_at: string | null;
  expires_at: string | null;
  renewal_status: string | null;
  academy_programs: ProgramEmbed | ProgramEmbed[] | null;
};

function asProgram(value: CredentialRow["academy_programs"]): ProgramEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadCredentials(userId: string): Promise<CredentialsLoadResult> {
  if (!userId) {
    return { ok: true, data: { items: [], truncated: false } };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_credentials")
      .select(
        "id, user_id, program_id, type, status, awarded_at, expires_at, renewal_status, academy_programs ( id, name, type )",
      )
      .eq("user_id", userId)
      .limit(CREDENTIALS_LIMIT + 1);

    if (error) return { ok: false };

    const rows = (data ?? []) as CredentialRow[];
    const truncated = rows.length > CREDENTIALS_LIMIT;
    const items: CredentialItem[] = [];

    for (const row of rows.slice(0, CREDENTIALS_LIMIT)) {
      if (row.user_id !== userId) continue;
      if (!isAcademyCredentialType(row.type) || !isAcademyCredentialStatus(row.status)) continue;
      const program = asProgram(row.academy_programs);
      const programType: AcademyProgramType | null =
        program && isAcademyProgramType(program.type) ? program.type : null;
      items.push({
        id: row.id,
        programId: row.program_id,
        programName: program?.name?.trim() || "Program",
        programType,
        type: row.type,
        status: row.status,
        awardedAt: row.awarded_at,
        expiresAt: row.expires_at,
        renewalStatus: row.renewal_status,
        assignmentTotal: 0,
        assignmentSubmitted: 0,
        assignmentReviewed: 0,
        certificateLocked: false,
      });
    }

    await Promise.all(
      items.map(async (item) => {
        const { data } = await supabase.rpc("academy_program_assignment_stats", {
          p_user_id: userId,
          p_program_id: item.programId,
          p_credential_id: item.id,
        });
        const stats = parseAssignmentStats(data);
        item.assignmentTotal = stats.total;
        item.assignmentSubmitted = stats.submitted;
        item.assignmentReviewed = stats.reviewed;
        item.certificateLocked =
          item.status !== "awarded" && isCertificateLockedByAssignments(stats);
      }),
    );

    items.sort((a, b) => {
      if (a.status === "awarded" && b.status !== "awarded") return 1;
      if (a.status !== "awarded" && b.status === "awarded") return -1;
      return (b.awardedAt ?? "").localeCompare(a.awardedAt ?? "");
    });

    return { ok: true, data: { items, truncated } };
  } catch {
    return { ok: false };
  }
}

import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { ACTIVE_ACADEMY_ENROLLMENT_STATUSES } from "@/academy/lib/domain";
import { UUID } from "@/academy/admin/types";
import {
  catalogProgramDeletionMessage,
  getCatalogProgramDeletionBlock,
  type DeleteAdminCatalogProgramResult,
} from "@/academy/admin/lib/programDeletion";

export type { DeleteAdminCatalogProgramResult };

const ACTIVE_STATUSES = [...ACTIVE_ACADEMY_ENROLLMENT_STATUSES];

export async function deleteAdminCatalogProgram(
  programId: string,
): Promise<DeleteAdminCatalogProgramResult> {
  try {
    if (!UUID.test(programId)) {
      return { ok: false, reason: "failed", message: "This program could not be found." };
    }

    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };

    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();

    const [
      { data: program },
      { data: enrollmentRows },
      { count: credentialCount },
      { count: workspaceCount },
    ] = await Promise.all([
      supabase.from("academy_programs").select("id, status").eq("id", programId).maybeSingle(),
      supabase.from("academy_enrollments").select("id, status").eq("program_id", programId),
      supabase
        .from("academy_credentials")
        .select("id", { count: "exact", head: true })
        .eq("program_id", programId),
      supabase
        .from("academy_training_workspaces")
        .select("id", { count: "exact", head: true })
        .eq("program_id", programId),
    ]);

    if (!program) {
      return { ok: false, reason: "failed", message: "This program could not be found." };
    }

    const enrollments = enrollmentRows ?? [];
    const enrollmentCount = enrollments.length;
    const activeEnrollmentCount = enrollments.filter((row) =>
      ACTIVE_STATUSES.includes(row.status as (typeof ACTIVE_STATUSES)[number]),
    ).length;

    const status =
      program.status === "published" || program.status === "pending_approval"
        ? program.status
        : "draft";

    const block = getCatalogProgramDeletionBlock({
      status,
      enrollmentCount,
      activeEnrollmentCount,
    });

    if (block) {
      return {
        ok: false,
        reason: block,
        message: catalogProgramDeletionMessage(block, activeEnrollmentCount),
        activeEnrollmentCount,
      };
    }

    if ((credentialCount ?? 0) > 0 || (workspaceCount ?? 0) > 0) {
      return {
        ok: false,
        reason: "learner_records",
        message: catalogProgramDeletionMessage("learner_records"),
      };
    }

    await supabase
      .from("academy_programs")
      .update({ prerequisite_program_id: null })
      .eq("prerequisite_program_id", programId);

    const { error } = await supabase.from("academy_programs").delete().eq("id", programId);
    if (error) {
      return {
        ok: false,
        reason: "failed",
        message: "The program could not be deleted. Related learner records may still be attached.",
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "The program could not be deleted." };
  }
}

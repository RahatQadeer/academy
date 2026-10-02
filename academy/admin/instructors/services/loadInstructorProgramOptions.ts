import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { isAcademyProgramType, type AcademyProgramStatus } from "@/academy/lib/domain";
import type { InstructorProgramOption } from "../types";
import { PROGRAM_LIMIT } from "../types";

const PROGRAM_STATUSES = new Set<AcademyProgramStatus>(["draft", "pending_approval", "published"]);

function asProgramStatus(value: string): AcademyProgramStatus | null {
  return PROGRAM_STATUSES.has(value as AcademyProgramStatus)
    ? (value as AcademyProgramStatus)
    : null;
}

export async function loadInstructorProgramOptions(): Promise<
  { ok: true; programs: InstructorProgramOption[] } | { ok: false; reason: "unauthorized" | "failed" }
> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_programs")
      .select("id, name, status, type")
      .order("name", { ascending: true })
      .limit(PROGRAM_LIMIT);

    if (error) return { ok: false, reason: "failed" };

    const programs: InstructorProgramOption[] = [];
    for (const row of data ?? []) {
      const status = asProgramStatus(row.status);
      if (!status || !isAcademyProgramType(row.type)) continue;
      programs.push({ id: row.id, name: row.name, status });
    }

    return { ok: true, programs };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

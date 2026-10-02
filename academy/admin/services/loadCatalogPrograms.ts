import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { ACTIVE_ACADEMY_ENROLLMENT_STATUSES } from "@/academy/lib/domain";
import type { CatalogProgram } from "../components/CatalogTable";
import { isGeneralBankProgram } from "@/academy/lib/questionBank/generalBankConstants";

type CatalogResult =
  | { ok: true; programs: CatalogProgram[] }
  | { ok: false; reason: "unauthorized" | "failed" };

type ProgramRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  category: string | null;
  updated_at: string | null;
  created_at: string | null;
};

// Formatted on the server so the client table renders a stable string
// (no server/client timezone drift during hydration).
function formatUpdated(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}

export async function loadCatalogPrograms(): Promise<CatalogResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };

    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();

    const { data: programs, error } = await supabase
      .from("academy_programs")
      .select("id, name, type, status, category, updated_at, created_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) return { ok: false, reason: "failed" };

    const rows = ((programs ?? []) as ProgramRow[]).filter((p) => !isGeneralBankProgram(p));
    const programIds = rows.map((p) => p.id);

    const enrollmentCounts: Record<string, number> = {};
    const activeEnrollmentCounts: Record<string, number> = {};
    if (programIds.length > 0) {
      const { data: enrollments } = await supabase
        .from("academy_enrollments")
        .select("program_id, status")
        .in("program_id", programIds);

      for (const e of enrollments ?? []) {
        enrollmentCounts[e.program_id] = (enrollmentCounts[e.program_id] ?? 0) + 1;
        if (ACTIVE_ACADEMY_ENROLLMENT_STATUSES.includes(e.status as (typeof ACTIVE_ACADEMY_ENROLLMENT_STATUSES)[number])) {
          activeEnrollmentCounts[e.program_id] = (activeEnrollmentCounts[e.program_id] ?? 0) + 1;
        }
      }
    }

    return {
      ok: true,
      programs: rows.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        enrollmentCount: enrollmentCounts[p.id] ?? 0,
        activeEnrollmentCount: activeEnrollmentCounts[p.id] ?? 0,
        status: p.status as CatalogProgram["status"],
        updatedLabel: formatUpdated(p.updated_at ?? p.created_at),
      })),
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import type { InstructorModuleOption } from "../types";
import { UUID } from "../../types";

export async function loadProgramModules(
  programIdRaw: string,
): Promise<{ ok: true; modules: InstructorModuleOption[] } | { ok: false }> {
  const programId = programIdRaw.trim().toLowerCase();
  if (!UUID.test(programId)) return { ok: false };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_modules")
      .select("id, title, sort_order")
      .eq("program_id", programId)
      .order("sort_order", { ascending: true });
    if (error) return { ok: false };

    return {
      ok: true,
      modules: (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        sortOrder: row.sort_order ?? 0,
      })),
    };
  } catch {
    return { ok: false };
  }
}

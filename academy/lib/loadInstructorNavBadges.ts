import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessInstructorArea } from "@/academy/lib/authorization";
import type { AcademyNavBadges } from "./navTypes";

export async function loadInstructorNavBadges(): Promise<AcademyNavBadges | null> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return null;
    const actor = { id: profile.user.id };
    if (!(await canAccessInstructorArea(actor))) return null;

    const supabase = await createClient();
    const [{ data: assigned }, { data: created }] = await Promise.all([
      supabase
        .from("academy_instructor_assignments")
        .select("program_id")
        .eq("user_id", profile.user.id),
      supabase.from("academy_programs").select("id").eq("created_by_user_id", profile.user.id),
    ]);

    const programIds = [
      ...new Set([
        ...((assigned ?? []) as { program_id: string }[]).map((row) => row.program_id),
        ...((created ?? []) as { id: string }[]).map((row) => row.id),
      ]),
    ];
    if (programIds.length === 0) return {};

    const { count, error } = await supabase
      .from("academy_assignment_submissions")
      .select("id", { count: "exact", head: true })
      .in("program_id", programIds)
      .eq("status", "submitted");

    if (error) return null;
    const badges: AcademyNavBadges = {};
    if ((count ?? 0) > 0) badges.pendingReviews = count ?? 0;
    return badges;
  } catch {
    return null;
  }
}

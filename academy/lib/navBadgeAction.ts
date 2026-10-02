"use server";

import { loadAdminNavBadges } from "@/academy/lib/loadAdminNavBadges";
import { loadInstructorNavBadges } from "@/academy/lib/loadInstructorNavBadges";
import type { AcademyNavBadges } from "@/academy/lib/navTypes";
import type { AcademyRole } from "@/academy/lib/types";

export async function loadAcademyNavBadgesAction(
  context: AcademyRole,
): Promise<AcademyNavBadges | null> {
  if (context === "admin" || context === "super_admin") return loadAdminNavBadges();
  if (context === "instructor") return loadInstructorNavBadges();
  return null;
}

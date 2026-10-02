import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea } from "@/academy/lib/authorization";
import { ADMIN_NAV_SEEN_COOKIE, parseAdminNavSeen } from "./adminNavSeen";
import type { AcademyNavBadges } from "./navTypes";

export async function loadAdminNavBadges(): Promise<AcademyNavBadges | null> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return null;

    const actor = { id: profile.user.id };
    if (!(await canAccessAdminArea(actor))) return null;

    const [store, supabase] = await Promise.all([cookies(), createClient()]);
    const seen = parseAdminNavSeen(store.get(ADMIN_NAV_SEEN_COOKIE)?.value, profile.user.id);

    let enrollmentQuery = supabase
      .from("academy_enrollments")
      .select("id", { count: "exact", head: true });
    if (seen.enrollmentsSeenAt) {
      enrollmentQuery = enrollmentQuery.gt("enrolled_at", seen.enrollmentsSeenAt);
    }

    const [
      { count: pendingApprovals, error: pendingError },
      { count: enrollments, error: enrollmentError },
      { count: credentialReview, error: credentialError },
    ] = await Promise.all([
      supabase
        .from("academy_publish_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      enrollmentQuery,
      supabase
        .from("academy_credentials")
        .select("id", { count: "exact", head: true })
        .eq("status", "credential_review")
        .not("certificate_requested_at", "is", null),
    ]);

    if (pendingError || enrollmentError || credentialError) return null;

    const badges: AcademyNavBadges = {};
    if ((pendingApprovals ?? 0) > 0) badges.pendingApprovals = pendingApprovals ?? 0;
    if ((enrollments ?? 0) > 0) badges.enrollments = enrollments ?? 0;
    if ((credentialReview ?? 0) > 0) badges.credentialReview = credentialReview ?? 0;
    return badges;
  } catch {
    return null;
  }
}

import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import type { AcademyRole } from "@/academy/lib/types";
import type { InstructorGrantCandidate, InstructorMembershipStatus, UserSearchResult } from "../types";
import { USER_SEARCH_LIMIT, USER_SEARCH_MIN } from "../types";
import { UUID } from "../../types";

type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

type MembershipRow = { user_id: string; role: AcademyRole; status: string };

function sanitizeQuery(raw: string) {
  return raw
    .trim()
    .slice(0, 80)
    .replace(/[%_,"\\()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(row: IdentityRow) {
  const name = (row.preferred_name || row.full_name || "").trim();
  if (name) return name;
  return row.email?.trim() || `User ${row.id.slice(0, 8)}`;
}

export async function loadUsersForInstructorGrant(rawQuery: string): Promise<UserSearchResult> {
  const query = sanitizeQuery(rawQuery);
  if (query.length < USER_SEARCH_MIN) {
    return { ok: false, reason: "invalid", message: "Enter at least two characters to search." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("academy_search_users_for_instructor_grant", {
      p_query: query,
    });
    if (error) return { ok: false, reason: "failed", message: "Users could not be searched." };

    const rows = ((data ?? []) as IdentityRow[]).filter((row) => UUID.test(row.id)).slice(0, USER_SEARCH_LIMIT);
    const userIds = rows.map((row) => row.id);

    const instructorStatusByUser = new Map<string, InstructorMembershipStatus>();
    const conflictByUser = new Map<string, "learner" | "admin" | "super_admin">();

    if (userIds.length > 0) {
      const { data: memberships, error: membershipError } = await supabase
        .from("academy_memberships")
        .select("user_id, role, status")
        .in("user_id", userIds)
        .limit(userIds.length * 4);
      if (membershipError) return { ok: false, reason: "failed", message: "Users could not be searched." };

      for (const row of (memberships ?? []) as MembershipRow[]) {
        const key = row.user_id.toLowerCase();
        if (row.role === "instructor" && (row.status === "active" || row.status === "suspended")) {
          instructorStatusByUser.set(key, row.status);
        }
        if (
          row.status === "active" &&
          (row.role === "learner" || row.role === "admin" || row.role === "super_admin")
        ) {
          conflictByUser.set(key, row.role);
        }
      }
    }

    const users: InstructorGrantCandidate[] = rows.map((row) => {
      const key = row.id.toLowerCase();
      return {
        userId: row.id,
        displayName: displayName(row),
        email: row.email?.trim() || null,
        instructorStatus: instructorStatusByUser.get(key) ?? "none",
        conflictRole: conflictByUser.get(key) ?? null,
      };
    });

    return { ok: true, data: { query, users } };
  } catch {
    return { ok: false, reason: "failed", message: "Users could not be searched." };
  }
}

import "server-only";

import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { getSessionProfile } from "@/base/identity/session";
import { canPerform } from "@/academy/lib/capabilities";
import { UUID } from "@/academy/admin/types";
import type {
  ListManagedUsersInput,
  ListManagedUsersResult,
  ManagedAcademyRole,
  ManagedUser,
  ManagedUserStatus,
} from "../types";
import { USER_PAGE_SIZE } from "../types";

type UserRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
  status: string;
};

type MembershipRow = { user_id: string; role: string; status: string };

const ACADEMY_ROLES: ManagedAcademyRole[] = [
  "super_admin",
  "admin",
  "instructor",
  "learner",
];

function sanitizeQuery(raw: string) {
  return raw
    .trim()
    .slice(0, 80)
    .replace(/[%_,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asStatus(value: string): ManagedUserStatus | null {
  if (value === "active" || value === "suspended" || value === "deleted") return value;
  return null;
}

function pickAcademyRole(roles: string[]): ManagedAcademyRole | null {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("instructor")) return "instructor";
  if (roles.includes("learner")) return "learner";
  return null;
}

function displayName(row: UserRow) {
  const name = (row.preferred_name || row.full_name || "").trim();
  if (name) return name;
  return row.email?.trim() || `User ${row.id.slice(0, 8)}`;
}

function emptyResult(
  page: number,
  query: string,
  statusFilter: ManagedUserStatus | "all",
  roleFilter: ManagedAcademyRole | "all",
): ListManagedUsersResult {
  return {
    ok: true,
    data: {
      users: [],
      page: Math.max(1, page),
      pageSize: USER_PAGE_SIZE,
      total: 0,
      totalPages: 1,
      query,
      status: statusFilter,
      role: roleFilter,
    },
  };
}

/**
 * Paginated Academy user directory for Super Admins.
 * Only users with an active Academy membership (learner / instructor / admin / super_admin).
 */
export async function listManagedUsers(
  input: ListManagedUsersInput = {},
): Promise<ListManagedUsersResult> {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const query = sanitizeQuery(input.query ?? "");
  const statusFilter = input.status ?? "all";
  const roleFilter = input.role ?? "all";

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const allowed = await canPerform({ id: profile.user.id }, "users.view");
    if (!allowed) return { ok: false, reason: "unauthorized" };

    if (!isSupabaseAdminConfigured()) {
      return {
        ok: false,
        reason: "unavailable",
        message: "User management is not configured on this environment.",
      };
    }

    const admin = createAdminClient();
    const from = (page - 1) * USER_PAGE_SIZE;
    const to = from + USER_PAGE_SIZE - 1;

    let membershipQuery = admin
      .from("academy_memberships")
      .select("user_id")
      .eq("status", "active");

    if (roleFilter !== "all") {
      // Super Admin is singular — not offered as a Users filter.
      if (roleFilter === "super_admin" || !ACADEMY_ROLES.includes(roleFilter)) {
        return emptyResult(page, query, statusFilter, roleFilter);
      }
      membershipQuery = membershipQuery.eq("role", roleFilter);
    } else {
      membershipQuery = membershipQuery.in("role", ACADEMY_ROLES);
    }

    const { data: memberships, error: memError } = await membershipQuery;
    if (memError) {
      return { ok: false, reason: "failed", message: "Users could not be loaded." };
    }

    const academyUserIds = [
      ...new Set(
        ((memberships ?? []) as { user_id: string }[])
          .map((row) => row.user_id)
          .filter((id) => UUID.test(id)),
      ),
    ];

    if (academyUserIds.length === 0) {
      return emptyResult(page, query, statusFilter, roleFilter);
    }

    let request = admin
      .from("users")
      .select("id, preferred_name, full_name, email, status", { count: "exact" })
      .in("id", academyUserIds);

    if (statusFilter !== "all") {
      request = request.eq("status", statusFilter);
    }

    if (query) {
      const pattern = `%${query}%`;
      request = request.or(
        `email.ilike.${pattern},full_name.ilike.${pattern},preferred_name.ilike.${pattern}`,
      );
    }

    request = request.order("full_name", { ascending: true, nullsFirst: false }).range(from, to);

    const { data, error, count } = await request;
    if (error) {
      return { ok: false, reason: "failed", message: "Users could not be loaded." };
    }

    const rows = ((data ?? []) as UserRow[]).filter((row) => UUID.test(row.id));
    const total = count ?? rows.length;
    const totalPages = Math.max(1, Math.ceil(total / USER_PAGE_SIZE));

    const userIds = rows.map((row) => row.id);
    const rolesByUser = new Map<string, string[]>();
    if (userIds.length > 0) {
      const { data: roleRows } = await admin
        .from("academy_memberships")
        .select("user_id, role, status")
        .in("user_id", userIds)
        .eq("status", "active")
        .in("role", ACADEMY_ROLES);
      for (const row of (roleRows ?? []) as MembershipRow[]) {
        const key = row.user_id.toLowerCase();
        const list = rolesByUser.get(key) ?? [];
        list.push(row.role);
        rolesByUser.set(key, list);
      }
    }

    const users: ManagedUser[] = [];
    for (const row of rows) {
      const status = asStatus(row.status);
      if (!status) continue;
      const academyRole = pickAcademyRole(rolesByUser.get(row.id.toLowerCase()) ?? []);
      if (!academyRole) continue;
      users.push({
        userId: row.id,
        displayName: displayName(row),
        email: row.email?.trim() || null,
        status,
        academyRole,
        isAcademySuperAdmin: academyRole === "super_admin",
      });
    }

    return {
      ok: true,
      data: {
        users,
        page,
        pageSize: USER_PAGE_SIZE,
        total,
        totalPages,
        query,
        status: statusFilter,
        role: roleFilter,
      },
    };
  } catch {
    return { ok: false, reason: "failed", message: "Users could not be loaded." };
  }
}

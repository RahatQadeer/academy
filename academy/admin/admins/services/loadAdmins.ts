import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { adminInviteIsExpired } from "../lib/inviteExpiry";
import type {
  AcademyAdminListItem,
  AcademyAdminListResult,
  AcademyAdminMembershipStatus,
  PendingAdminInvite,
} from "../types";
import { ADMIN_LIMIT } from "../types";
import { UUID } from "../../types";
import { requireAcademySuperAdminActor } from "./requireSuperAdmin";

type MembershipRow = { user_id: string; status: string };
type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

function asStatus(value: string): AcademyAdminMembershipStatus | null {
  if (value === "active" || value === "suspended") return value;
  return null;
}

function displayName(row: IdentityRow | undefined, userId: string) {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `Admin ${userId.slice(0, 8)}`;
}

async function loadRoleSlice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  status: AcademyAdminMembershipStatus,
) {
  const { data: memberships, error } = await supabase
    .from("academy_memberships")
    .select("user_id, status")
    .eq("role", "admin")
    .eq("status", status)
    .order("granted_at", { ascending: false })
    .limit(ADMIN_LIMIT + 1);
  if (error) return { ok: false as const };
  const rows = ((memberships ?? []) as MembershipRow[]).filter((row) => UUID.test(row.user_id));
  return {
    ok: true as const,
    truncated: rows.length > ADMIN_LIMIT,
    rows: rows.slice(0, ADMIN_LIMIT),
  };
}

export async function loadAdmins(): Promise<AcademyAdminListResult> {
  try {
    const actor = await requireAcademySuperAdminActor();
    if (!actor.ok) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const [activeSlice, suspendedSlice, { count: activeCount, error: countError }] =
      await Promise.all([
        loadRoleSlice(supabase, "active"),
        loadRoleSlice(supabase, "suspended"),
        supabase
          .from("academy_memberships")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("status", "active"),
      ]);
    if (!activeSlice.ok || !suspendedSlice.ok || countError) {
      return { ok: false, reason: "failed" };
    }

    const userIds = [
      ...new Set([...activeSlice.rows, ...suspendedSlice.rows].map((row) => row.user_id)),
    ];
    const names = new Map<string, IdentityRow>();
    if (userIds.length > 0) {
      const { data: identityRows, error: identityError } = await supabase.rpc(
        "academy_admin_user_identities",
        { p_user_ids: userIds },
      );
      if (identityError) return { ok: false, reason: "failed" };
      for (const row of (identityRows ?? []) as IdentityRow[]) {
        names.set(row.id.toLowerCase(), row);
      }
    }

    function toItem(row: MembershipRow): AcademyAdminListItem | null {
      const status = asStatus(row.status);
      if (!status) return null;
      const identity = names.get(row.user_id.toLowerCase());
      return {
        userId: row.user_id,
        displayName: displayName(identity, row.user_id),
        email: identity?.email?.trim() || null,
        membershipStatus: status,
      };
    }

    const active = activeSlice.rows
      .map(toItem)
      .filter((item): item is AcademyAdminListItem => Boolean(item));
    const suspended = suspendedSlice.rows
      .map(toItem)
      .filter((item): item is AcademyAdminListItem => Boolean(item));

    const adminEmails = new Set(
      [...active, ...suspended]
        .map((item) => item.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );

    let pendingInvites: PendingAdminInvite[] = [];
    if (isSupabaseAdminConfigured()) {
      const admin = createAdminClient();
      const { data: inviteRows } = await admin
        .from("invitations")
        .select("id, invitee_email, invitee_name, expires_at, sent_at, status")
        .eq("context_type", "academy_admin")
        .in("status", ["pending", "expired"])
        .order("sent_at", { ascending: false })
        .limit(ADMIN_LIMIT);

      pendingInvites = ((inviteRows ?? []) as {
        id: string;
        invitee_email: string;
        invitee_name: string | null;
        expires_at: string | null;
        sent_at: string | null;
        status: string;
      }[])
        .filter((row) => !adminEmails.has(row.invitee_email.trim().toLowerCase()))
        .map((row) => {
          const email = row.invitee_email.trim().toLowerCase();
          const name = (row.invitee_name || "").trim();
          return {
            id: row.id,
            email,
            displayName: name || email,
            expiresAt: row.expires_at,
            sentAt: row.sent_at,
            expired: row.status === "expired" || adminInviteIsExpired(row.expires_at),
          };
        });
    }

    return {
      ok: true,
      data: {
        active,
        suspended,
        pendingInvites,
        activeCount: activeCount ?? 0,
        truncatedActive: activeSlice.truncated,
        truncatedSuspended: suspendedSlice.truncated,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

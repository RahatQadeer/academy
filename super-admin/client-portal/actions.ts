"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { getStaffSession } from "@/super-admin/lib/staff-session";
import { parseSeatLimit } from "@/base/lib/portal-seats";

type SeatLimitResult = { ok?: true; message?: string; error?: string };

/**
 * Set one workspace's portal seat limits.
 *
 * This is the only write path onto these two columns. A trigger in
 * supabase/00056 refuses the change from any role but the service role, so a
 * professional cannot reach them from Whitby even though RLS lets them update
 * the rest of their own workspace row.
 *
 * Blank Authorized Users means no limit; Additional Members has to be a number,
 * because the column is NOT NULL and "no limit on seats we sell" is not a state
 * the plan has.
 */
export async function setWorkspaceSeatLimits(input: {
  workspaceId: string;
  maxAdditionalMembers: string;
  maxAuthorizedUsers: string;
}): Promise<SeatLimitResult> {
  const session = await getStaffSession();
  if (!session?.email) {
    return { error: "Sign in as Super Admin to continue." };
  }

  if (!isSupabaseAdminConfigured()) {
    return { error: "Supabase admin is not configured." };
  }

  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) return { error: "No workspace to set limits on." };

  const additional = parseSeatLimit(input.maxAdditionalMembers, {
    blankAllowed: false,
  });
  if ("error" in additional) return { error: `Additional members: ${additional.error}` };

  const authorized = parseSeatLimit(input.maxAuthorizedUsers, {
    blankAllowed: true,
  });
  if ("error" in authorized) return { error: `Authorized users: ${authorized.error}` };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("workspaces")
    .update({
      max_additional_members: additional.value,
      max_authorized_users: authorized.value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "That workspace no longer exists." };

  revalidatePath("/super-admin/client-portal");

  return {
    ok: true,
    message:
      authorized.value === null
        ? `Saved. Each client account may now hold ${additional.value} additional members, with no limit on authorized users.`
        : `Saved. Each client account may now hold ${additional.value} additional members and ${authorized.value} authorized users.`,
  };
}

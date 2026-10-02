import "server-only";

import {
  createAdminClient,
  isSupabaseAdminConfigured,
} from "@/base/lib/supabase/admin";
import { DEFAULT_MAX_ADDITIONAL_MEMBERS } from "@/base/lib/portal-seats";

export type WorkspaceSeatRow = {
  id: string;
  name: string;
  slug: string;
  /** Additional Members each client account here may hold. Never null. */
  maxAdditionalMembers: number;
  /** Authorized Users each client account may hold. Null is no limit. */
  maxAuthorizedUsers: number | null;
  /** Client accounts in this workspace, so a number is set against something. */
  clientCount: number;
};

export type WorkspaceSeatsResult = {
  configured: boolean;
  error: string | null;
  items: WorkspaceSeatRow[];
};

/**
 * Every workspace, with the seat limits Super Admin sets on it.
 *
 * Read on the service role: `workspaces_select_member` (00003) scopes that
 * table to the members of each workspace, and staff are not members of any of
 * them — Super Admin is a cookie session against `super_admins`, not a product
 * login. This is the same reason Partner Center admin reads everything the
 * same way.
 */
export async function loadWorkspaceSeats(): Promise<WorkspaceSeatsResult> {
  if (!isSupabaseAdminConfigured()) {
    return { configured: false, error: null, items: [] };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("workspaces")
    .select("id, name, url_slug, max_additional_members, max_authorized_users")
    .order("name", { ascending: true });

  if (error) {
    // The columns arrive with supabase/00056. Until it is applied PostgREST
    // answers with a 400 and no rows, which would otherwise read as "no
    // workspaces exist" — a blank screen that says nothing about why.
    const missing = /max_additional_members|max_authorized_users/.test(error.message);
    return {
      configured: true,
      error: missing
        ? "This needs migration 00056_workspace_portal_limits.sql. Apply it, then reload."
        : error.message,
      items: [],
    };
  }

  const rows = data ?? [];

  // One grouped count rather than a query per workspace.
  const counts = await countClientsByWorkspace(
    admin,
    rows.map((row) => row.id as string),
  );

  return {
    configured: true,
    error: null,
    items: rows.map((row) => ({
      id: row.id as string,
      name: (row.name as string | null)?.trim() || "Untitled workspace",
      slug: (row.url_slug as string | null) ?? "",
      maxAdditionalMembers:
        typeof row.max_additional_members === "number"
          ? row.max_additional_members
          : DEFAULT_MAX_ADDITIONAL_MEMBERS,
      maxAuthorizedUsers: (row.max_authorized_users as number | null) ?? null,
      clientCount: counts.get(row.id as string) ?? 0,
    })),
  };
}

async function countClientsByWorkspace(
  admin: ReturnType<typeof createAdminClient>,
  workspaceIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (workspaceIds.length === 0) return counts;

  const { data } = await admin
    .from("whitbyos_clients")
    .select("workspace_id")
    .in("workspace_id", workspaceIds);

  for (const row of data ?? []) {
    const id = row.workspace_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

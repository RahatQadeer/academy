import { createClient } from "@/base/lib/supabase/server";
import { ACCESS_AREAS } from "@/whitbyos/lib/access-requests-vocab";

/** What the code ships with, for a workspace that has never set its own. */
export const BUILT_IN_PORTAL_AREAS: string[] = ACCESS_AREAS.filter(
  (area) => area.defaultOn,
).map((area) => area.key);

/**
 * Which portal areas a new person starts with, for one workspace.
 *
 * Read by both sides of the same decision: the professional's approval screen
 * and the client's own "add a person" modal. They used to be two hardcoded
 * lists that had already drifted apart — nothing fails when two constants
 * disagree about a default, it just means the tick a client asked for is not
 * the tick the professional is shown.
 *
 * Null in the column means the workspace has never chosen, which is not the
 * same as choosing none: it keeps the built-in list.
 */
export async function portalDefaultAreas(workspaceId: string | null): Promise<string[]> {
  if (!workspaceId) return BUILT_IN_PORTAL_AREAS;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_workspace_settings")
    .select("portal_default_areas")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const stored = data?.portal_default_areas;
  if (!Array.isArray(stored)) return BUILT_IN_PORTAL_AREAS;

  // Keys the product no longer knows are dropped rather than passed on: a
  // stale key writes a permission nothing reads.
  const known = new Set<string>(ACCESS_AREAS.map((area) => area.key));
  return stored.filter((key): key is string => typeof key === "string" && known.has(key));
}

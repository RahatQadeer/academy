import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";

/**
 * Is this workspace's Client Portal open?
 *
 * One question, asked in three places: where the portal works out who the
 * reader is, where its layout decides whether to let them stay, and on the
 * switch itself. Deduped per request, because closing a portal is a rare act
 * and reading the answer happens on every screen.
 *
 * Absence is openness: a workspace with no settings row has never closed
 * anything, and a missing row must not lock a client out of an account the
 * firm still holds.
 */
export const portalIsOpen = cache(async (workspaceId: string | null): Promise<boolean> => {
  if (!workspaceId) return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_workspace_settings")
    .select("portal_enabled")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data?.portal_enabled !== false;
});

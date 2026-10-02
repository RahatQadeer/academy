import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

/**
 * Whether this organization keeps a separate workspace per client.
 *
 * Default is yes: that is how Whitby already behaves, and a missing settings
 * row (or a database that has not received the column yet) must not hide
 * Clients from firms that have been using them.
 */
export const usesClientWorkspaces = cache(async (): Promise<boolean> => {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_workspace_settings")
    .select("uses_client_workspaces")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data?.uses_client_workspaces !== false;
});

export async function setUsesClientWorkspaces(enabled: boolean) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return;

  const supabase = await createClient();
  await supabase.from("whitbyos_workspace_settings").upsert(
    {
      workspace_id: workspaceId,
      uses_client_workspaces: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" },
  );
}

const FIRM_HOLDER = { firm_holder: true } as const;

/** The hidden organization row used while Client Workspaces are off. */
export function isHiddenFirmClient(row: {
  preferences?: unknown;
  primary_contact_id?: string | null;
  client_type?: string | null;
  classification?: string | null;
}): boolean {
  const prefs = row.preferences;
  if (prefs && typeof prefs === "object" && (prefs as { firm_holder?: boolean }).firm_holder) {
    return true;
  }
  // First No-mode pass wrote this row with no person and no classification.
  // A real client from Create Client Workspace always has a classification.
  return (
    row.client_type === "organization" &&
    !row.primary_contact_id &&
    !(row.classification ?? "").trim()
  );
}

/**
 * Requests, tasks and similar rows still need a client_id.
 *
 * When the firm is not using Client Workspaces, one hidden client named for
 * the organization holds that work. It is never shown in Clients or on the
 * workspace switcher, including after Client Workspaces are turned back on.
 */
export async function ensureFirmClientId(create = true): Promise<string | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("whitbyos_clients")
    .select("id, preferences, primary_contact_id, client_type, classification")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  const holder = (existing ?? []).find((row) => isHiddenFirmClient(row));
  if (holder?.id) {
    const prefs = holder.preferences;
    const flagged =
      prefs && typeof prefs === "object" && (prefs as { firm_holder?: boolean }).firm_holder;
    if (!flagged) {
      await supabase
        .from("whitbyos_clients")
        .update({
          preferences: {
            ...(prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>) : {}),
            ...FIRM_HOLDER,
          },
        })
        .eq("id", holder.id);
    }
    return holder.id as string;
  }

  if (!create) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name, owner_user_id")
    .eq("id", workspaceId)
    .maybeSingle();

  const ownerId = user?.id ?? (workspace?.owner_user_id as string | undefined);
  if (!ownerId) return null;

  const { data: client } = await supabase
    .from("whitbyos_clients")
    .insert({
      workspace_id: workspaceId,
      name: (workspace?.name as string) || "Organization",
      client_type: "organization",
      status: "active",
      owner_user_id: ownerId,
      preferences: FIRM_HOLDER,
    })
    .select("id")
    .single();

  return (client?.id as string) ?? null;
}

/** Use the posted client, or the hidden firm client when Client Workspaces are off. */
export async function resolveClientId(submitted: string): Promise<string | null> {
  const id = submitted.trim();
  if (id) return id;
  if (await usesClientWorkspaces()) return null;
  return ensureFirmClientId();
}

/** Nav items and settings tabs that only exist when Client Workspaces are on. */
export const CLIENT_NAV_HREFS = new Set(["/whitbyos/clients"]);
export const CLIENT_SETTINGS_TABS = new Set(["invoices"]);

export async function redirectIfNoClientWorkspaces(to = "/whitbyos") {
  if (!(await usesClientWorkspaces())) redirect(to);
}

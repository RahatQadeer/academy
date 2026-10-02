import { cache } from "react";
import { cookies } from "next/headers";
import { getSessionProfile } from "@/base/identity/session";

/** Which workspace the switcher last landed on. */
export const WORKSPACE_COOKIE = "pa_whitbyos_workspace";

/**
 * The workspace every Whitby query is scoped to.
 *
 * RLS already restricts rows to workspaces the user belongs to, but queries
 * still filter explicitly so a user in two workspaces sees one at a time —
 * and screen 1.1c lets them choose which. The cookie is only a preference:
 * it is checked against their actual memberships every time, so a stale or
 * tampered value falls back to the first workspace rather than reaching one
 * they are not in.
 */
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const profile = await getSessionProfile();
  const mine = profile?.workspaces ?? [];
  if (mine.length === 0) return null;

  const chosen = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  if (chosen && mine.some((workspace) => workspace.id === chosen)) return chosen;

  return mine[0]?.id ?? null;
}

/**
 * The workspace's own name — WP.22's letterhead, and WP.24's masthead.
 *
 * Free, as queries go: the session profile already carries the full workspace
 * rows, so this reads one that has been fetched rather than fetching it again.
 */
export async function getCurrentWorkspaceName(): Promise<string> {
  const profile = await getSessionProfile();
  const id = await getCurrentWorkspaceId();
  const mine = profile?.workspaces ?? [];
  return mine.find((workspace) => workspace.id === id)?.name ?? "";
}

/**
 * Which plan the workspace is on — 4.3 writes it, and everything that depends
 * on a limit reads it. Defaults to the trial, which is where the column starts
 * and where every new workspace starts with it.
 */
/*
 * Deduped per request.
 *
 * The database is in Tokyo and a query from here costs a third of a second,
 * so the cost of a screen is mostly the number of round trips it makes one
 * after another. These answers cannot change while one request is being
 * served — the cookie is already set, the plan is already what it is — and
 * they were being fetched again by every list, widget and header that wanted
 * them. `cache` makes the second and tenth caller free.
 */
export const getCurrentWorkspacePlan = cache(async (): Promise<string> => {
  const id = await getCurrentWorkspaceId();
  if (!id) return "trial";

  const { createClient } = await import("@/base/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("plan")
    .eq("id", id)
    .maybeSingle();

  return (data?.plan as string | null) ?? "trial";
});

export type WorkspaceMark = { name: string; initials: string; logoUrl: string | null };

/**
 * What a workspace signs a document with.
 *
 * WP.24 puts a mark at the head of the page. The reference's is the product's
 * own "PA", which is right for a mock and wrong for a document that goes to a
 * client — the page is on the firm's letterhead, so it should carry the firm's
 * mark. Their logo where they have uploaded one, their initials where they
 * have not.
 */
export async function getWorkspaceMark(): Promise<WorkspaceMark | null> {
  const profile = await getSessionProfile();
  const id = await getCurrentWorkspaceId();
  const workspace = (profile?.workspaces ?? []).find((row) => row.id === id);
  if (!workspace) return null;

  const name = (workspace.name as string) || "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? "PA"
      : parts.length === 1
        ? parts[0]!.slice(0, 2).toUpperCase()
        : (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();

  return {
    name,
    initials,
    logoUrl: ((workspace as { logo_url?: string | null }).logo_url as string | null) ?? null,
  };
}

/**
 * Every workspace this person actually belongs to, for a control that lets
 * them choose between them.
 *
 * Free: `getSessionProfile` has already read the rows, and it only ever holds
 * memberships with `status = 'active'`, so anything this returns is somewhere
 * they may read. The Clients filter passes the chosen id back to `listClients`,
 * which checks it against this same list before using it.
 */
export async function listMyWorkspaces(): Promise<{ id: string; name: string }[]> {
  const profile = await getSessionProfile();
  return (profile?.workspaces ?? []).map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
  }));
}

/**
 * A signed URL for the workspace that is open, not merely the first one the
 * session happens to list.
 *
 * The bar and the rail used `workspaces[0]`, which is fine for a person in one
 * workplace and wrong for anybody who belongs to two — the mark on screen was
 * whichever row Postgres returned first, even when the cookie had already
 * chosen another. The open workspace is the one whose name is already shown.
 */
export async function getCurrentWorkspaceLogoUrl(): Promise<string | null> {
  const { getWorkspaceLogoUrl } = await import("@/base/lib/logo");
  const profile = await getSessionProfile();
  const id = await getCurrentWorkspaceId();
  const workspace =
    (profile?.workspaces ?? []).find((row) => row.id === id) ?? profile?.workspaces[0];
  return getWorkspaceLogoUrl(workspace?.logo_url ?? null);
}

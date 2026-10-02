import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId, getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";
import { planFor } from "@/whitbyos/lib/billing-vocab";
import { OPEN_REQUEST_STATUSES } from "@/whitbyos/lib/request-status";
import { photosFor } from "@/whitbyos/lib/people-photos";

export type WorkspaceCard = {
  id: string;
  name: string;
  type: string | null;
  primaryContact: string | null;
  /**
   * The face on the card.
   *
   * A client workspace is an account rather than a person and has no
   * photograph of its own, so it wears its primary contact's — the person you
   * are actually dealing with, and the one whose photo the portal already
   * holds. The same face the bar and the rail put beside their name.
   */
  photo: string | null;
  members: number;
  activeRequests: number;
  portal: boolean;
  status: string;
  archivedAt: string | null;
};

export type WorkspaceOverview = {
  plan: string;
  planLabel: string;
  /** Null on Enterprise, whose limits are agreed per contract. */
  limit: number | null;
  active: number;
  totalClients: number;
  portalsEnabled: number;
  activeRequests: number;
  cards: WorkspaceCard[];
  archived: WorkspaceCard[];
};

/**
 * Screen 0.9 — every Client Workspace in the organization, and how the
 * organization is doing across them.
 *
 * A "Workspace" is a client: the reference's own Add dialog is titled
 * Add Client, and the Providers modal offers the same list under "Link to
 * Client Workspace". So this reads clients, and the plan's limit is counted
 * against the ones that are not archived — which is the rule the pricing
 * document states and the reason archiving exists.
 */
export async function getWorkspaceOverview(): Promise<WorkspaceOverview | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const planValue = await getCurrentWorkspacePlan();
  const plan = planFor(planValue);

  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("whitbyos_clients")
    .select(
      "id, name, client_type, classification, status, archived_at, primary_contact_id, preferences, primary_contact:contacts!primary_contact_id (first_name, last_name, preferred_name)",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at");

  const { isHiddenFirmClient } = await import("@/whitbyos/lib/client-workspace");
  const rows = (clients ?? []).filter((row) => !isHiddenFirmClient(row));
  const ids = rows.map((row) => row.id as string);

  const [{ data: members }, { data: requests }] = await Promise.all([
    ids.length
      ? supabase
          .from("whitbyos_client_members")
          .select("client_id, portal_access")
          .in("client_id", ids)
      : Promise.resolve({ data: [] as { client_id: string; portal_access: boolean }[] }),
    ids.length
      ? supabase
          .from("whitbyos_requests")
          .select("client_id, status")
          .in("client_id", ids)
      : Promise.resolve({ data: [] as { client_id: string; status: string }[] }),
  ]);

  const memberCount = new Map<string, number>();
  const hasPortal = new Set<string>();
  for (const row of members ?? []) {
    const id = row.client_id as string;
    memberCount.set(id, (memberCount.get(id) ?? 0) + 1);
    if (row.portal_access) hasPortal.add(id);
  }

  const openCount = new Map<string, number>();
  for (const row of requests ?? []) {
    if (!OPEN_REQUEST_STATUSES.includes((row.status as string) ?? "")) continue;
    const id = row.client_id as string;
    openCount.set(id, (openCount.get(id) ?? 0) + 1);
  }

  /*
   * Every primary contact's photo in one go.
   *
   * Signing them one at a time would be a round trip per card; `photosFor`
   * takes the whole set and signs it in a single call to the bucket.
   */
  const photos = await photosFor(supabase, {
    userIds: [],
    contactIds: rows
      .map((row) => row.primary_contact_id as string | null)
      .filter((id): id is string => Boolean(id)),
  });

  const card = (row: (typeof rows)[number]): WorkspaceCard => {
    const id = row.id as string;
    const raw = row.primary_contact as unknown as
      | { first_name?: string; last_name?: string; preferred_name?: string }
      | { first_name?: string; last_name?: string; preferred_name?: string }[]
      | null;
    const contact = Array.isArray(raw) ? raw[0] : raw;

    return {
      id,
      name: row.name as string,
      // The firm's own word where it has one, the enum where it does not.
      type:
        ((row.classification as string | null)?.trim() ||
          (row.client_type as string | null)) ??
        null,
      primaryContact:
        contact?.preferred_name ||
        [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
        null,
      photo: photos.get((row.primary_contact_id as string | null) ?? "") ?? null,
      members: memberCount.get(id) ?? 0,
      activeRequests: openCount.get(id) ?? 0,
      portal: hasPortal.has(id),
      status: (row.status as string) ?? "active",
      archivedAt: (row.archived_at as string | null) ?? null,
    };
  };

  const cards = rows.filter((row) => !row.archived_at).map(card);
  const archived = rows.filter((row) => row.archived_at).map(card);

  return {
    plan: planValue,
    planLabel: plan?.label ?? "Standard",
    limit: plan?.activeWorkspaces ?? null,
    active: cards.length,
    totalClients: rows.length,
    portalsEnabled: cards.filter((row) => row.portal).length,
    activeRequests: cards.reduce((sum, row) => sum + row.activeRequests, 0),
    cards,
    archived,
  };
}

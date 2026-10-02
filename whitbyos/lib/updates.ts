import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

export type UpdateKind = "progress_update" | "plans_update";

export type UpdateRow = {
  id: string;
  headline: string;
  body: string;
  category: string | null;
  status: string;
  urgent: boolean;
  requestId: string | null;
  requestTitle: string | null;
  clientId: string | null;
  clientName: string | null;
  authorName: string | null;
  publishedAt: string | null;
  createdAt: string;
  linkedTaskId: string | null;
};

export type UpdatesResult =
  | { ok: true; rows: UpdateRow[] }
  | { ok: false; error: string };

/**
 * Screens 10 and 10.2.
 *
 * Both tabs are the same table — `whitbyos_update_type` has exactly the two
 * the export draws. A Progress Update is something the professional wrote for
 * the client; a Plans update is something the client told them that changes how
 * the work has to run ("travelling Dec 18 – Jan 3, unavailable for calls").
 *
 * `whitbyos_updates` has no workspace of its own: an update belongs to a
 * Request or a Client, so reach is worked out from those, the same way
 * Documents does it.
 */
export async function listUpdates(kind: UpdateKind): Promise<UpdatesResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [] };

  const supabase = await createClient();

  const [{ data: requests, error: requestError }, { data: clients, error: clientError }] =
    await Promise.all([
      supabase
        .from("whitbyos_requests")
        .select("id, title, client:whitbyos_clients!client_id (id, name)")
        .eq("workspace_id", workspaceId),
      supabase.from("whitbyos_clients").select("id, name").eq("workspace_id", workspaceId),
    ]);

  if (requestError) return { ok: false, error: requestError.message };
  if (clientError) return { ok: false, error: clientError.message };

  const requestTitles = new Map(
    (requests ?? []).map((row) => [row.id as string, row.title as string]),
  );
  const requestClients = new Map(
    (requests ?? []).map((row) => {
      const raw = row.client as unknown as
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
      const client = Array.isArray(raw) ? raw[0] : raw;
      return [row.id as string, client ?? null];
    }),
  );
  const clientNames = new Map((clients ?? []).map((row) => [row.id as string, row.name as string]));

  if (requestTitles.size === 0 && clientNames.size === 0) return { ok: true, rows: [] };

  const { data, error } = await supabase
    .from("whitbyos_updates")
    .select(
      "id, headline, body, category, status, urgent, request_id, client_id, created_by_user_id, published_at, created_at, linked_task_id, type",
    )
    .eq("type", kind)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const mine = (data ?? []).filter((row) => {
    const requestId = row.request_id as string | null;
    const clientId = row.client_id as string | null;
    return (
      (requestId && requestTitles.has(requestId)) || (clientId && clientNames.has(clientId))
    );
  });

  const authorIds = [
    ...new Set(mine.map((row) => row.created_by_user_id as string).filter(Boolean)),
  ];

  const authors = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, preferred_name, email")
      .in("id", authorIds);

    for (const user of users ?? []) {
      authors.set(
        user.id as string,
        (user.preferred_name as string) ||
          (user.full_name as string) ||
          (user.email as string) ||
          "Someone",
      );
    }
  }

  return {
    ok: true,
    rows: mine.map((row) => {
      const requestId = (row.request_id as string | null) ?? null;
      const clientId = (row.client_id as string | null) ?? null;
      const body = (row.body as string) ?? "";

      return {
        id: row.id as string,
        // Rows written before the headline column existed have their first
        // line read as one, rather than showing an update with no title.
        headline: (row.headline as string | null) ?? body.split("\n")[0] ?? "Update",
        body: (row.headline as string | null) ? body : body.split("\n").slice(1).join("\n"),
        category: (row.category as string | null) ?? null,
        status: (row.status as string) ?? "draft",
        urgent: Boolean(row.urgent),
        requestId,
        requestTitle: requestId ? (requestTitles.get(requestId) ?? null) : null,
        // An update belongs to a client directly or through its Request, and
        // the filter has to find it either way — so both halves resolve to the
        // same client, and the id travels beside the name it was read from.
        clientId: clientId ?? (requestId ? (requestClients.get(requestId)?.id ?? null) : null),
        clientName: clientId
          ? (clientNames.get(clientId) ?? null)
          : requestId
            ? (requestClients.get(requestId)?.name ?? null)
            : null,
        authorName: authors.get(row.created_by_user_id as string) ?? null,
        publishedAt: (row.published_at as string | null) ?? null,
        createdAt: row.created_at as string,
        linkedTaskId: (row.linked_task_id as string | null) ?? null,
      };
    }),
  };
}

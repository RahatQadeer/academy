import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";

export type DeletionAsk = {
  id: string;
  label: string;
  what: string;
  reason: string | null;
  askedAt: string;
};

/**
 * What the firm has asked this client's permission to delete.
 *
 * Only unanswered asks, and only for the clients this person actually belongs
 * to — the row's own policy enforces the second, and the status the first.
 * A record is not touched until one of these is accepted, so an unanswered ask
 * means the thing is still there.
 */
export async function listDeletionAsks(): Promise<DeletionAsk[]> {
  const context = await getPortalContext();
  if (!context.contactId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_deletion_requests")
    .select("id, entity_type, entity_label, reason, created_at, status, requested_by_user_id")
    .eq("status", "pending")
    .not("requested_by_user_id", "is", null)
    .order("created_at", { ascending: false });

  const WHAT: Record<string, string> = {
    client: "your client record and everything filed under it",
    workplan: "a work plan",
    document: "a document",
  };

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: (row.entity_label as string) ?? "a record",
    what: WHAT[row.entity_type as string] ?? "a record",
    reason: (row.reason as string | null) ?? null,
    askedAt: row.created_at as string,
  }));
}

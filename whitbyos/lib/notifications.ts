import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

export type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
  /** Set while this is an unanswered ask, which is the only kind with buttons. */
  deletionRequestId: string | null;
  decided: boolean;
};

/**
 * What the bell holds for whoever is signed in.
 *
 * Addressed by user, not by workspace: a notification is for a person. The
 * workspace is carried so the row can be reached by the policy, not so it can
 * be shown to everybody in it.
 */
export async function listNotices(limit = 20): Promise<Notice[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("whitbyos_notifications")
    .select(
      "id, kind, title, body, href, created_at, read_at, deletion_request_id, request:whitbyos_deletion_requests!deletion_request_id (status)",
    )
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const request = Array.isArray(row.request) ? row.request[0] : row.request;
    const status = (request as { status?: string } | null)?.status ?? null;

    return {
      id: row.id as string,
      kind: row.kind as string,
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      href: (row.href as string | null) ?? null,
      createdAt: row.created_at as string,
      read: Boolean(row.read_at),
      deletionRequestId: (row.deletion_request_id as string | null) ?? null,
      // An ask that has been answered is history, not a question.
      decided: status !== null && status !== "pending",
    };
  });
}

/**
 * How many of the notices are unread.
 *
 * Counted from a list that has already been fetched wherever there is one:
 * the bell needs both, and asking the database twice for two views of the
 * same rows cost a round trip to Tokyo for nothing.
 */
export function unreadIn(notices: Notice[]): number {
  return notices.filter((notice) => !notice.read).length;
}

export async function countUnread(): Promise<number> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return 0;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("whitbyos_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", user.id)
    .is("read_at", null);

  return count ?? 0;
}

import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

export type RequestListRow = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
  updated_at: string;
  client_id: string;
  client_name: string;
};

export type ClientOption = { id: string; name: string };

export type PlaybookOption = { id: string; name: string; stepCount: number };

function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type RequestListResult =
  | { ok: true; rows: RequestListRow[] }
  | { ok: false; error: string };

export async function listRequests(filters: {
  q?: string;
  status?: string;
  /**
   * Open client's id. Alone, returns that client's rows plus unlinked ones.
   * Narrow further with `link`.
   */
  client?: string;
  /**
   * When a client is open: `client` = only that client's, `none` = only
   * unlinked. Absent = both (other clients still stay out).
   */
  link?: string;
  urgency?: string;
  sort?: string;
} = {}): Promise<RequestListResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [] };

  const supabase = await createClient();
  let query = supabase
    .from("whitbyos_requests")
    .select(
      "id, title, status, urgency, target_date, updated_at, client_id, client:whitbyos_clients!client_id (id, name)",
    )
    .eq("workspace_id", workspaceId);

  const search = filters.q?.trim();
  if (search) query = query.ilike("title", `%${search}%`);
  if (filters.status) {
    query =
      filters.status === "not_started"
        ? query.or("status.eq.not_started,status.eq.open,status.is.null")
        : query.eq("status", filters.status);
  }

  const link = filters.link?.trim();
  if (filters.client && link === "client") {
    query = query.eq("client_id", filters.client);
  } else if (link === "none") {
    query = query.is("client_id", null);
  } else if (filters.client) {
    /*
     * Open client: that client's requests, plus any with no client — those are
     * firm-wide and belong on every scoped list. Other clients' rows stay out.
     */
    query = query.or(`client_id.eq.${filters.client},client_id.is.null`);
  }

  if (filters.urgency) query = query.eq("urgency", filters.urgency);

  const sort = filters.sort ?? "";
  const { data, error } = await query.order(
    sort === "due" ? "target_date" : sort === "title" ? "title" : "updated_at",
    { ascending: sort === "title" || sort === "due" },
  );
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []).map((row) => {
    const client = firstOf(row.client as unknown as ClientOption | ClientOption[] | null);
    return {
      id: row.id as string,
      title: row.title as string,
      status: row.status as string,
      target_date: row.target_date as string | null,
      updated_at: row.updated_at as string,
      client_id: (row.client_id as string | null) ?? "",
      client_name: client?.name ?? "None",
    };
  });

  return { ok: true, rows };
}

/** Clients offered in the request-creation controls. Hidden when Client Workspaces are off. */
export async function listClientOptions(): Promise<ClientOption[]> {
  const { usesClientWorkspaces } = await import("@/whitbyos/lib/client-workspace");
  if (!(await usesClientWorkspaces())) return [];
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_clients")
    .select("id, name, preferences, primary_contact_id, client_type, classification")
    .eq("workspace_id", workspaceId)
    .order("name");

  const { isHiddenFirmClient } = await import("@/whitbyos/lib/client-workspace");
  return ((data ?? []) as Array<
    ClientOption & {
      preferences?: unknown;
      primary_contact_id?: string | null;
      client_type?: string | null;
      classification?: string | null;
    }
  >)
    .filter((row) => !isHiddenFirmClient(row))
    .map((row) => ({ id: row.id, name: row.name }));
}

/**
 * Playbooks offered as a starting structure (SRS §6.4.13, §6.5.2).
 *
 * The step count comes from the playbook's own stored contents; a playbook
 * with no structure yet simply reports zero rather than being hidden.
 */
export async function listPlaybookOptions(
  limit = 3,
): Promise<PlaybookOption[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_playbooks")
    .select("id, name, contents")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const contents = row.contents as { workstreams?: unknown[] } | null;
    const steps = Array.isArray(contents?.workstreams)
      ? contents.workstreams.length
      : 0;
    return { id: row.id as string, name: row.name as string, stepCount: steps };
  });
}

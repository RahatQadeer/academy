import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { readStreams, type PlaybookStream } from "@/whitbyos/lib/playbook-vocab";

export type PlaybookRow = {
  id: string;
  name: string;
  category: string | null;
  streamCount: number;
  timesUsed: number;
  sharedLevel: string | null;
  version: number;
  updatedAt: string;
  /** v2's filter — the clients whose Work Plans were built from this Playbook. */
  clientIds: string[];
};

export type PlaybookResult =
  | { ok: true; rows: PlaybookRow[] }
  | { ok: false; error: string };

/**
 * Screen 6 — the Playbooks list.
 *
 * "Times Used" is counted rather than stored: a Work Plan records the Playbook
 * it was built from, so the number is however many did. Storing a counter
 * alongside would be a second version of the same fact, and the two drift the
 * first time a plan is deleted.
 */
export async function listPlaybooks(): Promise<PlaybookResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whitbyos_playbooks")
    .select("id, name, category, contents, version, shared_level, updated_at")
    .eq("workspace_id", workspaceId)
    // v2 files a Playbook away rather than destroying it; the library is what
    // is still standing, and finished — a wizard left halfway keeps its typing
    // without putting an unfinished Playbook on everyone's shelf.
    .is("archived_at", null)
    .is("deleted_at", null)
    .eq("is_draft", false)
    .order("updated_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const ids = (data ?? []).map((row) => row.id as string);

  const used = new Map<string, number>();
  const clients = new Map<string, Set<string>>();
  if (ids.length > 0) {
    // The client comes through the plan's Request, which is where it lives.
    // Counting the plans and gathering their clients is the same read, so it
    // is one query rather than two.
    const { data: plans } = await supabase
      .from("whitbyos_workplans")
      .select(
        "source_playbook_id, request:whitbyos_requests!request_id (client_id)",
      )
      .in("source_playbook_id", ids)
      .is("deleted_at", null);

    for (const plan of plans ?? []) {
      const id = plan.source_playbook_id as string;
      used.set(id, (used.get(id) ?? 0) + 1);

      const request = firstOf(plan.request) as { client_id?: string } | null;
      if (request?.client_id) {
        const set = clients.get(id) ?? new Set<string>();
        set.add(request.client_id);
        clients.set(id, set);
      }
    }
  }

  return {
    ok: true,
    rows: (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      category: (row.category as string | null) ?? null,
      streamCount: readStreams(row.contents).length,
      timesUsed: used.get(row.id as string) ?? 0,
      sharedLevel: (row.shared_level as string | null) ?? "private",
      version: (row.version as number) ?? 1,
      updatedAt: row.updated_at as string,
      clientIds: [...(clients.get(row.id as string) ?? [])],
    })),
  };
}

function firstOf(value: unknown) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/**
 * v2's "Used in any Workspace" — the clients this library has actually
 * been used for.
 *
 * Only clients with a Work Plan built from a Playbook appear. A filter listing
 * every client in the workspace would mostly offer choices that return nothing,
 * which reads as "no Playbooks" when it means "not this client".
 */
export async function listPlaybookClients(): Promise<Array<{ id: string; name: string }>> {
  const { usesClientWorkspaces } = await import("@/whitbyos/lib/client-workspace");
  if (!(await usesClientWorkspaces())) return [];
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("whitbyos_playbooks")
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .is("deleted_at", null)
    .eq("is_draft", false);

  const ids = (data ?? []).map((row) => row.id as string);
  if (ids.length === 0) return [];

  const { data: plans } = await supabase
    .from("whitbyos_workplans")
    .select("request:whitbyos_requests!request_id (client_id, client:whitbyos_clients!client_id (id, name))")
    .in("source_playbook_id", ids)
    .is("deleted_at", null);

  const seen = new Map<string, string>();
  for (const plan of plans ?? []) {
    const request = firstOf(plan.request) as { client?: unknown } | null;
    const client = firstOf(request?.client) as { id?: string; name?: string } | null;
    if (client?.id && client.name) seen.set(client.id, client.name);
  }

  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * What 6.3's dialog counts before it asks.
 *
 * Work Plans built from this Playbook, and the Work Streams inside the
 * Playbook itself — the two numbers the reference names. Neither is at risk:
 * the sentence exists to say so.
 */
export async function getPlaybookLinks(playbookId: string) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { plans: 0, streams: 0 };

  const supabase = await createClient();

  const { data: playbook } = await supabase
    .from("whitbyos_playbooks")
    .select("contents")
    .eq("id", playbookId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const { count } = await supabase
    .from("whitbyos_workplans")
    .select("id", { count: "exact", head: true })
    .eq("source_playbook_id", playbookId)
    .is("deleted_at", null);

  return { plans: count ?? 0, streams: readStreams(playbook?.contents).length };
}

// `clientIds` is the list's filter, not a fact about one Playbook on its own.
export type PlaybookDetail = Omit<PlaybookRow, "clientIds"> & {
  streams: PlaybookStream[];
  description: string | null;
  updatedBy: string | null;
  /** 6.0d says a different sentence when the Playbook came off a Work Plan. */
  createdFromWorkplan: boolean;
  /** 6.1's Sharing panel names an owner. Null when nothing recorded one. */
  ownerName: string | null;
};

/** Screen 6.1 — one Playbook, and the Work Streams it lays out. */
export async function getPlaybook(playbookId: string): Promise<PlaybookDetail | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_playbooks")
    .select(
      "id, name, category, contents, version, shared_level, updated_at, workspace_id, archived_at, deleted_at, created_from_workplan_id, created_by_user_id",
    )
    .eq("id", playbookId)
    .maybeSingle();

  // An archived Playbook still opens — Settings → Archive links straight to it,
  // and nobody restores what they cannot look at first. A deleted one does not.
  if (!data || data.workspace_id !== workspaceId || data.deleted_at) return null;

  const { count } = await supabase
    .from("whitbyos_workplans")
    .select("id", { count: "exact", head: true })
    .eq("source_playbook_id", playbookId)
    .is("deleted_at", null);

  const contents = (data.contents ?? {}) as Record<string, unknown>;
  const profile = await getSessionProfile();

  let ownerName: string | null = null;
  if (data.created_by_user_id) {
    const { data: person } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", data.created_by_user_id as string)
      .maybeSingle();
    ownerName = (person?.full_name as string | null) ?? null;
  }

  return {
    id: data.id as string,
    name: data.name as string,
    category: (data.category as string | null) ?? null,
    streams: readStreams(data.contents),
    streamCount: readStreams(data.contents).length,
    createdFromWorkplan: Boolean(data.created_from_workplan_id),
    ownerName,
    timesUsed: count ?? 0,
    sharedLevel: (data.shared_level as string | null) ?? "private",
    version: (data.version as number) ?? 1,
    updatedAt: data.updated_at as string,
    description: typeof contents.description === "string" ? contents.description : null,
    // Who last touched it is not recorded anywhere on the row — the schema has
    // no author column — so the reference's "by Jordan Hartwell" can only be
    // the reader when it is their own workspace. Rather than invent it, this
    // stays null and the screen leaves that clause out.
    updatedBy: profile ? null : null,
  };
}

/** Playbooks offered when building a Work Plan (WP.2). */
export async function listPlaybookOptions() {
  const result = await listPlaybooks();
  return result.ok ? result.rows.map((row) => ({ id: row.id, title: row.name })) : [];
}

export type PlaybookVersion = {
  version: number;
  reason: string | null;
  by: string | null;
  at: string;
};

/** 6.1's Version History panel, newest first. */
export async function listPlaybookVersions(playbookId: string): Promise<PlaybookVersion[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("whitbyos_playbooks")
    .select("workspace_id, version, created_at, updated_at, created_by_user_id")
    .eq("id", playbookId)
    .maybeSingle();

  if (!owner || owner.workspace_id !== workspaceId) return [];

  const { data } = await supabase
    .from("whitbyos_playbook_versions")
    .select("version_number, change_reason, created_at, created_by_user_id")
    .eq("playbook_id", playbookId)
    .order("version_number", { ascending: false });

  const rows = data ?? [];

  // A Playbook saved from a Work Plan, or duplicated, used not to write a
  // first version. The Playbook itself is still v1, so the panel showing
  // "nothing recorded" next to that was a gap rather than a fact.
  if (rows.length === 0) {
    let by: string | null = null;
    if (owner.created_by_user_id) {
      const { data: person } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", owner.created_by_user_id as string)
        .maybeSingle();
      by = (person?.full_name as string | null) ?? null;
    }

    return [
      {
        version: (owner.version as number) ?? 1,
        reason: "Created",
        by,
        at: (owner.created_at as string) ?? (owner.updated_at as string),
      },
    ];
  }

  const ids = [
    ...new Set(rows.map((row) => row.created_by_user_id as string | null).filter(Boolean)),
  ] as string[];

  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: people } = await supabase.from("users").select("id, full_name").in("id", ids);
    for (const person of people ?? []) {
      names.set(person.id as string, (person.full_name as string | null) ?? "");
    }
  }

  return rows.map((row) => ({
    version: row.version_number as number,
    reason: (row.change_reason as string | null) ?? null,
    by: names.get(row.created_by_user_id as string) || null,
    at: row.created_at as string,
  }));
}

/**
 * The Ask Whitby conversation, read back out of the version history.
 *
 * Only the entries somebody typed — "Created" and "Edited" are what this code
 * writes when nobody asked Whitby anything, and they are the Version History's
 * business rather than the conversation's. The reply is composed from what the
 * version actually holds, so it reports the Playbook rather than repeating the
 * instruction back.
 */
export async function listPlaybookTurns(
  playbookId: string,
): Promise<Array<{ id: string; instruction: string; reply: string }>> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("whitbyos_playbooks")
    .select("workspace_id")
    .eq("id", playbookId)
    .maybeSingle();

  if (owner?.workspace_id !== workspaceId) return [];

  const { data } = await supabase
    .from("whitbyos_playbook_versions")
    .select("version_number, change_reason, snapshot")
    .eq("playbook_id", playbookId)
    .order("version_number");

  return (data ?? [])
    .filter((row) => {
      const reason = (row.change_reason as string | null) ?? "";
      return reason.trim() && reason !== "Created" && reason !== "Edited";
    })
    .map((row) => {
      const streams = readStreams(row.snapshot);
      const tasks = streams.reduce((total, stream) => total + stream.tasks.length, 0);
      return {
        id: String(row.version_number),
        instruction: row.change_reason as string,
        reply: `Done, ${streams.length} Work Stream${streams.length === 1 ? "" : "s"}, ${tasks} task${tasks === 1 ? "" : "s"}.`,
      };
    });
}

export type PlaybookUsage = { id: string; name: string; status: string; clientName: string };

/** 6.1's Used On panel — the Work Plans this Playbook has been the shape of. */
export async function listPlaybookUsage(playbookId: string): Promise<PlaybookUsage[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_workplans")
    .select(
      "id, name, status, request:whitbyos_requests!request_id (workspace_id, client:whitbyos_clients!client_id (name))",
    )
    .eq("source_playbook_id", playbookId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows: PlaybookUsage[] = [];
  for (const row of data ?? []) {
    const request = firstOf(row.request) as { workspace_id?: string; client?: unknown } | null;
    if (request?.workspace_id !== workspaceId) continue;

    const client = firstOf(request?.client) as { name?: string } | null;
    rows.push({
      id: row.id as string,
      name: row.name as string,
      status: (row.status as string) ?? "draft",
      clientName: client?.name ?? "No client",
    });
  }

  return rows;
}

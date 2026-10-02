import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

/**
 * Settings 17.7 — everything archived across the workspace, in one place.
 *
 * The screen draws one table over several kinds of record, so each kind is
 * read on its own terms and mapped onto the same four columns: what it is
 * called, what kind of thing it is, where it was, and when it was filed away.
 *
 * Three kinds can be archived today. A Work Plan and a Playbook each carry
 * `archived_at`, and a document's status carries `archived`, which is the
 * vocabulary each of them already had. Playbooks joined the list when v2 of
 * the reference replaced their bin with Archive/Delete and pointed the restore
 * at this screen. The five that remain — Client Workspaces, Clients, Contacts,
 * Providers, Knowledge Articles — record being archived nowhere at all. They
 * are named on the screen as not yet archivable rather than offered as filters
 * that can only ever come back empty, which reads as "nothing archived" when
 * it means "cannot be".
 */

export const ARCHIVE_TYPES = [
  { value: "workplan", label: "Work Plans" },
  { value: "playbook", label: "Playbooks" },
  { value: "document", label: "Documents" },
  { value: "client", label: "Clients" },
  { value: "contact", label: "Contacts" },
  { value: "provider", label: "Providers" },
  { value: "article", label: "Knowledge Articles" },
] as const;

export type ArchiveType = (typeof ARCHIVE_TYPES)[number]["value"];

/**
 * 17.7 used to name five kinds nothing could archive, then one. Now none: every
 * kind the screen lists can be filed away and restored.
 */
export const ARCHIVE_NOT_YET: string[] = [];

export type ArchivedItem = {
  id: string;
  name: string;
  type: ArchiveType;
  typeLabel: string;
  /** 17.7's "Was in" — the client or area the record belonged to. */
  wasIn: string;
  archivedAt: string | null;
  /** When the record was made, which is what decides whether deleting it asks. */
  createdAt: string | null;
  /** Whose it is, so the deletion request knows who to ask. */
  clientId: string | null;
  /** Somebody has already asked to delete it, and is waiting on an answer. */
  pendingDeletion: boolean;
  /** Where the record still lives, for anyone wanting to look before restoring. */
  href: string | null;
};

export async function listArchived(type?: ArchiveType): Promise<ArchivedItem[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const items: ArchivedItem[] = [];

  if (!type || type === "workplan") {
    const { data } = await supabase
      .from("whitbyos_workplans")
      .select(
        "id, name, archived_at, created_at, request:whitbyos_requests!request_id (workspace_id, client_id, client:whitbyos_clients!client_id (name))",
      )
      .not("archived_at", "is", null)
      .is("deleted_at", null)
      .order("archived_at", { ascending: false });

    for (const row of data ?? []) {
      const request = firstOf(row.request) as
        | { workspace_id?: string; client_id?: string; client?: unknown }
        | null;
      if (request?.workspace_id !== workspaceId) continue;

      const client = firstOf(request?.client) as { name?: string } | null;
      items.push({
        id: row.id as string,
        name: row.name as string,
        type: "workplan",
        typeLabel: "Work Plan",
        wasIn: client?.name ?? "No client",
        archivedAt: (row.archived_at as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        clientId: request?.client_id ?? null,
        pendingDeletion: false,
        href: `/whitbyos/work-plans/${row.id}`,
      });
    }
  }

  if (!type || type === "playbook") {
    const { data } = await supabase
      .from("whitbyos_playbooks")
      .select("id, name, category, archived_at, created_at")
      .eq("workspace_id", workspaceId)
      .not("archived_at", "is", null)
      .is("deleted_at", null)
      .order("archived_at", { ascending: false });

    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        name: row.name as string,
        type: "playbook",
        typeLabel: "Playbook",
        // A Playbook belongs to the library rather than to a client — that is
        // the whole point of one — so "Was in" says which shelf it came off.
        wasIn: (row.category as string | null) ?? "Playbooks",
        archivedAt: (row.archived_at as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        clientId: null,
        pendingDeletion: false,
        href: `/whitbyos/playbooks/${row.id}`,
      });
    }
  }

  if (!type || type === "document") {
    const { data } = await supabase
      .from("documents")
      .select("id, title, context_type, context_id, updated_at, created_at")
      .eq("status", "archived")
      .order("updated_at", { ascending: false });

    const [{ data: clients }, { data: requests }] = await Promise.all([
      supabase.from("whitbyos_clients").select("id, name").eq("workspace_id", workspaceId),
      supabase
        .from("whitbyos_requests")
        .select("id, title")
        .eq("workspace_id", workspaceId),
    ]);

    const clientNames = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));
    const requestNames = new Map((requests ?? []).map((r) => [r.id as string, r.title as string]));
    const reachable = new Set([...clientNames.keys(), ...requestNames.keys(), workspaceId]);

    for (const row of data ?? []) {
      const contextId = row.context_id as string;
      if (!reachable.has(contextId)) continue;

      const unlinked =
        row.context_type === "client" && contextId === workspaceId;
      const wasIn = unlinked
        ? "Not linked yet"
        : row.context_type === "request"
          ? requestNames.get(contextId) ?? "A request"
          : clientNames.get(contextId) ?? "A client";

      items.push({
        id: row.id as string,
        name: row.title as string,
        type: "document",
        typeLabel: "Document",
        wasIn,
        archivedAt: (row.updated_at as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        clientId: null,
        pendingDeletion: false,
        href: `/whitbyos/documents?doc=${row.id}`,
      });
    }
  }

  if (!type || type === "client") {
    const { data } = await supabase
      .from("whitbyos_clients")
      .select("id, name, archived_at, created_at")
      .eq("workspace_id", workspaceId)
      .not("archived_at", "is", null);

    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        name: row.name as string,
        type: "client",
        typeLabel: "Client",
        wasIn: "This workspace",
        archivedAt: (row.archived_at as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        clientId: null,
        pendingDeletion: false,
        href: `/whitbyos/clients/${row.id}`,
      });
    }
  }

  if (!type || type === "contact") {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, preferred_name, archived_at, created_at")
      .eq("created_by_workspace_id", workspaceId)
      .not("archived_at", "is", null);

    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        name:
          (row.preferred_name as string) ||
          [row.first_name, row.last_name].filter(Boolean).join(" ") ||
          "Unnamed contact",
        type: "contact",
        typeLabel: "Contact",
        wasIn: "This workspace",
        archivedAt: (row.archived_at as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        clientId: null,
        pendingDeletion: false,
        href: `/whitbyos/contacts/${row.id}`,
      });
    }
  }

  if (!type || type === "provider") {
    const { data } = await supabase
      .from("whitbyos_providers")
      .select(
        "id, archived_at, created_at, company:companies!company_id (name), contact:contacts!contact_id (first_name, last_name, preferred_name)",
      )
      .eq("workspace_id", workspaceId)
      .not("archived_at", "is", null);

    for (const row of data ?? []) {
      const company = firstOf(row.company) as { name?: string } | null;
      const contact = firstOf(row.contact) as
        | { first_name?: string; last_name?: string; preferred_name?: string }
        | null;

      items.push({
        id: row.id as string,
        name:
          company?.name ||
          contact?.preferred_name ||
          [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
          "Unnamed provider",
        type: "provider",
        typeLabel: "Provider",
        wasIn: "This workspace",
        archivedAt: (row.archived_at as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        clientId: null,
        pendingDeletion: false,
        href: `/whitbyos/providers/${row.id}`,
      });
    }
  }

  if (!type || type === "article") {
    const { data } = await supabase
      .from("whitbyos_knowledge")
      .select("id, title, category, archived_at, created_at")
      .eq("workspace_id", workspaceId)
      .not("archived_at", "is", null);

    for (const row of data ?? []) {
      items.push({
        id: row.id as string,
        name: row.title as string,
        type: "article",
        typeLabel: "Knowledge Article",
        wasIn: (row.category as string | null) ?? "No category",
        archivedAt: (row.archived_at as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        clientId: null,
        pendingDeletion: false,
        href: `/whitbyos/knowledge/${row.id}`,
      });
    }
  }

  // Anything somebody has already asked about is marked, so the screen offers
  // one ask per record rather than a button that quietly refuses a second.
  if (items.length > 0) {
    const { data: pending } = await supabase
      .from("whitbyos_deletion_requests")
      .select("entity_type, entity_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending");

    const waiting = new Set((pending ?? []).map((row) => `${row.entity_type}:${row.entity_id}`));
    for (const item of items) {
      item.pendingDeletion = waiting.has(`${item.type}:${item.id}`);
    }
  }

  /*
   * Only what was archived out of the workspace somebody is standing in.
   *
   * Every row already carries the client it was filed under and prints it as
   * "Was in <client>", so this screen was a list of other clients' archived
   * plans, playbooks and client records, each labelled with the name it was
   * not supposed to be showing. Filtered here rather than in each of the
   * queries above, because every branch has already worked the client out.
   *
   * Firm-level rows — a Playbook belongs to the firm, not a client — have no
   * client and stay.
   */
  const openClient = await getOpenClientId();
  const mine = openClient
    ? items.filter((item) => !item.clientId || item.clientId === openClient)
    : items;

  return mine.sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
}

function firstOf(value: unknown) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { listProviderDocumentContexts } from "@/whitbyos/lib/providers";

export type DocumentStatus = "current" | "action_needed" | "completed" | "archived";

export type DocumentRow = {
  id: string;
  title: string;
  status: DocumentStatus;
  visibility: string;
  labels: string[];
  linkedTo: string | null;
  linkedHref: string | null;
  /** Client workspace this row belongs to — the request's client, or itself. */
  clientId: string | null;
  contextType: string;
  contextId: string;
  version: number;
  effective_date: string | null;
  /** When it stops being good — the whole reason a row asks to be Updated. */
  expires_at: string | null;
  signed_date: string | null;
  /** The signing round trip (072), read with `readSignature`. */
  signature_required_from: string | null;
  signature_state: string | null;
  signature_note: string | null;
  signature_actioned_at: string | null;
  updated_at: string;
  file_url: string;
};

/**
 * Documents with no client or request yet are filed against this workspace's
 * id as `context_type: client`. The enum has no "none" / "workspace" value,
 * and `context_id` is not nullable, so this is how an unlinked file stays
 * findable without a migration — and why `listDocuments` always includes the
 * workspace id in the context set.
 */
export function isUnlinkedDocument(contextType: string, contextId: string, workspaceId: string) {
  return contextType === "client" && contextId === workspaceId;
}

export type DocumentListResult =
  | { ok: true; rows: DocumentRow[]; labels: string[] }
  | { ok: false; error: string };

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Screens 21 and 21a — every document this workspace can reach.
 *
 * `documents` is base's shared table (§24.2), used by the Portal and Partner
 * Center too, and it carries no workspace of its own — a document belongs to
 * whatever it hangs off. So reachability is worked out from the context: the
 * Clients and Requests of this workspace, plus files not linked yet, which are
 * filed against the workspace id itself (see `isUnlinkedDocument`).
 */
export async function listDocuments(
  filters: { client?: string } = {},
): Promise<DocumentListResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [], labels: [] };

  const supabase = await createClient();

  const [{ data: clients }, { data: requests }, providers] = await Promise.all([
    supabase.from("whitbyos_clients").select("id, name").eq("workspace_id", workspaceId),
    supabase
      .from("whitbyos_requests")
      .select("id, title, client_id")
      .eq("workspace_id", workspaceId),
    listProviderDocumentContexts(),
  ]);

  // Keyed by the company or contact id the document is actually filed under,
  // which is what `context_id` holds — the provider's own id never appears on
  // a document.
  const providerContexts = new Map(
    providers.map((provider) => [provider.contextId, provider]),
  );

  const clientNames = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));
  const requestNames = new Map((requests ?? []).map((r) => [r.id as string, r.title as string]));
  const requestClients = new Map(
    (requests ?? []).map((r) => [r.id as string, (r.client_id as string | null) ?? null]),
  );

  const selected = filters.client?.trim();
  const requestIdsForClient = selected
    ? [...requestClients.entries()]
        .filter(([, clientId]) => clientId === selected)
        .map(([id]) => id)
    : [];
  // Unfiltered: every client, request, and unlinked filing this workspace can
  // reach. Filtered: that client plus the requests that belong to it — not
  // every other client in the firm.
  const contextIds = selected
    ? [selected, ...requestIdsForClient]
    : [
        ...clientNames.keys(),
        ...requestNames.keys(),
        ...providerContexts.keys(),
        workspaceId,
      ];

  if (contextIds.length === 0) return { ok: true, rows: [], labels: [] };

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, title, status, visibility, context_type, context_id, version, effective_date, expires_at, signed_date, signature_required_from, signature_state, signature_note, signature_actioned_at, updated_at, file_url",
    )
    .in("context_id", contextIds)
    .order("updated_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: true, rows: [], labels: [] };

  const { data: labelRows } = await supabase
    .from("document_labels")
    .select("document_id, label_text")
    .in("document_id", data.map((d) => d.id as string));

  const byDocument = new Map<string, string[]>();
  for (const row of labelRows ?? []) {
    const list = byDocument.get(row.document_id as string) ?? [];
    list.push(row.label_text as string);
    byDocument.set(row.document_id as string, list);
  }

  const rows: DocumentRow[] = data.map((row) => {
    const isRequest = row.context_type === "request";
    const id = row.context_id as string;
    const unlinked = isUnlinkedDocument(row.context_type as string, id, workspaceId);
    const provider = providerContexts.get(id);

    return {
      id: row.id as string,
      title: row.title as string,
      status: (row.status as DocumentStatus) ?? "current",
      visibility: (row.visibility as string) ?? "internal",
      labels: byDocument.get(row.id as string) ?? [],
      linkedTo: unlinked
        ? "Not linked yet"
        : provider
          ? provider.name
          : isRequest
            ? requestNames.get(id) ?? null
            : clientNames.get(id) ?? null,
      linkedHref: unlinked
        ? null
        : provider
          ? `/whitbyos/providers/${provider.providerId}`
          : isRequest
            ? `/whitbyos/requests/${id}`
            : `/whitbyos/clients/${id}`,
      // A provider belongs to no client, so filtering by one must not sweep it
      // in — `null` is what keeps it out of that filter honestly.
      clientId: unlinked || provider
        ? null
        : isRequest
          ? requestClients.get(id) ?? null
          : id,
      contextType: row.context_type as string,
      contextId: id,
      version: (row.version as number) ?? 1,
      effective_date: (row.effective_date as string | null) ?? null,
      expires_at: (row.expires_at as string | null) ?? null,
      signed_date: (row.signed_date as string | null) ?? null,
      signature_required_from: (row.signature_required_from as string | null) ?? null,
      signature_state: (row.signature_state as string | null) ?? null,
      signature_note: (row.signature_note as string | null) ?? null,
      signature_actioned_at: (row.signature_actioned_at as string | null) ?? null,
      updated_at: row.updated_at as string,
      file_url: row.file_url as string,
    };
  });

  const visible = selected
    ? rows.filter((row) => documentBelongsToClient(row, selected))
    : rows;

  const labels = [...new Set(visible.flatMap((row) => row.labels))].sort();

  return { ok: true, rows: visible, labels };
}

/**
 * 12's "All Workspaces" filter.
 *
 * The dropdown is clients, not requests — ABC in Linked to is often a Request
 * under a client, so it will not appear as its own option. A row still belongs
 * to that client workspace if it is filed on the client or on one of its
 * requests. A document filed on a *different* client must not leak through.
 */
export function documentBelongsToClient(row: DocumentRow, clientId: string) {
  if (row.contextType === "client") return row.contextId === clientId;
  if (row.contextType === "request") return row.clientId === clientId;
  return false;
}

/**
 * What screen 21a's "Needs" column asks for.
 *
 * The schema has no field for it, so it is read from what the document is
 * missing: a document waiting on a signature has no signed date, and anything
 * else flagged for attention is waiting on a person to look at it.
 */
export type NeededAction = "Review" | "Sign" | "Upload" | "Update";

/** How near an expiry has to be before the document asks to be replaced. */
const EXPIRING_DAYS = 30;

export function neededAction(document: DocumentRow): NeededAction | null {
  // Being asked to sign outranks the status, the same way the Portal reads it
  // (`client-portal/lib/data/documents.ts`). A document the client has sent
  // for signature is asking for exactly one thing, and it says so whatever its
  // status happens to be — the ask is the reason the row is in front of you.
  if (
    document.signature_state === "awaiting" &&
    document.signature_required_from === "professional" &&
    document.file_url.trim()
  ) {
    return "Sign";
  }

  if (document.status !== "action_needed") return null;

  // Expected but never provided: the row exists so the gap is visible, and
  // there is nothing to sign or read until a file arrives.
  if (!document.file_url.trim()) return "Upload";

  // Running out, or already out. Replacing it comes before reading it.
  if (document.expires_at) {
    const days =
      (new Date(document.expires_at).getTime() - Date.now()) / 86_400_000;
    if (days <= EXPIRING_DAYS) return "Update";
  }

  if (document.signature_state === "signed" || document.signature_state === "declined") {
    return "Review";
  }

  return document.signed_date ? "Review" : "Sign";
}

/** The Documents context list on the Upload dialog. */
export async function listDocumentContexts() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  /*
   * Scoped to the client workspace that is open.
   *
   * The dialog listed every client of the firm and every request in it —
   * fifteen lines of other people's work to scroll past while filing one
   * client's document, and one mis-click away from filing it against the
   * wrong family. Whose work you are looking at is already answered; this
   * offers that client, the requests inside it, and the providers, which
   * belong to the firm rather than to anyone's account.
   */
  const { usesClientWorkspaces } = await import("@/whitbyos/lib/client-workspace");
  const showClients = await usesClientWorkspaces();
  const openClient = await getOpenClientId();

  const clientQuery = supabase
    .from("whitbyos_clients")
    .select("id, name, preferences, primary_contact_id, client_type, classification")
    .eq("workspace_id", workspaceId)
    .order("name");

  const requestQuery = supabase
    .from("whitbyos_requests")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  const [{ data: clients }, { data: requests }] = await Promise.all([
    showClients
      ? openClient
        ? clientQuery.eq("id", openClient)
        : clientQuery
      : Promise.resolve({
          data: [] as {
            id: string;
            name: string;
            preferences?: unknown;
            primary_contact_id?: string | null;
            client_type?: string | null;
            classification?: string | null;
          }[],
        }),
    openClient ? requestQuery.eq("client_id", openClient) : requestQuery,
  ]);

  const { isHiddenFirmClient } = await import("@/whitbyos/lib/client-workspace");
  const visibleClients = (clients ?? []).filter((row) => !isHiddenFirmClient(row));

  // A provider's paperwork is filed against the company or the person it is,
  // which the enum has always allowed and this dialog has never offered — so
  // the Documents panel on every provider read "Nothing on file" with no way
  // to put anything there.
  const providers = await listProviderDocumentContexts();

  /*
   * With a client open, the client workspace is not offered: the document is
   * filed on that client either way, and §12.2 asks one optional question —
   * which Request, if any. Offering the client as a "link" made the answer
   * look like a choice between the client and its own work.
   */
  return [
    ...(openClient
      ? []
      : visibleClients.map((c) => ({
          value: `client:${c.id}`,
          label: `${c.name} (Workspace)`,
        }))),
    ...(requests ?? []).map((r) => ({
      value: `request:${r.id}`,
      label: `${r.title} (Request)`,
    })),
    ...providers.map((provider) => ({
      value: `${provider.contextType}:${provider.contextId}`,
      label: `${provider.name} (Provider)`,
    })),
  ];
}

export type DocumentDetail = DocumentRow & {
  /** The signing round trip (072), read with `readSignature`. */
  signature_required_from: string | null;
  signature_state: string | null;
  signature_note: string | null;
  signature_actioned_at: string | null;
  version: number;
  uploadedBy: string | null;
  /** Who put it in front of the professional, where that is someone else. */
  sharedBy: string | null;
  created_at: string;
};

/**
 * Screen 12.3 — one document, and everything recorded about it.
 *
 * Reachability is not worked out again here. `listDocuments` already decides
 * which documents this workspace can see, from the Clients, Requests and Work
 * Streams it owns, and asking that a second way is how two answers drift apart.
 * The row comes from that list, and an id that is not in it is not found.
 */
export async function getDocument(documentId: string): Promise<DocumentDetail | null> {
  const list = await listDocuments();
  if (!list.ok) return null;

  const summary = list.rows.find((row) => row.id === documentId);
  if (!summary) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select(
      "id, version, created_at, uploaded_by_user_id, shared_by_user_id, signature_required_from, signature_state, signature_note, signature_actioned_at",
    )
    .eq("id", documentId)
    .maybeSingle();

  const ids = [data?.uploaded_by_user_id, data?.shared_by_user_id].filter(
    (value): value is string => Boolean(value),
  );

  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, preferred_name, email")
      .in("id", [...new Set(ids)]);

    for (const user of users ?? []) {
      names.set(
        user.id as string,
        (user.preferred_name as string) ||
          (user.full_name as string) ||
          (user.email as string) ||
          "Someone",
      );
    }
  }

  return {
    ...summary,
    signature_required_from: (data?.signature_required_from as string | null) ?? null,
    signature_state: (data?.signature_state as string | null) ?? null,
    signature_note: (data?.signature_note as string | null) ?? null,
    signature_actioned_at: (data?.signature_actioned_at as string | null) ?? null,
    version: (data?.version as number) ?? 1,
    created_at: (data?.created_at as string) ?? summary.updated_at,
    uploadedBy: names.get(data?.uploaded_by_user_id as string) ?? null,
    sharedBy: names.get(data?.shared_by_user_id as string) ?? null,
  };
}

export { firstOf };

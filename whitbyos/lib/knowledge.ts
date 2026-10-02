import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

export type KnowledgeRow = {
  id: string;
  title: string;
  category: string | null;
  scope: string;
  /** Set on a client-scoped file: whose it is. Null on an organization one. */
  clientId: string | null;
  clientName: string | null;
  type: string;
  body: string | null;
  updatedAt: string;
};

export type KnowledgeResult =
  | { ok: true; rows: KnowledgeRow[] }
  | { ok: false; error: string };

/** The four categories screen 13.2 offers. */
export const KNOWLEDGE_CATEGORIES = [
  "Immigration",
  "Providers",
  "Internal Process",
  "Financial",
];

/*
 * Two scopes, and they mean different things now.
 *
 * "This Workspace" and "Organization" were both the firm's own library —
 * every row carries the firm's `workspace_id`, the list read them all, and
 * nothing treated one differently from the other. A choice that changes
 * nothing is worse than no choice: somebody files a client's visa notes under
 * "This Workspace" believing they are kept apart, and they are not.
 *
 * So the second one is the distinction the product needed (087):
 *
 *   organization → the practice's own knowledge, read while working on any
 *                  client.
 *   client       → about one client, shown while that client is open.
 *
 * There is no "both": an organization file is already available everywhere.
 */
export const KNOWLEDGE_SCOPES = [
  { value: "organization", label: "Organization" },
  { value: "client", label: "Workspace" },
];

export function scopeLabel(value: string | null) {
  return KNOWLEDGE_SCOPES.find((row) => row.value === value)?.label ?? "Organization";
}

/** Screen 13 — the Library. */
export async function listKnowledge(): Promise<KnowledgeResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [] };

  const supabase = await createClient();

  /*
   * The firm's library, plus the open client's own.
   *
   * With a client open, another client's notes are not part of the answer to
   * "what do we know that helps here". With none open the whole library is
   * shown, each client file wearing its client's name.
   */
  const openClient = await getOpenClientId();

  let query = supabase
    .from("whitbyos_knowledge")
    .select(
      "id, title, category, scope, client_id, type, body_or_file_url, updated_at, client:whitbyos_clients!client_id (name)",
    )
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .is("archived_at", null);

  if (openClient) query = query.or(`client_id.is.null,client_id.eq.${openClient}`);

  const { data, error } = await query;

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    rows: (data ?? []).map((row) => {
      const client = row.client as unknown as { name: string } | { name: string }[] | null;
      const named = Array.isArray(client) ? client[0] ?? null : client;

      return {
        id: row.id as string,
        title: row.title as string,
        category: (row.category as string | null) ?? null,
        // Anything written before 087 is the firm's own, which is how it has
        // always behaved.
        scope: (row.client_id as string | null) ? "client" : "organization",
        clientId: (row.client_id as string | null) ?? null,
        clientName: named?.name ?? null,
        type: (row.type as string) ?? "write",
        body: (row.body_or_file_url as string | null) ?? null,
        updatedAt: row.updated_at as string,
      };
    }),
  };
}

/** Screen 13.1 — one file. */
export async function getKnowledge(fileId: string): Promise<KnowledgeRow | null> {
  const result = await listKnowledge();
  if (!result.ok) return null;
  return result.rows.find((row) => row.id === fileId) ?? null;
}

/**
 * Knowledge Whitby may read while drafting for a client (or the firm).
 *
 * Organization articles always. A client's own only when that client is the
 * one being drafted for — never another client's notes mixed into the prompt.
 */
export async function listKnowledgeForDraft(
  clientId?: string | null,
): Promise<KnowledgeRow[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  let query = supabase
    .from("whitbyos_knowledge")
    .select(
      "id, title, category, scope, client_id, type, body_or_file_url, updated_at, client:whitbyos_clients!client_id (name)",
    )
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .is("archived_at", null);

  if (clientId) {
    query = query.or(`client_id.is.null,client_id.eq.${clientId}`);
  } else {
    // Firm work, or Ask across every client: only the practice's own library.
    query = query.is("client_id", null);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const client = row.client as unknown as { name: string } | { name: string }[] | null;
    const named = Array.isArray(client) ? client[0] ?? null : client;

    return {
      id: row.id as string,
      title: row.title as string,
      category: (row.category as string | null) ?? null,
      scope: (row.client_id as string | null) ? "client" : "organization",
      clientId: (row.client_id as string | null) ?? null,
      clientName: named?.name ?? null,
      type: (row.type as string) ?? "write",
      body: (row.body_or_file_url as string | null) ?? null,
      updatedAt: row.updated_at as string,
    };
  });
}

const BODY_CAP = 900;
const ARTICLE_CAP = 5;
const TOKEN_MIN = 4;

function scoreKnowledge(row: KnowledgeRow, about: string): number {
  const hay = [
    row.title,
    row.category ?? "",
    row.type === "write" ? (row.body ?? "") : "",
  ]
    .join(" ")
    .toLowerCase();

  const tokens = about
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= TOKEN_MIN);

  if (tokens.length === 0) return 0;

  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 1;
  }
  return score;
}

/**
 * Firm Knowledge rendered for a drafting prompt, the same shape as
 * `gmailContextLines`.
 *
 * Only articles that touch the work being drafted — dumping the whole library
 * into every prompt would drown the request in SOPs that do not apply. Written
 * bodies are included (trimmed); uploads contribute title and category only,
 * because the column holds a signed URL rather than text Whitby can read.
 */
export function knowledgeContextLines(
  rows: KnowledgeRow[],
  about: string,
): string | null {
  if (rows.length === 0 || !about.trim()) return null;

  const ranked = rows
    .map((row) => ({ row, score: scoreKnowledge(row, about) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, ARTICLE_CAP)
    .map((entry) => entry.row);

  if (ranked.length === 0) return null;

  const blocks = ranked.map((row) => {
    const where =
      row.scope === "client" && row.clientName
        ? ` (client: ${row.clientName})`
        : " (organization)";
    const shelf = row.category ? ` · ${row.category}` : "";

    if (row.type === "upload" || !row.body || /^https?:\/\//i.test(row.body)) {
      return `- "${row.title}"${shelf}${where}: uploaded file Whitby cannot read; treat the title as a hint that this topic is documented in the library.`;
    }

    const body =
      row.body.length > BODY_CAP
        ? `${row.body.slice(0, BODY_CAP).trim()}…`
        : row.body.trim();

    return `- "${row.title}"${shelf}${where}:\n  ${body.replace(/\n+/g, "\n  ")}`;
  });

  return [
    "\nFrom this firm's Knowledge Base (use where it applies to this work):",
    ...blocks,
    "Treat these as the firm's own standards and known facts. Prefer them over inventing process. Do not ask the client again for anything they already settle, and do not raise missing_info for a fact they establish. Where an article says the firm already holds or does something, set alreadyHeld true on the matching required input.",
  ].join("\n");
}

/** The one call a drafter makes: relevant Knowledge, ready for a prompt. */
export async function workspaceKnowledgeContext(
  about: string,
  clientId?: string | null,
): Promise<string | null> {
  const rows = await listKnowledgeForDraft(clientId);
  return knowledgeContextLines(rows, about);
}

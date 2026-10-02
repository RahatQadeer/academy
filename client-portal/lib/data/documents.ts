import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { readSignature } from "@/whitbyos/lib/signing";
import * as fixtures from "@/client-portal/lib/fixtures";
import type { PortalDocument, PortalDocumentStatus } from "@/client-portal/types";

type DocumentRow = {
  id: string;
  title: string;
  file_url: string;
  context_type: string;
  context_id: string;
  visibility: string;
  status: PortalDocumentStatus;
  version: number;
  created_at: string;
  /** When it stops being good — `documents.expires_at`, whitbyos/036. */
  expires_at: string | null;
  signed_date: string | null;
  signature_required_from: string | null;
  signature_state: string | null;
  signature_note: string | null;
  signature_actioned_at: string | null;
  shared_by_user_id: string | null;
  uploaded_by_user_id: string | null;
  document_labels: { label_text: string }[] | null;
};

/** How near an expiry has to be before a document asks to be replaced. */
const EXPIRING_DAYS = 30;

/**
 * What an `action_needed` document is actually asking for.
 *
 * The portal used to answer "Review" for all four cases, so a client was told
 * to review a document that had no file yet and to review an insurance
 * certificate that had run out. The four answers are the ones 21a's Needs
 * column draws, and this is deliberately the same derivation `neededAction`
 * in `whitbyos/lib/documents.ts` makes — the professional and the client must
 * not be told two different things about one row, and the answer is read off
 * the row rather than stored, so there is no second copy to disagree.
 *
 * Order matters. A document with no file cannot be signed or read. One that is
 * running out is replaced before it is read.
 *
 * Signing comes before both when the client is the side being asked: a
 * document sent for signature is asking for exactly one thing, and offering to
 * review it instead would hide the ask. That is read off `signature_state`
 * rather than guessed from `signed_date`, which only ever said whether a
 * signature existed and never who owed one.
 */
function neededAction(
  row: DocumentRow,
  now: Date,
): PortalDocument["actionType"] {
  // Being asked to sign outranks the status: the professional sends a document
  // for signature and that is the whole of what the row is for.
  if (
    row.signature_state === "awaiting" &&
    row.signature_required_from === "client" &&
    row.file_url?.trim()
  ) {
    return "sign";
  }

  if (row.status !== "action_needed") return null;

  // Expected but never provided: the row exists so the gap is visible.
  if (!row.file_url?.trim()) return "upload";

  if (row.expires_at) {
    const days = (new Date(row.expires_at).getTime() - now.getTime()) / 86_400_000;
    if (days <= EXPIRING_DAYS) return "update";
  }

  return row.signed_date ? "review" : "sign";
}

/**
 * Documents the client may see: `client_visible` items on their own client or
 * requests, plus anything they uploaded themselves. `internal` and `restricted`
 * never appear — SRS 13.9.5.
 */
/*
 * Cached for the length of one request.
 *
 * Home composes Recent Activity from every area's reader while Action Needed
 * composes from three of the same ones, so an uncached read meant the same
 * rows fetched twice on one render. `cache()` is per-request, which is exactly
 * the lifetime wanted: within a render everybody sees one answer, and the next
 * request reads the table again.
 */
export const listDocuments = cache(async (): Promise<PortalDocument[]> => {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.DOCUMENTS;
  // The area gate, at the read boundary. RLS scopes these rows to the client
  // *account*; `permissions` decides which of the people on that account may
  // see them, and this is the one place every screen, count and preview of
  // a document passes through.
  if (!ctx.areas.documents) return [];

  const supabase = await createClient();

  const { data: requestRows } = await supabase
    .from("whitbyos_requests")
    .select("id, title")
    .eq("client_id", ctx.clientId!);

  const requestTitles = new Map(
    (requestRows ?? []).map((row) => [row.id as string, row.title as string]),
  );
  const contextIds = [ctx.clientId!, ...requestTitles.keys()];

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, title, file_url, context_type, context_id, visibility, status, version, created_at, expires_at, signed_date, signature_required_from, signature_state, signature_note, signature_actioned_at, shared_by_user_id, uploaded_by_user_id, document_labels(label_text)",
    )
    .in("context_id", contextIds)
    .eq("visibility", "client_visible")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // One clock for the whole list, so two documents expiring the same day
  // cannot land on different sides of the threshold mid-render.
  const now = new Date();

  return (data as unknown as DocumentRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    actionType: neededAction(row, now),
    signature: readSignature(row),
    expiresAt: row.expires_at,
    labels: (row.document_labels ?? []).map((label) => label.label_text),
    // A document hangs off either the client or one Request; `context_id` is
    // the Request's id in the second case, which is what makes it selectable
    // by identity rather than by matching its Request's title.
    requestId: requestTitles.has(row.context_id) ? row.context_id : null,
    requestTitle: requestTitles.get(row.context_id) ?? null,
    sharedByName: null,
    sharedAt: row.created_at,
    version: row.version,
    fileUrl: row.file_url,
    sizeLabel: null,
  }));
});

export function filterDocuments(
  documents: PortalDocument[],
  tab: "all" | "action-needed" | "labels" | "archived",
) {
  if (tab === "action-needed") {
    return documents.filter((doc) => doc.status === "action_needed");
  }
  if (tab === "archived") {
    return documents.filter((doc) => doc.status === "archived");
  }
  // "all" and the label view both exclude archived; Labels groups them instead.
  return documents.filter((doc) => doc.status !== "archived");
}

export function groupByLabel(documents: PortalDocument[]) {
  const groups = new Map<string, PortalDocument[]>();
  for (const doc of documents) {
    const labels = doc.labels.length > 0 ? doc.labels : ["Unlabeled"];
    for (const label of labels) {
      const bucket = groups.get(label) ?? [];
      bucket.push(doc);
      groups.set(label, bucket);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

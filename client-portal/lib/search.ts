import { listDocuments } from "@/client-portal/lib/data/documents";
import { listForms } from "@/client-portal/lib/data/forms";
import { listRequests } from "@/client-portal/lib/data/requests";
import { listThreads } from "@/client-portal/lib/data/messages";

import type { PortalSearchHit } from "@/client-portal/lib/search-vocab";

/**
 * Search across the four portal areas that hold a list.
 *
 * Filtered in memory rather than in SQL, deliberately. Every one of these
 * readers is already the screen's own query — RLS-scoped to this client,
 * area-gated by `ctx.areas`, and cached for the life of the request — so
 * reusing them means a row can never appear in search that the screen it
 * belongs to would have refused to show. A `.ilike` per table would be four
 * new query paths to keep in step with four sets of visibility rules, for
 * result sets that are a client's own handful of rows.
 *
 * The area gate comes free with that: `listForms` returns `[]` when Forms is
 * not granted, so a person who cannot open Forms cannot find one here either.
 */
export async function searchPortal(query: string): Promise<PortalSearchHit[]> {
  const typed = query.trim().toLowerCase();
  if (typed.length < 2) return [];

  const [requests, forms, documents, threads] = await Promise.all([
    listRequests().catch(() => []),
    listForms().catch(() => []),
    listDocuments().catch(() => []),
    listThreads().catch(() => []),
  ]);

  const hits: PortalSearchHit[] = [
    ...requests.map((row) => ({
      kind: "Request" as const,
      id: row.id,
      label: row.title,
      detail: row.description ?? undefined,
      href: `/client-portal/requests/${row.id}`,
    })),
    ...forms.map((row) => ({
      kind: "Form" as const,
      id: row.id,
      label: row.title,
      detail: row.requestTitle ?? undefined,
      href: `/client-portal/forms/${row.id}`,
    })),
    ...documents.map((row) => ({
      kind: "Document" as const,
      id: row.id,
      label: row.title,
      href: `/client-portal/documents`,
    })),
    ...threads.map((row) => ({
      kind: "Message" as const,
      id: row.id,
      label: row.subject,
      detail: row.preview ?? undefined,
      href: `/client-portal/messages?thread=${row.id}`,
    })),
  ];

  const matches = hits.filter(
    (hit) =>
      hit.label.toLowerCase().includes(typed) ||
      (hit.detail?.toLowerCase().includes(typed) ?? false),
  );

  /*
   * A title match beats a match buried in a description.
   *
   * Without this, typing a request's name can put four documents that merely
   * mention it above the request itself, because the arrays are concatenated in
   * a fixed order and nothing else re-orders them.
   */
  return matches
    .sort((a, b) => rank(a, typed) - rank(b, typed))
    .slice(0, 20);
}

function rank(hit: PortalSearchHit, typed: string): number {
  const label = hit.label.toLowerCase();
  if (label.startsWith(typed)) return 0;
  if (label.includes(typed)) return 1;
  return 2;
}

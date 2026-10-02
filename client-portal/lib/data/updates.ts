import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import type { ProgressUpdate } from "@/client-portal/types";

type UpdateRow = {
  id: string;
  request_id: string | null;
  type: string;
  /** whitbyos/026 — the title, what kind of update it is, and how urgent. */
  headline: string | null;
  category: string | null;
  urgent: boolean | null;
  body: string;
  status: string;
  published_at: string | null;
  created_at: string;
  whitbyos_requests: { title: string } | null;
};

/** Only `published` updates reach the client — draft and review are internal. */
/*
 * Cached for the length of one request.
 *
 * Home composes Recent Activity from every area's reader while Action Needed
 * composes from three of the same ones, so an uncached read meant the same
 * rows fetched twice on one render. `cache()` is per-request, which is exactly
 * the lifetime wanted: within a render everybody sees one answer, and the next
 * request reads the table again.
 */
export const listUpdates = cache(async (): Promise<ProgressUpdate[]> => {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.PROGRESS_UPDATES;
  // The area gate, at the read boundary. RLS scopes these rows to the client
  // *account*; `permissions` decides which of the people on that account may
  // see them, and this is the one place every screen, count and preview of
  // an update passes through.
  if (!ctx.areas.updates) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whitbyos_updates")
    .select(
      "id, request_id, type, headline, category, urgent, body, status, published_at, created_at, whitbyos_requests(title)",
    )
    .eq("client_id", ctx.clientId!)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as UpdateRow[]).map((row) => ({
    id: row.id,
    requestId: row.request_id,
    requestTitle: row.whitbyos_requests?.title ?? null,
    headline: row.headline,
    category: row.category,
    urgent: row.urgent === true,
    body: row.body,
    authorName: "Your team",
    publishedAt: row.published_at ?? row.created_at,
    type: row.type === "plans_update" ? "plans_update" : "progress_update",
    needsFollowUp: false,
  }));
});

export async function listProgressUpdates(): Promise<ProgressUpdate[]> {
  return (await listUpdates()).filter((item) => item.type === "progress_update");
}

export async function listPlansUpdates(): Promise<ProgressUpdate[]> {
  return (await listUpdates()).filter((item) => item.type === "plans_update");
}

export async function listNeedsFollowUp(): Promise<ProgressUpdate[]> {
  return (await listUpdates()).filter((item) => item.needsFollowUp);
}

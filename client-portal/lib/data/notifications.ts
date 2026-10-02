import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import { NOTIFICATION_EVENTS } from "@/client-portal/types";
import type { NotificationEvent, NotificationPref } from "@/client-portal/types";
import type { Notice } from "@/whitbyos/lib/notifications";

export const EVENT_LABEL: Record<NotificationEvent, string> = {
  new_message: "New message",
  progress_update: "Progress update",
  action_needed: "Action needed",
  form_requested: "Form requested",
  document_shared: "Document shared",
  approval_requested: "Approval requested",
  calendar_change: "Calendar change",
  request_status_change: "Request status change",
  invoice_payment_event: "Invoice or payment event",
};

/**
 * `client_portal_notification_prefs` is owned by this module, so this is a real
 * read/write path today. Rows are sparse: an absent row means the account
 * default (on), which is why we merge onto the full event list rather than
 * rendering only what the table returns.
 */
export async function listNotificationPrefs(): Promise<NotificationPref[]> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.NOTIFICATION_PREFS;

  const supabase = await createClient();
  const { data } = await supabase
    .from("client_portal_notification_prefs")
    .select("event_type, channel, enabled")
    .eq("contact_id", ctx.contactId!)
    .eq("channel", "email");

  const stored = new Map(
    (data ?? []).map((row) => [row.event_type as string, row.enabled as boolean]),
  );

  return NOTIFICATION_EVENTS.map((event) => ({
    event,
    channel: "email" as const,
    enabled: stored.get(event) ?? true,
  }));
}

/**
 * What the portal's bell holds: the `whitbyos_notifications` rows addressed to
 * the contact this login is. `whitbyos_notifications_portal` (whitbyos/052)
 * reaches exactly those and nothing else.
 *
 * The same `Notice` shape Whitby's bell draws, so the one bell serves both.
 *
 * A link is kept only if it points into the portal. A deletion ask is written
 * with the professional's own address for the record, and a client following
 * a /whitbyos link lands on a product they have no way into.
 */
export async function listPortalNotices(limit = 20): Promise<Notice[]> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo" || !ctx.contactId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_notifications")
    .select(
      "id, kind, title, body, href, created_at, read_at, deletion_request_id, request:whitbyos_deletion_requests!deletion_request_id (status)",
    )
    .eq("recipient_contact_id", ctx.contactId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const request = Array.isArray(row.request) ? row.request[0] : row.request;
    const status = (request as { status?: string } | null)?.status ?? null;
    const href = (row.href as string | null) ?? null;

    return {
      id: row.id as string,
      kind: row.kind as string,
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      href: href?.startsWith("/client-portal") ? href : null,
      createdAt: row.created_at as string,
      read: Boolean(row.read_at),
      deletionRequestId: (row.deletion_request_id as string | null) ?? null,
      decided: status !== null && status !== "pending",
    };
  });
}

import "server-only";

import { createClient } from "@/base/lib/supabase/server";

/**
 * Writing a Request's history — SRS §6.14.4.
 *
 * `whitbyos_timeline_events` has been read in four places since it was built —
 * the Request, the Client, a Contact and a Provider all draw their history out
 * of it — and written in none. Every timeline in the product therefore said
 * "Nothing has happened yet" forever, on workspaces where a great deal had.
 *
 * The table is Request-scoped by its own schema: `request_id` is not null, and
 * the RLS policy reaches the workspace through the Request. That is the design
 * rather than a limitation — §6.14.4 says there is no global client timeline,
 * and a Client's history is its Requests' events gathered up. So everything
 * recorded here belongs to a Request, and the other three screens read it by
 * asking for their Requests' events.
 *
 * Best effort, always. A history that fails to be written must not take down
 * the thing that was actually being done: closing a Request is the point, and
 * the line about closing it is the record.
 */
export const TIMELINE_EVENT = {
  requestOpened: "request_opened",
  requestUpdated: "request_updated",
  requestClosed: "request_closed",
  requestReopened: "request_reopened",
  planActivated: "plan_activated",
  noteAdded: "note_added",
  providerAdded: "provider_added",
  documentAdded: "document_added",
  /* A provider's own history, which used to be the Requests it appeared on
     and nothing else — so a provider never used on one had none. */
  providerUpdated: "provider_updated",
  personAdded: "person_added",
  contactSet: "contact_set",
} as const;

export type TimelineEventType = (typeof TIMELINE_EVENT)[keyof typeof TIMELINE_EVENT];

export async function recordTimelineEvent(input: {
  /** One of these two. A line belongs to a Request, or to a provider. */
  requestId?: string | null;
  providerId?: string | null;
  eventType: TimelineEventType;
  /** One line, in the past tense, as the screens print it. */
  description: string;
  /** Where it came from, when that is worth keeping — a document id, a link. */
  sourceReference?: string | null;
  /**
   * Whether the client may see this line.
   *
   * Defaults to false. The Client Portal reads these rows, and a history that
   * leaks internal shortlisting the moment it starts being written would be a
   * worse fault than the empty one being fixed. Each caller opts a line in.
   */
  clientVisible?: boolean;
}): Promise<void> {
  try {
    if (!input.requestId && !input.providerId) return;

    const supabase = await createClient();
    await supabase.from("whitbyos_timeline_events").insert({
      request_id: input.requestId ?? null,
      provider_id: input.providerId ?? null,
      event_type: input.eventType,
      description: input.description,
      source_reference: input.sourceReference ?? null,
      client_visible: input.clientVisible === true,
    });
  } catch {
    // See above: the record is not the work.
  }
}

import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

/**
 * Which of Whitby's own screens are holding something nobody has looked at.
 *
 * The bell already says a submission arrived, and a bell notice is read once
 * and gone. What a client sends sits in a queue until somebody opens it, and
 * "there is something in the queue" is a standing fact, not an event — so it
 * belongs on the nav, where it is visible from whatever screen the
 * professional happens to be on.
 *
 * Booleans, with one exception. A queue is a standing fact and a dot says all
 * there is to say about it — but messages are counted, because "three people
 * are waiting on you" is a different morning from "one is", and a chat that
 * cannot say how many is a chat nobody trusts. It is counted the same way the
 * inbox counts it, off the same tables, so the two can never disagree.
 *
 * Best effort. A dot that cannot be worked out must not take the page with it.
 */
export const whitbyWaiting = cache(async function whitbyWaiting(): Promise<{
  forms: boolean;
  clients: boolean;
  messages: number;
}> {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) return { forms: false, clients: false, messages: 0 };

    const supabase = await createClient();

    /*
     * Three separate questions, asked at once.
     *
     * This runs on every screen in the product and none of the three needs
     * either of the others, so asking them in turn spent three round trips on
     * the marks in a sidebar — before the screen somebody actually asked for
     * had started loading.
     *
     * `cache` for the same reason: the layout is rendered once per navigation
     * but a page that asks again gets the answer already in hand.
     */
    /*
     * The marks count the workspace somebody is standing in.
     *
     * They counted every client's work, so inside one client's workspace a
     * dot pointed at a screen that then showed nothing for that client —
     * the mark said "there is something here" and the screen said there
     * was not, which teaches people to stop believing the marks.
     */
    const openClient = await getOpenClientId();

    const [messages, clients, forms] = await Promise.all([
      unreadMessages(supabase, workspaceId, openClient),
      /*
       * A client asking for somebody to be given access is the other standing
       * queue in this product, and it had no mark at all: the panel that
       * answers it lives on one client's Contacts tab, so a request waited
       * there until somebody opened that tab for another reason. The bell says
       * it arrived; this says it is still waiting.
       */
      pendingAccessRequests(supabase, workspaceId, openClient),
      waitingSubmissions(supabase, workspaceId, openClient),
    ]);

    return { forms, clients, messages };
  } catch {
    return { forms: false, clients: false, messages: 0 };
  }
});

/**
 * Anything a client has sent on a form that nobody has ruled on.
 *
 * A submission belongs to a form and the form has the workspace — the same
 * route `listSubmissions` takes, because a submission has no workspace of its
 * own. An `awaiting` one is waiting on them and an `accepted` one is
 * finished; neither is work sitting in anybody's queue here.
 */
async function waitingSubmissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  openClient: string | null,
): Promise<boolean> {
  const { data: forms } = await supabase
    .from("whitbyos_forms")
    .select("id")
    .eq("workspace_id", workspaceId);

  const ids = (forms ?? []).map((row) => row.id as string);
  if (ids.length === 0) return false;

  let query = supabase
    .from("whitbyos_form_submissions")
    .select("id", { count: "exact", head: true })
    .in("form_id", ids)
    .in("status", ["submitted", "needs_review"]);

  // The submission carries the client, not the form: one form is sent to
  // many, which is the whole point of a template.
  if (openClient) query = query.eq("client_id", openClient);

  const { count } = await query;

  return (count ?? 0) > 0;
}

/**
 * How much has been said to this person that they have not read.
 *
 * Messages, not conversations: the rail already says which chats are bold,
 * and the number on the nav answers the other question — how much is actually
 * waiting. Counted exactly as `listThreads` counts unread, so the nav and the
 * inbox cannot tell two stories: a message is unread when somebody else sent
 * it after this reader last opened the thread it is in.
 *
 * Archived is left out, because a conversation put away is not in the inbox
 * the number sits above.
 */
async function unreadMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  openClient: string | null,
): Promise<number> {
  const profile = await getSessionProfile();
  if (!profile) return 0;

  const me = profile.user.id;

  let threadQuery = supabase
    .from("whitbyos_message_threads")
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null);

  // The same rule the inbox itself follows: this client's conversations, and
  // the ones that belong to nobody.
  if (openClient) {
    threadQuery = threadQuery.or(`client_id.eq.${openClient},client_id.is.null`);
  }

  const { data: threads } = await threadQuery;

  const ids = (threads ?? []).map((row) => row.id as string);
  if (ids.length === 0) return 0;

  const { data: people } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id, participant_type, participant_id, last_read_at")
    .in("thread_id", ids)
    .is("removed_at", null);

  /** When I last opened each thread I am on. */
  const readAt = new Map<string, string | null>();
  /** Threads with any professional on them at all — see `readableBy`. */
  const staffOn = new Set<string>();

  for (const row of people ?? []) {
    const threadId = row.thread_id as string;
    if (row.participant_type === "user") staffOn.add(threadId);
    if (row.participant_type === "user" && row.participant_id === me) {
      readAt.set(threadId, (row.last_read_at as string | null) ?? null);
    }
  }

  /* A conversation is the people in it — 090 — with the one exception the
     inbox makes: a thread a client started names no professional until one
     opens it, and it has to reach somebody's nav before that. */
  const visible = ids.filter((id) => readAt.has(id) || !staffOn.has(id));
  if (visible.length === 0) return 0;

  /* Nothing read before the earliest mark can be unread, so the database is
     asked for rather less than every message in the workspace. A thread never
     opened has no mark, and then there is no floor to ask under. */
  const marks = visible.map((id) => readAt.get(id) ?? null);
  const earliest = marks.every(Boolean)
    ? (marks as string[]).slice().sort()[0]
    : null;

  let query = supabase
    .from("whitbyos_messages")
    .select("thread_id, sender_id, created_at")
    .in("thread_id", visible)
    .neq("status", "draft");

  if (earliest) query = query.gt("created_at", earliest);

  const { data: rows } = await query;

  return (rows ?? []).filter((row) => {
    if (row.sender_id === me) return false;
    const mark = readAt.get(row.thread_id as string) ?? null;
    return !mark || new Date(row.created_at as string) > new Date(mark);
  }).length;
}

/** Any client of this workspace with an unanswered access request. */
async function pendingAccessRequests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  openClient: string | null,
): Promise<boolean> {
  const { data: clients } = await supabase
    .from("whitbyos_clients")
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null);

  const ids = (clients ?? [])
    .map((row) => row.id as string)
    // One client's workspace answers for one client.
    .filter((id) => !openClient || id === openClient);
  if (ids.length === 0) return false;

  const { count } = await supabase
    .from("client_portal_access_requests")
    .select("id", { count: "exact", head: true })
    .in("client_id", ids)
    .eq("status", "pending");

  return (count ?? 0) > 0;
}

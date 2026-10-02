import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { properName } from "@/client-portal/lib/format";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import { portalAvatarUrl } from "@/client-portal/lib/data/avatars";
import type { MessageThread, PortalMessage } from "@/client-portal/types";
import {
  formatSystemNotice,
  parseSystemNotice,
} from "@/whitbyos/lib/message-system";

type ParticipantRow = {
  thread_id: string;
  history_visibility: string | null;
  added_at: string;
  removed_at: string | null;
  locked: boolean | null;
  last_read_at: string | null;
};

/**
 * A thread carries its own subject since whitbyos/014. WhitbyOS can start one
 * with no Request on it at all, so the Request's title is a fallback now rather
 * than the source.
 */
type ThreadRow = {
  id: string;
  subject: string | null;
  /**
   * `direct` or `group`, as Whitby set it (whitbyos/014). Read rather than
   * worked out: the portal used to call anything with more than one other
   * person a group, which disagrees with Whitby in both directions — a group
   * of two reads as a direct conversation, and a direct one with a second
   * professional on it reads as a group. One conversation, one answer.
   */
  kind: string | null;
  request_id: string | null;
  whitbyos_requests: { title: string } | null;
};

const PARTICIPANT_COLUMNS =
  "thread_id, history_visibility, added_at, removed_at, locked, last_read_at";

const MESSAGE_COLUMNS =
  "id, thread_id, request_id, sender_type, sender_id, body, source, created_at, delivered_at, whitbyos_requests(title)";

/**
 * When everybody else on a thread had last opened it.
 *
 * The earliest of their `last_read_at`, so one person who has not looked holds
 * the whole thread at delivered — a message is read when it has been read by
 * everyone it went to. Anyone who has never opened it makes the answer null
 * rather than a date in the distant past. The same rule `getThread()` in
 * `whitbyos/lib/messages.ts` applies from the other side, so the two ends of
 * one conversation never disagree about a tick.
 */
function earliestRead(times: (string | null)[]): string | null {
  if (times.length === 0 || times.some((at) => !at)) return null;
  return times.reduce((earliest, at) =>
    !earliest || new Date(at as string) < new Date(earliest) ? at : earliest,
  ) as string;
}

/**
 * One person on one thread, from `portal_thread_people` (client-portal/004).
 *
 * A name is the one thing the portal cannot read directly. `users`, `contacts`
 * and `companies` are all closed to a client — deliberately, since RLS grants a
 * whole row and `public.users` carries `password_hash`, `phone` and `email` — so
 * the names arrive through a security-definer function that returns nothing but
 * the display string.
 *
 * `is_participant` separates the two reasons a person is here: on the thread
 * now (the roster the header lists), or merely the author of something in it and
 * since removed (needed so their messages are still attributed).
 */
type PersonRow = {
  thread_id: string;
  party_type: "user" | "contact" | "company";
  party_id: string;
  display_name: string;
  /**
   * A professional's photo (client-portal/015). Null for a contact, whose
   * photo is not a column anywhere — the portal writes it to
   * `avatars/<contact id>/photo` and the path's existence is the record, which
   * is signed on the way out rather than selected.
   */
  photo_url: string | null;
  is_participant: boolean;
};

const personKey = (type: string, id: string) => `${type}:${id}`;

/*
 * Names are capitalised here, once, rather than by each screen that draws one
 * — the rule `portal-context.ts` already applies to the reader's own name.
 *
 * A professional is named by whoever set their account up in Whitby, and one
 * entered as "professional" led its conversation in the rail, its header and
 * every message it sent in lowercase.
 */
async function threadPeople(
  supabase: Awaited<ReturnType<typeof createClient>>,
  threadIds: string[],
): Promise<PersonRow[]> {
  if (threadIds.length === 0) return [];
  const { data } = await supabase.rpc("portal_thread_people", {
    p_thread_ids: threadIds,
  });
  return ((data ?? []) as PersonRow[]).map((person) => ({
    ...person,
    display_name: properName(person.display_name),
  }));
}

type MessageRow = {
  id: string;
  thread_id: string;
  request_id: string | null;
  sender_type: string;
  sender_id: string;
  body: string;
  source: string | null;
  created_at: string;
  /** whitbyos/035 — when it reached the other side. Null until it has. */
  delivered_at: string | null;
  whitbyos_requests: { title: string } | null;
};

/** Threads the client is an explicit participant in — never all client threads. */
/*
 * Cached for the length of one request.
 *
 * Home composes Recent Activity from every area's reader while Action Needed
 * composes from three of the same ones, so an uncached read meant the same
 * rows fetched twice on one render. `cache()` is per-request, which is exactly
 * the lifetime wanted: within a render everybody sees one answer, and the next
 * request reads the table again.
 */
export const listThreads = cache(async (): Promise<MessageThread[]> => {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.THREADS;
  // The area gate, at the read boundary. RLS scopes these rows to the client
  // *account*; `permissions` decides which of the people on that account may
  // see them, and this is the one place every screen, count and preview of
  // a thread passes through.
  if (!ctx.areas.messages) return [];

  const supabase = await createClient();
  const { data: participation } = await supabase
    .from("whitbyos_message_participants")
    .select(PARTICIPANT_COLUMNS)
    .eq("participant_type", "contact")
    .eq("participant_id", ctx.contactId!)
    .is("removed_at", null);

  const rows = (participation ?? []) as ParticipantRow[];
  if (rows.length === 0) return [];

  const threadIds = rows.map((row) => row.thread_id);

  const { data: threadData } = await supabase
    .from("whitbyos_message_threads")
    .select("id, subject, kind, request_id, whitbyos_requests(title)")
    .in("id", threadIds);

  const threads = new Map(
    ((threadData ?? []) as unknown as ThreadRow[]).map((row) => [row.id, row]),
  );

  const [{ data: messages }, people] = await Promise.all([
    supabase
      .from("whitbyos_messages")
      .select(MESSAGE_COLUMNS)
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
    threadPeople(supabase, threadIds),
  ]);

  // Everyone else's read state on each thread, for the ticks on the client's
  // own messages. Read from the participants table directly rather than from
  // `portal_thread_people`, which returns names and no timestamps.
  const { data: allParticipants } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id, participant_id, last_read_at")
    .in("thread_id", threadIds)
    .is("removed_at", null);

  const otherReads = new Map<string, (string | null)[]>();
  for (const row of allParticipants ?? []) {
    if ((row.participant_id as string) === ctx.contactId) continue;
    const threadId = row.thread_id as string;
    const list = otherReads.get(threadId) ?? [];
    list.push((row.last_read_at as string | null) ?? null);
    otherReads.set(threadId, list);
  }

  // Everyone on the thread but the reader — the list and the header both name a
  // conversation by who else is in it, and "You" is added by the view so it
  // always reads last.
  const participantsByThread = new Map<string, string[]>();
  // One other person means one face on the row. Several means a group, and
  // nobody's photo stands for all of them.
  const faceByThread = new Map<string, string | null>();
  for (const person of people) {
    if (!person.is_participant) continue;
    if (person.party_type === "contact" && person.party_id === ctx.contactId) continue;
    const bucket = participantsByThread.get(person.thread_id) ?? [];
    bucket.push(person.display_name);
    participantsByThread.set(person.thread_id, bucket);
    faceByThread.set(
      person.thread_id,
      bucket.length === 1 ? person.photo_url : null,
    );
  }

  // `portal_thread_people` has no ORDER BY — a set-returning function is under
  // no obligation to be stable between calls, and a thread row whose names
  // reshuffle on every render is its own bug. Sorted here rather than in SQL so
  // it collates the same way as everything else the portal sorts.
  for (const names of participantsByThread.values()) {
    names.sort((a, b) => a.localeCompare(b));
  }

  const byThread = new Map<string, MessageRow[]>();
  for (const message of (messages ?? []) as unknown as MessageRow[]) {
    const bucket = byThread.get(message.thread_id) ?? [];
    bucket.push(message);
    byThread.set(message.thread_id, bucket);
  }

  return rows
    .map((row) => {
      const visible = visibleMessages(byThread.get(row.thread_id) ?? [], row);
      const latest = visible[0];
      const thread = threads.get(row.thread_id);

      // The thread's own subject first, the linked Request's title next, and
      // only then the generic word — a thread started without a Request has a
      // real name and used to render as "Conversation".
      const requestTitle =
        thread?.whitbyos_requests?.title ?? latest?.whitbyos_requests?.title ?? null;
      const subject = thread?.subject?.trim() || requestTitle || "Conversation";

      return {
        id: row.thread_id,
        subject,
        kind: thread?.kind === "group" ? ("group" as const) : ("direct" as const),
        requestId: thread?.request_id ?? latest?.request_id ?? null,
        requestTitle,
        lastMessageAt: latest?.created_at ?? row.added_at,
        unread: isUnread(visible, row, ctx.contactId!),
        participants: participantsByThread.get(row.thread_id) ?? [],
        preview: (() => {
          if (!latest) return "";
          const notice = parseSystemNotice(latest.body, latest.source);
          if (!notice) return latest.body.slice(0, 140);
          const actor =
            people.find(
              (person) =>
                person.thread_id === row.thread_id &&
                person.party_type === latest.sender_type &&
                person.party_id === latest.sender_id,
            )?.display_name ?? "Your team";
          return formatSystemNotice(notice, actor, false).slice(0, 140);
        })(),
        locked: row.locked === true,
        othersReadAt: earliestRead(otherReads.get(row.thread_id) ?? []),
        lastMine: latest?.sender_id === ctx.contactId,
        counterpartyPhoto: faceByThread.get(row.thread_id) ?? null,
      } satisfies MessageThread;
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
});

/**
 * Unread is `last_read_at` on the participant row — the same column WhitbyOS
 * keeps this state in, rather than a second one meaning the same thing.
 *
 * The client's own messages never count: sending is reading. A thread never
 * opened has no `last_read_at` at all, so anything from the other side is
 * unread.
 */
function isUnread(
  visible: MessageRow[],
  participant: ParticipantRow,
  contactId: string,
): boolean {
  const fromTeam = visible.filter((message) => message.sender_id !== contactId);
  if (fromTeam.length === 0) return false;
  if (!participant.last_read_at) return true;
  // `visible` is newest-first, so the head is the latest thing said to them.
  return fromTeam[0].created_at > participant.last_read_at;
}

export async function listMessages(threadId: string): Promise<PortalMessage[]> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.MESSAGES[threadId] ?? [];
  // The area gate, at the read boundary. RLS scopes these rows to the client
  // *account*; `permissions` decides which of the people on that account may
  // see them, and this is the one place every screen, count and preview of
  // a message passes through.
  if (!ctx.areas.messages) return [];

  const supabase = await createClient();
  const { data: participation } = await supabase
    .from("whitbyos_message_participants")
    .select(PARTICIPANT_COLUMNS)
    .eq("participant_type", "contact")
    .eq("participant_id", ctx.contactId!)
    .eq("thread_id", threadId)
    .is("removed_at", null)
    .maybeSingle();

  if (!participation) return [];

  const [{ data }, people, myPhoto] = await Promise.all([
    supabase
      .from("whitbyos_messages")
      .select(MESSAGE_COLUMNS)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true }),
    threadPeople(supabase, [threadId]),
    portalAvatarUrl(ctx.contactId),
  ]);

  const names = new Map(
    people.map((person) => [
      personKey(person.party_type, person.party_id),
      person.display_name,
    ]),
  );

  const photos = new Map(
    people.map((person) => [
      personKey(person.party_type, person.party_id),
      person.photo_url,
    ]),
  );

  return visibleMessages(
    (data ?? []) as unknown as MessageRow[],
    participation as ParticipantRow,
  ).map((row) => {
    const authoredByMe = row.sender_id === ctx.contactId;
    const authorName = names.get(personKey(row.sender_type, row.sender_id)) ?? "Your team";
    const notice = parseSystemNotice(row.body, row.source);

    return {
      id: row.id,
      threadId: row.thread_id,
      body: notice ? formatSystemNotice(notice, authorName, false) : row.body,
      // The author's real name, so the client can tell one professional from
      // another. "Your team" survives only as the fallback for a teammate with no
      // name set on their account — an email address is never shown for one.
      authorName,
      // Their own face beside what they wrote — and the reader's own, which the
      // function cannot answer for, from the bucket the portal keeps it in.
      authorPhoto: authoredByMe
        ? myPhoto
        : (photos.get(personKey(row.sender_type, row.sender_id)) ?? null),
      authorIsMe: authoredByMe,
      sentAt: row.created_at,
      deliveredAt: row.delivered_at,
      system: Boolean(notice),
    };
  });
}

/**
 * SRS 13.6.4 — a participant added with `from_added` history sees only messages
 * sent after they joined. Applied here as well as in RLS.
 */
function visibleMessages(messages: MessageRow[], participant: ParticipantRow) {
  if (participant.history_visibility !== "from_added") return messages;
  return messages.filter((message) => message.created_at >= participant.added_at);
}

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { groupConversationThreadIds, groupPhotos, photosFor } from "@/whitbyos/lib/people-photos";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { fold, onRequest } from "@/whitbyos/lib/message-fold";
import {
  formatSystemNotice,
  parseSystemNotice,
} from "@/whitbyos/lib/message-system";

export type ThreadKind = "direct" | "group";

/**
 * Who can see a conversation — 090, and it is not a setting any more.
 *
 * The people who were put in it, and nobody else. A teammate who was not
 * added has no more business in a group than in somebody's direct messages.
 *
 * One exception that is not really one: a thread a client started from the
 * portal is addressed to the firm and has no professional on it at all, so it
 * stays visible to the team until somebody opens it and is joined to it —
 * otherwise it would arrive in nobody's inbox.
 */
function readableBy(onIt: boolean, anyStaffOn: boolean) {
  return onIt || !anyStaffOn;
}
export type MessageFilter = "all" | "unread" | "request" | "drafts" | "archived";

export type ThreadRow = {
  id: string;
  subject: string;
  kind: ThreadKind;
  counterparty: string;
  preview: string;
  lastAt: string | null;
  unread: boolean;
  /**
   * How much of it has not been read — the number on the row, the way a chat
   * list carries one. Counted over every thread the conversation is folded
   * from, because the row stands for all of them.
   */
  unreadCount: number;
  /**
   * Which thread opening the row opens.
   *
   * Where something is waiting, the thread it was said in: a reply about the
   * Ontario permit is read on the Ontario permit, not on a General thread
   * that has nothing new in it. Otherwise the conversation itself.
   */
  openAt: string;
  /** Whether the last thing said was yours — the row draws ticks only then. */
  lastMine: boolean;
  /** And whether everyone else has opened the thread since. */
  lastRead: boolean;
  /** Its newest message is unsent, which is how the list marks it. */
  draft: boolean;
  requestId: string | null;
  requestTitle: string | null;
  clientId: string | null;
  clientName: string | null;
  participantCount: number;
  /** Everyone but you, for the stacked avatars 9.4 puts on a group row. */
  people: Person[];
  /** The one other person's photo, on a direct row. Null on a group. */
  counterpartyPhoto: string | null;
  /** A group's own picture, where somebody has given it one. */
  photo: string | null;
  /** Put away — 089. Out of the rail, and read from Archived beside it. */
  archived: boolean;
  /**
   * Nothing has ever been written in it, sent or unsent.
   *
   * Such a thread is not a conversation and is not listed as one — but it can
   * be the General thread of a conversation that is, which is why `fold`
   * needs to be told rather than the row being dropped before it.
   */
  empty: boolean;
  /**
   * The threads read as this one conversation: itself, and every other general
   * conversation with the same person. See `fold`.
   */
  mergedIds: string[];
  /**
   * The Request conversations held inside this one, newest first.
   *
   * A row in the rail is a person. What was said about one piece of work is a
   * thread within them rather than a second row wearing the same face.
   */
  children: ThreadRow[];
};

export type Person = {
  /** The row this person is, so a settings panel can take them off it. */
  id: string;
  /** How the participant table names them, which is not how people do. */
  participantType: "contact" | "company" | "user";
  name: string;
  kind: "contact" | "provider" | "teammate";
  /** Their own photo, signed where it lives in a private bucket. */
  photo: string | null;
};

export type Attachment = {
  id: string;
  fileName: string;
  /** An image is shown rather than linked, so the kind has to travel with it. */
  mimeType: string | null;
  sizeBytes: number | null;
  /** Signed and short-lived — the bucket is private, so there is no other URL. */
  href: string | null;
};

export type MessageRow = {
  id: string;
  body: string;
  senderName: string;
  /** Whose face goes beside it. Initials are the fallback, not the default. */
  senderPhoto: string | null;
  mine: boolean;
  at: string;
  /** When it reached the other side, written by their own client. */
  deliveredAt: string | null;
  attachments: Attachment[];
  /**
   * The message this one answers, quoted above it — 096.
   *
   * What it said rather than a link to it: a quote that has to be clicked to
   * be read is a quote nobody reads. Null once the answered message is gone,
   * which is the point of `on delete set null`.
   */
  replyTo: Quoted | null;
  /** What people have put on it, each emoji once with its count. */
  reactions: Reaction[];
  /**
   * A group membership change — "You added …" / "… removed …".
   *
   * Drawn as a centred notice rather than a bubble, the way WhatsApp shows
   * who joined or left. `body` is already the line to read.
   */
  system?: boolean;
};

export type Quoted = {
  id: string;
  body: string;
  senderName: string;
  /** Whether it was yours — the quote says "You" rather than your own name. */
  mine: boolean;
  /** A picture answered with nothing written under it still has to say so. */
  attachmentCount: number;
};

export type Reaction = {
  emoji: string;
  count: number;
  /** Whether you are one of them, so tapping it takes yours off. */
  mine: boolean;
  /** Everyone who put it on, for the title on hover. */
  names: string[];
};

export type MessagesResult =
  | {
      ok: true;
      threads: ThreadRow[];
      counts: Record<MessageFilter, number>;
      groupCount: number;
      /**
       * Unread on each tab, so the tab you are not looking at can say that
       * something has been said on it. Counted on what this reader can see:
       * the client workspace that is open, and nothing archived.
       */
      unreadByKind: { direct: number; group: number };
    }
  | { ok: false; error: string };

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Screens 9 and 9.0a–9.0c — the inbox.
 *
 * A thread is unread for a person, not for the workspace: §7.1.5 permissions
 * work per person, and a thread three people can see is unread for whoever has
 * not opened it. That is why the read mark lives on the participant row rather
 * than the thread.
 */
export async function listThreads(kind: ThreadKind): Promise<MessagesResult> {
  const workspaceId = await getCurrentWorkspaceId();
  const profile = await getSessionProfile();
  if (!workspaceId || !profile) {
    return { ok: true, threads: [], counts: zero(), groupCount: 0, unreadByKind: none() };
  }

  const supabase = await createClient();

  const { data: threads, error } = await supabase
    .from("whitbyos_message_threads")
    .select(
      "id, subject, kind, archived_at, last_message_at, request_id, client_id, request:whitbyos_requests!request_id (id, title), client:whitbyos_clients!client_id (id, name)",
    )
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) return { ok: false, error: error.message };
  if (!threads || threads.length === 0) {
    return { ok: true, threads: [], counts: zero(), groupCount: 0, unreadByKind: none() };
  }

  const ids = threads.map((t) => t.id as string);

  const [{ data: messages }, { data: participants }] = await Promise.all([
    supabase
      .from("whitbyos_messages")
      .select("id, thread_id, body, sender_type, sender_id, status, source, created_at")
      .in("thread_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("whitbyos_message_participants")
      .select("thread_id, participant_type, participant_id, last_read_at")
      .in("thread_id", ids)
      .is("removed_at", null),
  ]);

  // Newest first, so the first of each kind seen is the one that counts.
  const lastSent = new Map<
    string,
    { id: string; body: string; at: string; mine: boolean; source: string | null; senderId: string }
  >();
  /**
   * The last thing said by somebody else, which is the only thing that can
   * make a thread unread. Your own message used to count, so sending one
   * marked the conversation you were sitting in as unread — and the Unread
   * filter showed a thread with nothing in it to read.
   */
  const lastFromOthers = new Map<string, string>();
  /** Everything anybody else has sent, per thread, to be counted once the
      read marks are in hand. */
  const fromOthers = new Map<string, string[]>();
  const myDrafts = new Map<string, string>();
  /** Threads anything has ever been written in, sent or not. */
  const written = new Set<string>();

  for (const message of messages ?? []) {
    const threadId = message.thread_id as string;
    written.add(threadId);

    if (message.status === "draft") {
      if (message.sender_id === profile.user.id && !myDrafts.has(threadId)) {
        myDrafts.set(threadId, message.body as string);
      }
      continue;
    }

    if (!lastSent.has(threadId)) {
      lastSent.set(threadId, {
        id: message.id as string,
        body: message.body as string,
        at: message.created_at as string,
        mine: message.sender_id === profile.user.id,
        source: (message.source as string | null) ?? null,
        senderId: message.sender_id as string,
      });
    }

    if (message.sender_id !== profile.user.id) {
      if (!lastFromOthers.has(threadId)) {
        lastFromOthers.set(threadId, message.created_at as string);
      }
      fromOthers.set(threadId, [
        ...(fromOthers.get(threadId) ?? []),
        message.created_at as string,
      ]);
    }
  }

  const mine = new Map<string, string | null>();
  /** Threads with any professional on them at all — see `readableBy`. */
  const staffOn = new Set<string>();
  const counts = new Map<string, number>();
  // Per thread, the reads belonging to everyone who is not you.
  const otherReads = new Map<string, (string | null)[]>();

  for (const row of participants ?? []) {
    const threadId = row.thread_id as string;
    counts.set(threadId, (counts.get(threadId) ?? 0) + 1);

    if (row.participant_type === "user") staffOn.add(threadId);

    if (row.participant_type === "user" && row.participant_id === profile.user.id) {
      mine.set(threadId, (row.last_read_at as string | null) ?? null);
    } else {
      const list = otherReads.get(threadId) ?? [];
      list.push((row.last_read_at as string | null) ?? null);
      otherReads.set(threadId, list);
    }
  }

  /** The earliest of them, or null if anyone has never opened the thread. */
  function readByEveryone(threadId: string) {
    const times = otherReads.get(threadId) ?? [];
    if (times.length === 0 || times.some((at) => !at)) return null;
    return times.reduce((earliest, at) =>
      !earliest || new Date(at as string) < new Date(earliest) ? at : earliest,
    );
  }

  /**
   * How many of them arrived after this reader last opened the thread.
   *
   * The same question `unread` asks, answered with a number: a row that says
   * six is a row somebody opens before the one that says one. A thread never
   * opened counts everything in it.
   */
  const unreadCounts = new Map<string, number>();
  for (const [threadId, times] of fromOthers) {
    const readAt = mine.get(threadId) ?? null;
    const count = readAt
      ? times.filter((at) => new Date(at) > new Date(readAt)).length
      : times.length;

    if (count > 0) unreadCounts.set(threadId, count);
  }

  /** The newest message in each thread, whose file the row may have to name. */
  const lastIds = [...lastSent.values()].map((last) => last.id);

  /*
   * What the rows carry, asked for at once.
   *
   * None of the three needs either of the others, and in turn they were three
   * round trips between the messages arriving and the list being drawn.
   */
  const [carried, people, faces] = await Promise.all([
    attachmentPreviews(supabase, lastIds),
    peopleOf(threads.map((t) => t.id as string), profile.user.id),
    /* One call for every group in the list — see `groupPhotos`. */
    groupPhotos(
      supabase,
      threads.filter((t) => (t.kind as string) === "group").map((t) => t.id as string),
    ),
  ]);

  const all: ThreadRow[] = threads.map((row) => {
    const id = row.id as string;
    const last = lastSent.get(id);
    const draft = myDrafts.get(id) ?? null;
    const readAt = mine.get(id) ?? null;
    const theirs = lastFromOthers.get(id) ?? null;
    const seenBy = readByEveryone(id);
    const request = firstOf(row.request as unknown as { id: string; title: string } | null);
    const client = firstOf(row.client as unknown as { id: string; name: string } | null);

    return {
      id,
      subject: row.subject as string,
      kind: ((row.kind as string) ?? "direct") as ThreadKind,
      counterparty:
        (people.get(id) ?? []).map((person) => person.name).join(", ") ||
        client?.name ||
        "No subject",
      // An unsent reply is what you would see if you opened the thread, so it
      // is what the list shows — the way the Drafts filter in 9.0c implies.
      preview: (() => {
        if (draft) return draft;
        if (!last) return "No messages yet";
        const notice = parseSystemNotice(last.body, last.source);
        if (notice) {
          const actor =
            (people.get(id) ?? []).find((person) => person.id === last.senderId)?.name ??
            "Someone";
          return formatSystemNotice(notice, actor, last.mine);
        }
        return last.body || carried.get(last.id) || "Attachment";
      })(),
      lastAt: last?.at ?? (row.last_message_at as string | null) ?? null,
      unread: Boolean(
        theirs && (!readAt || new Date(theirs) > new Date(readAt)),
      ),
      unreadCount: unreadCounts.get(id) ?? 0,
      openAt: id,
      lastMine: Boolean(last?.mine),
      lastRead: Boolean(
        last?.mine && seenBy && new Date(last.at) <= new Date(seenBy),
      ),
      draft: draft !== null,
      requestId: (row.request_id as string | null) ?? null,
      requestTitle: request?.title ?? null,
      clientId: client?.id ?? (row.client_id as string | null) ?? null,
      clientName: client?.name ?? null,
      participantCount: counts.get(id) ?? 0,
      people: people.get(id) ?? [],
      counterpartyPhoto:
        (people.get(id) ?? []).length === 1 ? people.get(id)![0].photo : null,
      photo: faces.get(id) ?? null,
      archived: Boolean(row.archived_at),
      empty: !written.has(id),
      mergedIds: [id],
      children: [],
    };
  });

  /*
   * A conversation is the people in it — 090. `mine` holds a read mark only
   * for threads this reader is a participant of, which is the same question
   * asked once already.
   *
   * What is left may still hold threads nothing was ever written in. Those
   * are not conversations and `fold` drops them, but one of them can be the
   * General thread of a conversation that is — somewhere to talk to a group
   * about nothing in particular — so the question is asked there, where the
   * rest of the conversation is in hand, rather than here.
   *
   * Emptiness is read off the messages rather than off `last_message_at`,
   * which is a column somebody has to remember to write: on a thread whose
   * messages have moved away it is left pointing at a message that is no
   * longer in it.
   */
  const started = all.filter((thread) =>
    readableBy(mine.has(thread.id), staffOn.has(thread.id)),
  );

  /* One person, one conversation — every Request they were written to about
     reads as a thread inside it rather than a row of its own. */
  const folded = fold(started);

  /* The same client filter the screen applies, so a tab's mark counts what
     that tab would actually show. */
  const openClient = await getOpenClientId();
  const visible = folded.filter(
    (thread) => !openClient || thread.clientId === openClient,
  );
  const unreadOn = (of: ThreadKind) =>
    visible.filter((t) => t.kind === of && !t.archived && t.unread).length;

  const forKind = folded.filter((thread) => thread.kind === kind);

  /*
   * Archived conversations are not part of the inbox they were put away from.
   *
   * They keep their own count and their own filter — every other count is
   * read off what is still open, so "3 unread" never includes a thread nobody
   * is going to open again.
   */
  const open = forKind.filter((thread) => !thread.archived);

  return {
    ok: true,
    threads: forKind,
    counts: {
      all: open.length,
      unread: open.filter((t) => t.unread).length,
      request: open.filter((t) => onRequest(t)).length,
      drafts: open.filter((t) => t.draft).length,
      archived: forKind.filter((t) => t.archived).length,
    },
    groupCount: folded.filter((t) => t.kind === "group" && !t.archived).length,
    unreadByKind: { direct: unreadOn("direct"), group: unreadOn("group") },
  };
}

/**
 * What a row says when the last message was a file and nothing else.
 *
 * A message can be a picture with nothing written under it, and the rail was
 * showing an empty line for it. What it carries stands in for what was not
 * written — the way a chat list says "Photo" rather than leaving the row
 * blank.
 */
async function attachmentPreviews(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageIds: string[],
): Promise<Map<string, string>> {
  const carried = new Map<string, string>();
  if (messageIds.length === 0) return carried;

  const { data: files } = await supabase
    .from("whitbyos_message_attachments")
    .select("message_id, file_name, mime_type")
    .in("message_id", messageIds);

  const grouped = new Map<string, { name: string; image: boolean }[]>();
  for (const row of files ?? []) {
    const id = row.message_id as string;
    const list = grouped.get(id) ?? [];
    list.push({
      name: row.file_name as string,
      image: Boolean((row.mime_type as string | null)?.startsWith("image/")),
    });
    grouped.set(id, list);
  }

  for (const [id, list] of grouped) {
    if (list.length > 1) carried.set(id, `📎 ${list.length} attachments`);
    else if (list[0].image) carried.set(id, "📷 Photo");
    else carried.set(id, `📎 ${list[0].name}`);
  }

  return carried;
}

/**
 * Everyone on a thread who is not you, which is what the inbox lists it by and
 * what 9.4 stacks avatars for.
 *
 * All three kinds are resolved. Only contacts were before, so a thread with a
 * provider or a teammate on it came back with no name and the row showed a dash.
 */
async function peopleOf(threadIds: string[], userId: string) {
  const byThread = new Map<string, Person[]>();
  if (threadIds.length === 0) return byThread;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id, participant_type, participant_id, added_at")
    .in("thread_id", threadIds)
    .is("removed_at", null)
    .order("added_at");

  const rows = (data ?? []).filter(
    (row) => !(row.participant_type === "user" && row.participant_id === userId),
  );

  const idsOf = (type: string) => [
    ...new Set(
      rows.filter((row) => row.participant_type === type).map((row) => row.participant_id as string),
    ),
  ];

  const contactIds = idsOf("contact");
  const companyIds = idsOf("company");
  const userIds = idsOf("user");

  const names = new Map<string, string>();

  const [contacts, companies, users] = await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("id, first_name, last_name, preferred_name").in("id", contactIds)
      : Promise.resolve({ data: [] }),
    companyIds.length
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from("users").select("id, full_name, preferred_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  for (const row of contacts.data ?? []) {
    names.set(
      row.id as string,
      (row.preferred_name as string) ||
        [row.first_name, row.last_name].filter(Boolean).join(" "),
    );
  }
  for (const row of companies.data ?? []) names.set(row.id as string, row.name as string);
  for (const row of users.data ?? []) {
    names.set(
      row.id as string,
      (row.preferred_name as string) || (row.full_name as string) || (row.email as string) || "Teammate",
    );
  }

  // A company has no face — a provider is a firm, and the initials of one say
  // more than a logo nobody has uploaded.
  const photos = await photosFor(supabase, { userIds, contactIds });

  const KIND = { contact: "contact", company: "provider", user: "teammate" } as const;

  for (const row of rows) {
    const id = row.participant_id as string;
    const name = names.get(id);
    if (!name) continue;
    const threadId = row.thread_id as string;
    const list = byThread.get(threadId) ?? [];
    list.push({
      id,
      participantType: (row.participant_type as Person["participantType"]) ?? "contact",
      name,
      kind: KIND[row.participant_type as keyof typeof KIND] ?? "contact",
      photo: photos.get(id) ?? null,
    });
    byThread.set(threadId, list);
  }

  return byThread;
}

/**
 * One thread, everything shown in it, and what channel it actually uses.
 *
 * Two things are deliberately kept out of `messages`. A draft is not a bubble —
 * it is what is still sitting in the composer, so it comes back separately and
 * goes into the input rather than the transcript. And anyone else's draft is
 * nobody's business, so only the reader's own comes back at all.
 *
 * `alsoFrom` is the rest of the same conversation — see `fold`. General talk
 * with one person can be spread over several threads for reasons that are the
 * database's business and not the reader's, so the transcript is read off all
 * of them at once and ordered by when things were said. Everything else —
 * the subject, the read marks, where a reply goes — belongs to `threadId`,
 * which is the thread the conversation is anchored to.
 */
export async function getThread(threadId: string, alsoFrom: string[] = []) {
  const workspaceId = await getCurrentWorkspaceId();
  const profile = await getSessionProfile();
  if (!workspaceId || !profile) return null;

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select(
      "id, subject, kind, archived_at, created_by_user_id, workspace_id, request_id, client_id, request:whitbyos_requests!request_id (id, title), client:whitbyos_clients!client_id (id, name)",
    )
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.workspace_id !== workspaceId) return null;

  /* Read from a thread this workspace does not own, whatever the caller was
     told: the transcript is not the place to take an id on trust. */
  const claimed = [...new Set(alsoFrom)].filter((id) => id && id !== threadId);
  const alsoHere: string[] = [];

  if (claimed.length > 0) {
    const { data: kin } = await supabase
      .from("whitbyos_message_threads")
      .select("id")
      .in("id", claimed)
      .eq("workspace_id", workspaceId);

    alsoHere.push(...(kin ?? []).map((row) => row.id as string));
  }

  const readFrom = [threadId, ...alsoHere];

  const { data: rows } = await supabase
    .from("whitbyos_messages")
    .select(
      "id, thread_id, body, sender_type, sender_id, status, source, created_at, delivered_at, reply_to_message_id",
    )
    .in("thread_id", readFrom)
    .order("created_at");

  // Yours and unsent — the composer's contents, not part of the conversation.
  const drafts = (rows ?? []).filter(
    (row) => row.status === "draft" && row.sender_id === profile.user.id,
  );

  /* The one on the anchor first: that is the thread the composer writes to,
     so a stale draft left on a folded-in sibling cannot stand in front of it. */
  const myDraft =
    drafts.find((row) => row.thread_id === threadId) ?? drafts[0] ?? null;

  const sent = (rows ?? []).filter((row) => row.status !== "draft");

  const senderIds = [
    ...new Set(sent.map((row) => row.sender_id as string).filter(Boolean)),
  ];

  const names = new Map<string, string>();
  let senderPhotos = new Map<string, string>();
  if (senderIds.length > 0) {
    const [{ data: users }, { data: contacts }] = await Promise.all([
      supabase.from("users").select("id, full_name, preferred_name").in("id", senderIds),
      supabase.from("contacts").select("id, first_name, last_name, preferred_name").in("id", senderIds),
    ]);

    for (const row of users ?? []) {
      names.set(row.id as string, (row.preferred_name as string) || (row.full_name as string) || "Teammate");
    }
    for (const row of contacts ?? []) {
      names.set(
        row.id as string,
        (row.preferred_name as string) ||
          [row.first_name, row.last_name].filter(Boolean).join(" "),
      );
    }

    // Each id is one or the other, and asking both costs a lookup that finds
    // nothing rather than a wrong face.
    senderPhotos = await photosFor(supabase, {
      userIds: (users ?? []).map((row) => row.id as string),
      contactIds: (contacts ?? []).map((row) => row.id as string),
    });
  }

  const files = await attachmentsFor(sent.map((row) => row.id as string));

  /*
   * What each message answers, and what people have put on it — 096.
   *
   * The quoted message is nearly always one of the ones already in hand; only
   * an answer to something said before this reader's history begins needs
   * fetching, and that is rare enough to ask for only when it happens.
   */
  const quotedIds = [
    ...new Set(
      sent
        .map((row) => (row.reply_to_message_id as string | null) ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  /** Only what a quote needs, so a message fetched for one reads like one. */
  const here = new Map<string, { body: string; senderId: string }>(
    sent.map((row) => [
      row.id as string,
      { body: (row.body as string) ?? "", senderId: row.sender_id as string },
    ]),
  );
  const missing = quotedIds.filter((id) => !here.has(id));

  if (missing.length > 0) {
    const { data: older } = await supabase
      .from("whitbyos_messages")
      .select("id, body, sender_id, status, created_at")
      .in("id", missing)
      .neq("status", "draft");

    for (const row of older ?? []) {
      here.set(row.id as string, {
        body: (row.body as string) ?? "",
        senderId: row.sender_id as string,
      });
    }
  }

  const quotedFiles = await attachmentsFor(quotedIds.filter((id) => !files.has(id)));
  const reactions = await reactionsFor(
    supabase,
    sent.map((row) => row.id as string),
    profile.user.id,
  );

  const request = firstOf(thread.request as unknown as { id: string; title: string } | null);
  const client = firstOf(thread.client as unknown as { id: string; name: string } | null);

  const quoteOf = (id: string | null): Quoted | null => {
    if (!id) return null;
    const row = here.get(id);
    if (!row) return null;

    return {
      id,
      body: row.body,
      senderName: names.get(row.senderId) ?? "Unknown",
      mine: row.senderId === profile.user.id,
      attachmentCount: (files.get(id) ?? quotedFiles.get(id) ?? []).length,
    };
  };

  const messages: MessageRow[] = sent.map((row) => {
    const mine = row.sender_id === profile.user.id;
    const senderName = names.get(row.sender_id as string) ?? "Unknown";
    const notice = parseSystemNotice(
      row.body as string,
      (row.source as string | null) ?? null,
    );

    return {
      id: row.id as string,
      body: notice ? formatSystemNotice(notice, senderName, mine) : (row.body as string),
      senderName,
      senderPhoto: senderPhotos.get(row.sender_id as string) ?? null,
      mine,
      at: row.created_at as string,
      deliveredAt: (row.delivered_at as string | null) ?? null,
      attachments: notice ? [] : files.get(row.id as string) ?? [],
      replyTo: notice ? null : quoteOf((row.reply_to_message_id as string | null) ?? null),
      reactions: notice ? [] : reactions.get(row.id as string) ?? [],
      system: Boolean(notice),
    };
  });

  const { data: people } = await supabase
    .from("whitbyos_message_participants")
    .select("participant_type, participant_id, last_read_at")
    .eq("thread_id", threadId)
    .is("removed_at", null);

  /**
   * When everyone else last opened this thread — the ticks on your own
   * messages.
   *
   * The earliest of them, not the latest: a message is read when it has been
   * read by everyone it went to, so one person who has not opened the thread
   * holds the whole thing at one tick. Anyone who has never opened it makes
   * the answer null rather than "a long time ago".
   */
  const readTimes = (people ?? [])
    .filter((row) => row.participant_id !== profile.user.id)
    .map((row) => row.last_read_at as string | null);

  const othersReadAt =
    readTimes.length === 0 || readTimes.some((at) => !at)
      ? null
      : readTimes.reduce((earliest, at) =>
          !earliest || new Date(at as string) < new Date(earliest) ? at : earliest,
        );

  const others = await peopleOf([threadId], profile.user.id);
  const otherPeople = others.get(threadId) ?? [];

  /*
   * Everyone else, with when they last opened it.
   *
   * "Seen" on a group says one of four people looked, which is the question
   * rather than the answer — so the line under a message names them, and the
   * names have to come from here.
   */
  const readWhen = new Map<string, string | null>(
    (people ?? []).map((row) => [
      row.participant_id as string,
      (row.last_read_at as string | null) ?? null,
    ]),
  );

  const readers = otherPeople.map((person) => ({
    name: person.name,
    readAt: readWhen.get(person.id) ?? null,
  }));

  /*
   * And it does not open at its own address for somebody who is not on it —
   * otherwise the rule would hide the row and the link would still work.
   */
  const onIt = (people ?? []).some(
    (row) => row.participant_type === "user" && row.participant_id === profile.user.id,
  );
  const anyStaff = (people ?? []).some((row) => row.participant_type === "user");
  if (!readableBy(onIt, anyStaff)) return null;

  /*
   * Who may delete a group: whoever made it, and the person who owns the
   * workspace.
   *
   * Deleting takes the conversation away from everyone on it, which is not a
   * thing the fourth person added to a group should be able to do to the other
   * three. The workspace owner keeps it because somebody has to be able to
   * clear up after a teammate who has left.
   */
  const { data: seat } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", profile.user.id)
    .maybeSingle();

  const madeIt = (thread.created_by_user_id as string | null) === profile.user.id;
  const ownsIt = String(seat?.role ?? "") === "owner";

  const groupFace =
    (thread.kind as string) === "group"
      ? await (async () => {
          const siblings = await groupConversationThreadIds(supabase, {
            workspaceId,
            threadId,
            subject: (thread.subject as string) ?? "",
          });
          const faces = await groupPhotos(supabase, siblings);
          return siblings.map((id) => faces.get(id)).find(Boolean) ?? null;
        })()
      : null;

  return {
    /** The group's own picture, where somebody has given it one. */
    photo: groupFace,
    /** Everyone else on it, and when each last opened it. */
    readers,
    /** Only its owner can delete a group — see above. */
    canDelete: (thread.kind as string) === "group" && (madeIt || ownsIt),
    createdByMe: madeIt,
    /* Archived is read, not closed: it opens exactly as it always did. */
    archived: Boolean(thread.archived_at),
    /** Everyone on it but you, for the settings panel. */
    people: otherPeople,
    id: thread.id as string,
    /** Every thread this transcript was read from — what opening it reads. */
    mergedIds: readFrom,
    subject: thread.subject as string,
    counterparty:
      otherPeople.map((person) => person.name).join(", ") ||
      client?.name ||
      thread.subject,
    // One other person means one face. Several means the group's own name,
    // and nobody's photo stands for all of them.
    counterpartyPhoto: otherPeople.length === 1 ? otherPeople[0].photo : null,
    kind: ((thread.kind as string) ?? "direct") as ThreadKind,
    requestId: (thread.request_id as string | null) ?? null,
    requestTitle: request?.title ?? null,
    clientName: client?.name ?? null,
    messages,
    othersReadAt,
    participantCount: (people ?? []).length,
    draft: myDraft
      ? { id: myDraft.id as string, body: myDraft.body as string }
      : null,
  };
}

/**
 * What people have put on a set of messages — 096.
 *
 * Grouped by emoji rather than listed one per row: a conversation shows "👍 3",
 * not three thumbs in a line. The names come back with it for the title on
 * hover, which is the only way a count says who.
 *
 * Missing table means 096 has not been run yet; the conversation reads
 * perfectly well without reactions, so that is quiet rather than fatal.
 */
async function reactionsFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageIds: string[],
  userId: string,
): Promise<Map<string, Reaction[]>> {
  const byMessage = new Map<string, Reaction[]>();
  if (messageIds.length === 0) return byMessage;

  const { data, error } = await supabase
    .from("whitbyos_message_reactions")
    .select("message_id, emoji, reactor_type, reactor_id, created_at")
    .in("message_id", messageIds)
    .order("created_at");

  if (error || !data || data.length === 0) return byMessage;

  const userIds = [
    ...new Set(
      data.filter((row) => row.reactor_type === "user").map((row) => row.reactor_id as string),
    ),
  ];
  const contactIds = [
    ...new Set(
      data.filter((row) => row.reactor_type === "contact").map((row) => row.reactor_id as string),
    ),
  ];

  const names = new Map<string, string>();

  const [users, contacts] = await Promise.all([
    userIds.length
      ? supabase.from("users").select("id, full_name, preferred_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    contactIds.length
      ? supabase
          .from("contacts")
          .select("id, first_name, last_name, preferred_name")
          .in("id", contactIds)
      : Promise.resolve({ data: [] }),
  ]);

  for (const row of users.data ?? []) {
    names.set(
      row.id as string,
      (row.preferred_name as string) || (row.full_name as string) || "Teammate",
    );
  }
  for (const row of contacts.data ?? []) {
    names.set(
      row.id as string,
      (row.preferred_name as string) ||
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
        "Contact",
    );
  }

  for (const row of data) {
    const messageId = row.message_id as string;
    const emoji = row.emoji as string;
    const mine = row.reactor_type === "user" && row.reactor_id === userId;
    const who = mine ? "You" : names.get(row.reactor_id as string) ?? "Someone";

    const list = byMessage.get(messageId) ?? [];
    const found = list.find((one) => one.emoji === emoji);

    if (found) {
      found.count += 1;
      found.mine = found.mine || mine;
      found.names.push(who);
    } else {
      list.push({ emoji, count: 1, mine, names: [who] });
    }

    byMessage.set(messageId, list);
  }

  return byMessage;
}

/**
 * Files hanging off a set of messages, each with a signed URL.
 *
 * The bucket is private (00009_storage.sql), so a stored path is not something
 * a browser can open — every link has to be signed on the way out, and expires.
 *
 * Missing table means the attachments migration has not been run yet; that is a
 * reason for the paperclip not to work, not for the conversation to fail to
 * load, so it comes back empty.
 */
async function attachmentsFor(messageIds: string[]) {
  const byMessage = new Map<string, Attachment[]>();
  if (messageIds.length === 0) return byMessage;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whitbyos_message_attachments")
    .select("id, message_id, file_name, mime_type, size_bytes, storage_path")
    .in("message_id", messageIds);

  if (error || !data || data.length === 0) return byMessage;

  const paths = data.map((row) => row.storage_path as string);
  const { data: signed } = await supabase.storage
    .from("documents")
    .createSignedUrls(paths, 60 * 60);

  const hrefs = new Map(
    (signed ?? []).map((row) => [row.path ?? "", row.signedUrl ?? null]),
  );

  for (const row of data) {
    const messageId = row.message_id as string;
    const list = byMessage.get(messageId) ?? [];
    list.push({
      id: row.id as string,
      fileName: row.file_name as string,
      mimeType: (row.mime_type as string | null) ?? null,
      sizeBytes: (row.size_bytes as number | null) ?? null,
      href: hrefs.get(row.storage_path as string) ?? null,
    });
    byMessage.set(messageId, list);
  }

  return byMessage;
}

function none() {
  return { direct: 0, group: 0 };
}

function zero(): Record<MessageFilter, number> {
  return { all: 0, unread: 0, request: 0, drafts: 0, archived: 0 };
}

export type Recipient = {
  id: string;
  name: string;
  /** How this person is reachable, which is what decides the channel. */
  kind: "contact" | "provider" | "teammate";
  detail: string | null;
  /**
   * What they are to their client workspace — Primary Member, Authorized
   * User, Dependent, Primary Contact. A group is built out of these, so a
   * picker that calls all five of them "contact" makes somebody guess which
   * Ahmed is the dependent and which is the one who signs.
   */
  role: string | null;
  /** Their own photograph, where they have added one. */
  photo: string | null;
};

/**
 * Screen 9.5's participant list.
 *
 * The export mixes three kinds in one list — a client's contact, a provider
 * company, and two teammates — so a conversation is not limited to the client
 * side. §7.4.1 says as much for the last of those: a permitted professional
 * teammate can be added to a thread.
 *
 * They are labelled by kind because the channel differs. A teammate is reached
 * inside Whitby; a client contact through the portal; a provider by email.
 * Which of those actually works today is a separate question, and the screen
 * says so rather than implying all three are live.
 */
export async function listRecipients(): Promise<Recipient[]> {
  const workspaceId = await getCurrentWorkspaceId();
  const profile = await getSessionProfile();
  if (!workspaceId) return [];

  /*
   * The people in the workspace that is open, and nobody else's.
   *
   * With one client open, New Message was still offering every contact of
   * every other client in the firm — four families in one list, and a message
   * one mis-click away from going to the wrong one. Whose workspace you are in
   * is already answered on Workspace Overview; this asks it rather than
   * offering the whole address book.
   *
   * With "All clients" open it is the whole address book, which is then what
   * was asked for.
   */
  const { usesClientWorkspaces } = await import("@/whitbyos/lib/client-workspace");
  const showClients = await usesClientWorkspaces();
  const openClient = await getOpenClientId();

  const supabase = await createClient();

  const clientQuery = supabase
    .from("whitbyos_clients")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  const [{ data: members }, { data: teammates }] = await Promise.all([
    showClients
      ? openClient
        ? clientQuery.eq("id", openClient)
        : clientQuery
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),
  ]);

  const clientNames = new Map((members ?? []).map((c) => [c.id as string, c.name as string]));

  const { data: links } = clientNames.size
    ? await supabase
        .from("whitbyos_client_members")
        .select("contact_id, client_id, role")
        .in("client_id", [...clientNames.keys()])
    : { data: [] };

  const contactIds = [...new Set((links ?? []).map((row) => row.contact_id as string))];
  const clientOf = new Map(
    (links ?? []).map((row) => [row.contact_id as string, row.client_id as string]),
  );
  const roleOf = new Map(
    (links ?? []).map((row) => [row.contact_id as string, (row.role as string | null) ?? null]),
  );

  const contacts: Recipient[] = [];
  if (contactIds.length > 0) {
    const { data: rows } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, preferred_name")
      .in("id", contactIds);

    for (const row of rows ?? []) {
      contacts.push({
        id: row.id as string,
        name:
          (row.preferred_name as string) ||
          [row.first_name, row.last_name].filter(Boolean).join(" "),
        kind: "contact",
        detail: clientNames.get(clientOf.get(row.id as string) ?? "") ?? null,
        role: roleOf.get(row.id as string) ?? null,
        photo: null,
      });
    }
  }

  const teamIds = (teammates ?? [])
    .map((row) => row.user_id as string)
    .filter((id) => id !== profile?.user.id);

  const team: Recipient[] = [];
  if (teamIds.length > 0) {
    const { data: rows } = await supabase
      .from("users")
      .select("id, full_name, preferred_name, email")
      .in("id", teamIds);

    for (const row of rows ?? []) {
      team.push({
        id: row.id as string,
        name:
          (row.preferred_name as string) ||
          (row.full_name as string) ||
          (row.email as string) ||
          "Teammate",
        kind: "teammate",
        detail: "Your team",
        role: null,
        photo: null,
      });
    }
  }

  /*
   * Their faces, in one call for the whole picker.
   *
   * A list of initials is a list somebody has to read; the person you are
   * looking for is recognised before their name is. Two kinds of people and
   * two places a photo is kept, which `photosFor` already knows about.
   */
  const faces = await photosFor(supabase, {
    userIds: team.map((person) => person.id),
    contactIds: contacts.map((person) => person.id),
  });

  const withFaces = (list: Recipient[]) =>
    list.map((person) => ({ ...person, photo: faces.get(person.id) ?? null }));

  /*
   * Providers from the directory — not every company row.
   *
   * New Group offers them beside contacts and teammates; client contacts and
   * providers stay on opposite sides (picker + createThread). A provider is
   * reached as its company when it has one; individuals without a firm stay
   * off this list until there is a mailbox for them.
   */
  const providerRows = await listProviderRecipients(supabase, workspaceId, openClient);

  return [...withFaces(contacts), ...providerRows, ...withFaces(team)];
}

/** Providers the group picker can actually put on a thread (company participants). */
async function listProviderRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  openClient: string | null,
): Promise<Recipient[]> {
  const { data } = await supabase
    .from("whitbyos_providers")
    .select(
      "id, kind, client_id, company_id, contact_id, specialty_capability, company:companies!company_id (id, name, industry_type, created_by_workspace_id), contact:contacts!contact_id (id, first_name, last_name, preferred_name, created_by_workspace_id)",
    )
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  type Company = {
    id: string;
    name: string;
    industry_type: string | null;
    created_by_workspace_id: string | null;
  };
  type Contact = {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    created_by_workspace_id: string | null;
  };

  const firstOf = <T,>(value: T | T[] | null | undefined): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  const seen = new Set<string>();
  const rows: Recipient[] = [];

  for (const row of data ?? []) {
    const company = firstOf(row.company as unknown as Company | Company[] | null);
    const contact = firstOf(row.contact as unknown as Contact | Contact[] | null);

    const mine =
      company?.created_by_workspace_id === workspaceId ||
      contact?.created_by_workspace_id === workspaceId;
    if (!mine) continue;

    const forClient = (row.client_id as string | null) ?? null;
    if (openClient && forClient && forClient !== openClient) continue;

    // Thread participants store company ids for the provider side.
    const companyId = (row.company_id as string | null) ?? company?.id ?? null;
    if (!companyId || seen.has(companyId)) continue;
    seen.add(companyId);

    const name =
      company?.name ||
      (contact
        ? (contact.preferred_name as string) ||
          [contact.first_name, contact.last_name].filter(Boolean).join(" ")
        : null) ||
      "Provider";

    rows.push({
      id: companyId,
      name,
      kind: "provider",
      detail:
        (row.specialty_capability as string | null) ||
        (company?.industry_type as string | null) ||
        null,
      role: "provider",
      photo: null,
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** A conversation as the Request it belongs to lists it. */
export type RequestThread = {
  id: string;
  subject: string;
  kind: ThreadKind;
  /** Everybody on it but you — what the row is read by. */
  people: Person[];
  /** The one other person's photo, on a conversation with one person. */
  photo: string | null;
  preview: string;
  lastAt: string | null;
  /** How much has been said, so a long thread reads as one. */
  count: number;
  /** Something said since you last opened it. */
  unread: boolean;
};

/**
 * The conversations filed under one Request.
 *
 * Add to Request has always set `request_id` on a thread, and until now the
 * only thing that read it was the Messages screen — the Request's own page had
 * no idea a conversation about it existed. So the link was a filing decision
 * with nowhere to be seen from.
 *
 * Kept here rather than in `request-detail.ts` because the awkward part is not
 * the query: it is turning participants into names and faces, and that lives
 * in `peopleOf`, one module, one answer.
 *
 * One row per conversation — not per thread. Filing Rohail under this Request
 * and also tagging a message in an older chat with him used to draw two
 * Rohails; the inbox already folds those, and this list has to do the same.
 */
export async function listThreadsForRequest(requestId: string): Promise<RequestThread[]> {
  const workspaceId = await getCurrentWorkspaceId();
  const profile = await getSessionProfile();
  if (!workspaceId || !profile) return [];

  const supabase = await createClient();

  /*
   * Filed under it, or written about it.
   *
   * Only the first used to count, and a conversation can carry a Request
   * without being filed under one: an ask sent from a Work Plan goes into the
   * conversation that person already has — which is filed under nothing, or
   * under some other Request — and every message of it names this one. Reading
   * only the thread's own column left those invisible here, which is the same
   * mistake in the other direction.
   */
  const [{ data: filed }, { data: about }] = await Promise.all([
    supabase
      .from("whitbyos_message_threads")
      .select("id")
      .eq("request_id", requestId)
      .eq("workspace_id", workspaceId),
    supabase
      .from("whitbyos_messages")
      .select("thread_id")
      .eq("request_id", requestId)
      .eq("workspace_id", workspaceId),
  ]);

  const ids = [
    ...new Set([
      ...(filed ?? []).map((row) => row.id as string),
      ...(about ?? []).map((row) => row.thread_id as string).filter(Boolean),
    ]),
  ];
  if (ids.length === 0) return [];

  const filedIds = new Set((filed ?? []).map((row) => row.id as string));

  const { data: threads } = await supabase
    .from("whitbyos_message_threads")
    .select("id, subject, kind, request_id")
    .in("id", ids)
    .eq("workspace_id", workspaceId);

  if (!threads || threads.length === 0) return [];

  const [{ data: messages }, { data: participants }, people, faces] = await Promise.all([
    supabase
      .from("whitbyos_messages")
      .select("id, thread_id, body, sender_id, status, created_at, request_id")
      .in("thread_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("whitbyos_message_participants")
      .select("thread_id, participant_type, participant_id, last_read_at")
      .in("thread_id", ids)
      .is("removed_at", null),
    peopleOf(ids, profile.user.id),
    groupPhotos(
      supabase,
      (threads ?? []).filter((t) => (t.kind as string) === "group").map((t) => t.id as string),
    ),
  ]);

  /*
   * Preview and count are about *this* Request.
   *
   * A thread filed under it counts every word on it. A thread that only
   * carries some of its messages about it — General chat with one tagged ask
   * — counts only those, otherwise a week of other work reads as this Request.
   */
  const last = new Map<string, { body: string; at: string }>();
  const theirs = new Map<string, string>();
  const said = new Map<string, number>();

  for (const row of messages ?? []) {
    if (row.status === "draft") continue;
    const id = row.thread_id as string;
    const aboutThis =
      filedIds.has(id) ||
      (row.request_id as string | null) === requestId ||
      (threads.find((t) => t.id === id)?.request_id as string | null) === requestId;
    if (!aboutThis) continue;

    said.set(id, (said.get(id) ?? 0) + 1);
    if (!last.has(id)) {
      last.set(id, { body: row.body as string, at: row.created_at as string });
    }
    if (row.sender_id !== profile.user.id && !theirs.has(id)) {
      theirs.set(id, row.created_at as string);
    }
  }

  const readAt = new Map<string, string | null>();
  const onIt = new Set<string>();
  const staffOn = new Set<string>();

  for (const row of participants ?? []) {
    if (row.participant_type !== "user") continue;
    const id = row.thread_id as string;
    staffOn.add(id);
    if (row.participant_id !== profile.user.id) continue;
    onIt.add(id);
    readAt.set(id, (row.last_read_at as string | null) ?? null);
  }

  const rows: RequestThread[] = (threads ?? [])
    .map((row) => {
      const id = row.id as string;
      const on = people.get(id) ?? [];
      const said_ = said.get(id) ?? 0;
      const theirLast = theirs.get(id) ?? null;
      const mine = readAt.get(id) ?? null;
      const kind = ((row.kind as string) ?? "direct") as ThreadKind;

      return {
        id,
        subject: row.subject as string,
        kind,
        people: on,
        photo:
          kind === "group"
            ? faces.get(id) ?? null
            : on.length === 1
              ? on[0].photo
              : null,
        preview: last.get(id)?.body || "Attachment",
        lastAt: last.get(id)?.at ?? null,
        count: said_,
        unread: Boolean(theirLast && (!mine || new Date(theirLast) > new Date(mine))),
      };
    })
    .filter((thread) => thread.count > 0)
    .filter((thread) => readableBy(onIt.has(thread.id), staffOn.has(thread.id)));

  /*
   * One conversation, one row — same key the inbox uses.
   *
   * Prefer the thread actually filed under this Request; otherwise the one
   * that last said something about it.
   */
  const groups = new Map<string, RequestThread[]>();
  const alone: RequestThread[] = [];

  for (const thread of rows) {
    const key = requestConversationKey(thread);
    if (!key) {
      alone.push(thread);
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), thread]);
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      alone.push(group[0]);
      continue;
    }

    const byRecency = [...group].sort((a, b) =>
      String(b.lastAt ?? "").localeCompare(String(a.lastAt ?? "")),
    );
    const filedHere = byRecency.find((row) => filedIds.has(row.id));
    const pick = filedHere ?? byRecency[0];

    alone.push({
      ...pick,
      preview: byRecency[0].preview,
      lastAt: byRecency[0].lastAt,
      count: group.reduce((sum, row) => sum + row.count, 0),
      unread: group.some((row) => row.unread),
      photo: pick.photo ?? group.find((row) => row.photo)?.photo ?? null,
    });
  }

  return alone.sort((a, b) => String(b.lastAt ?? "").localeCompare(String(a.lastAt ?? "")));
}

/** Same shape the inbox folds on — one person, or one named group. */
function requestConversationKey(thread: RequestThread) {
  if (thread.kind === "direct") {
    if (thread.people.length !== 1) return null;
    const person = thread.people[0];
    return `direct:${person.participantType}:${person.id}`;
  }

  // Subject only — member drift after add/remove must not split the row.
  return `group:${thread.subject.trim().toLowerCase()}`;
}

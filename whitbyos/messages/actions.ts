"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { createServiceClient } from "@/base/lib/supabase/service";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { notifyClientContacts, notifyPeople } from "@/whitbyos/lib/notify";
import { AVATAR_BUCKET, groupConversationThreadIds, groupPhotoPath } from "@/whitbyos/lib/people-photos";
import { directThreadOn, nameOf } from "@/whitbyos/lib/direct-thread";
import {
  MIXED_GROUP_MESSAGE,
  mixesClientAndProvider,
  sideOfParticipantType,
  sidesInKinds,
} from "@/whitbyos/lib/message-group-side";
import { membersRelated } from "@/whitbyos/lib/message-fold";
import {
  encodeSystemNotice,
  SYSTEM_SOURCE,
  type SystemEvent,
} from "@/whitbyos/lib/message-system";

const LIST = "/whitbyos/messages";
const ROUTE = "/[product]/[[...slug]]";

/** How the picker's three kinds map onto the participant table. */
const PARTICIPANT_TYPE: Record<string, string> = {
  contact: "contact",
  provider: "company",
  teammate: "user",
};

/**
 * A WhatsApp-style line in the transcript when somebody joins or leaves.
 *
 * Written as an ordinary message with `source = "system"` so Realtime and the
 * list preview pick it up without a new table. The body is a small JSON
 * payload; the words "You added …" are built when it is drawn.
 */
async function postMembershipNotice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    workspaceId: string;
    threadId: string;
    requestId?: string | null;
    clientId?: string | null;
    actorUserId: string;
    event: SystemEvent["event"];
    /** As participant rows: contact / company / user. */
    people: { type: string; id: string }[];
  },
) {
  if (!input.actorUserId || input.people.length === 0) return;

  const names = (
    await Promise.all(input.people.map((person) => nameOf(person.type, person.id)))
  ).filter((name) => name && name !== "Conversation");

  if (names.length === 0) return;

  const at = new Date().toISOString();
  await supabase.from("whitbyos_messages").insert({
    workspace_id: input.workspaceId,
    thread_id: input.threadId,
    request_id: input.requestId ?? null,
    client_id: input.clientId ?? null,
    sender_type: "user",
    sender_id: input.actorUserId,
    body: encodeSystemNotice({ event: input.event, names }),
    status: "sent",
    source: SYSTEM_SOURCE,
  });

  await supabase
    .from("whitbyos_message_threads")
    .update({ last_message_at: at })
    .eq("id", input.threadId);
}

/**
 * RLS refusing a participant looks like nothing at all from the database's side
 * — a row simply does not appear — so it is worth naming the likely cause
 * rather than showing the raw refusal.
 */
function cannotAddPeople(message: string) {
  return /row-level security|violates/i.test(message)
    ? "Could not add anyone to the conversation. Migration 018 lets the first participant be added before the first message; until it runs, new conversations cannot be started."
    : `Could not add anyone to the conversation: ${message}`;
}

function backWithError(query: string, message: string): never {
  redirect(`${LIST}?${query}&error=${encodeURIComponent(message)}`);
}

/** Active participants as `type:id` keys — same shape fold / siblings use. */
async function activeMemberKeys(
  supabase: Awaited<ReturnType<typeof createClient>>,
  threadId: string,
) {
  const { data } = await supabase
    .from("whitbyos_message_participants")
    .select("participant_type, participant_id")
    .eq("thread_id", threadId)
    .is("removed_at", null);

  return (data ?? []).map(
    (row) => `${row.participant_type}:${row.participant_id}`,
  );
}

/**
 * Every sibling thread of this group — same subject, related roster.
 *
 * Add and remove must touch all of them, otherwise one Request thread keeps
 * five people while General has four and the rail shows two conversations.
 */
async function relatedGroupThreadIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    workspaceId: string;
    threadId: string;
    subject: string;
    members: string[];
  },
) {
  const subject = input.subject.trim();
  if (!subject) return [input.threadId];

  const { data: candidates } = await supabase
    .from("whitbyos_message_threads")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("kind", "group")
    .eq("subject", subject)
    .is("archived_at", null);

  const ids = (candidates ?? []).map((row) => row.id as string);
  if (ids.length <= 1) return ids.length > 0 ? ids : [input.threadId];

  const { data: onThem } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id, participant_type, participant_id")
    .in("thread_id", ids)
    .is("removed_at", null);

  const byThread = new Map<string, string[]>();
  for (const row of onThem ?? []) {
    const id = row.thread_id as string;
    byThread.set(id, [
      ...(byThread.get(id) ?? []),
      `${row.participant_type}:${row.participant_id}`,
    ]);
  }

  const same = ids.filter((id) =>
    membersRelated(byThread.get(id) ?? [], input.members),
  );

  return same.length > 0 ? same : [input.threadId];
}

/** Screen 9.5 — New Group Message. */
export async function createThread(formData: FormData) {
  await stopIfReadOnly();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "group").trim() === "direct" ? "direct" : "group";
  // "contact:uuid", "provider:uuid" or "teammate:uuid" — the picker mixes all
  // three kinds the export shows, and each lands as a different participant.
  const chosen = formData
    .getAll("contact_id")
    .map(String)
    .filter(Boolean)
    .map((value) => {
      const [kind, id] = value.split(":");
      return { kind, id };
    })
    .filter((row) => row.id);
  const draft = String(formData.get("draft") ?? "") === "1";

  if (!subject) backWithError(`tab=${kind}&new=1`, "Give the conversation a subject.");

  if (kind === "group" && mixesClientAndProvider(chosen.map((row) => row.kind))) {
    backWithError(`tab=${kind}&new=1`, MIXED_GROUP_MESSAGE);
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LIST);

  let clientId: string | null = null;
  if (requestId) {
    const { data: request } = await supabase
      .from("whitbyos_requests")
      .select("id, client_id")
      .eq("id", requestId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!request) backWithError(`tab=${kind}&new=1`, "That request is not in this workspace.");
    clientId = (request.client_id as string) ?? null;
  }

  const { data: thread, error } = await supabase
    .from("whitbyos_message_threads")
    .insert({
      workspace_id: workspaceId,
      subject,
      kind,
      request_id: requestId || null,
      client_id: clientId,
      last_message_at: body ? new Date().toISOString() : null,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !thread) backWithError(`tab=${kind}&new=1`, error?.message ?? "Could not start it.");

  // The author is always on their own thread, and is already caught up on it.
  const { error: peopleError } = await supabase.from("whitbyos_message_participants").insert([
    {
      thread_id: thread.id,
      participant_type: "user",
      participant_id: user.id,
      added_by_user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    ...chosen.map((row) => ({
      thread_id: thread.id,
      participant_type: PARTICIPANT_TYPE[row.kind] ?? "contact",
      participant_id: row.id!,
      added_by_user_id: user.id,
    })),
  ]);

  // Without people on it, the thread has no recipients and no name — better to
  // take it back than to leave one standing that looks like a conversation.
  if (peopleError) {
    await supabase.from("whitbyos_message_threads").delete().eq("id", thread.id);
    backWithError(`tab=${kind}&new=1`, cannotAddPeople(peopleError.message));
  }

  /*
   * Everybody who was put in it is told, once, at the moment it is made.
   *
   * A group somebody is added to is not a thing they find by scrolling their
   * inbox — the row appears with nothing said in it yet, in a list ordered by
   * when things were last said, which is to say at the bottom.
   *
   * Teammates get a bell notice; contacts get one in the portal, on the same
   * switch and the same area as a message, because to them that is what it is.
   */
  await tellPeopleAdded(supabase, {
    threadId: thread.id as string,
    workspaceId,
    clientId,
    subject,
    kind,
    people: chosen,
    byUserId: user.id,
  });

  if (body) {
    await supabase.from("whitbyos_messages").insert({
      workspace_id: workspaceId,
      thread_id: thread.id,
      request_id: requestId || null,
      client_id: clientId,
      sender_type: "user",
      sender_id: user.id,
      body,
      status: draft ? "draft" : "sent",
      source: "whitbyos",
    });

    if (!draft) {
      await tellClientsOnThread(supabase, { id: thread.id, workspaceId, clientId, subject });
    }
  }

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?tab=${kind}&thread=${thread.id}`);
}

/**
 * "You were added to <group>", to the people it was just done to.
 *
 * Used when a conversation is made and when somebody is added to one later,
 * because from the added person's side those are the same event.
 */
async function tellPeopleAdded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    threadId: string;
    workspaceId: string;
    clientId: string | null;
    subject: string | null;
    kind: string;
    /** As the picker posts them: contact / provider / teammate, and an id. */
    people: { kind?: string; id?: string }[];
    byUserId: string;
  },
) {
  const group = input.kind === "group";
  const name = input.subject?.trim() || (group ? "a group" : "a conversation");

  const teammates = input.people
    .filter((row) => row.kind === "teammate" && row.id)
    .map((row) => row.id as string);

  const contacts = input.people
    .filter((row) => row.kind === "contact" && row.id)
    .map((row) => row.id as string);

  if (teammates.length > 0) {
    await notifyPeople({
      workspaceId: input.workspaceId,
      userIds: teammates,
      kind: "message_thread_added",
      title: group ? `You were added to ${name}` : `New conversation: ${name}`,
      body: group ? "Open Messages to see what it is about." : null,
      href: `${LIST}?tab=${group ? "group" : "direct"}&thread=${input.threadId}`,
      entityType: "message_thread",
      entityId: input.threadId,
      skipUserId: input.byUserId,
    });
  }

  if (contacts.length > 0) {
    await notifyClientContacts({
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      event: "new_message",
      area: "messages",
      kind: "message_thread_added",
      title: group ? `You were added to ${name}` : "Your team started a conversation",
      body: group ? null : name,
      href: `/client-portal/messages?thread=${input.threadId}`,
      entityType: "message_thread",
      entityId: input.threadId,
      onlyContactIds: contacts,
    });
  }
}

/**
 * The portal's "New message", for the contacts on this thread.
 *
 * The thread is the entity rather than the message, so a conversation rings
 * once and stays rung until it is read — five replies in a row are one thing to
 * go and look at, not five.
 */
async function tellClientsOnThread(
  supabase: Awaited<ReturnType<typeof createClient>>,
  thread: { id: string; workspaceId: string; clientId: string | null; subject: string | null },
) {
  const { data: rows } = await supabase
    .from("whitbyos_message_participants")
    .select("participant_id")
    .eq("thread_id", thread.id)
    .eq("participant_type", "contact");

  const contactIds = (rows ?? []).map((row) => row.participant_id as string);
  if (contactIds.length === 0) return;

  await notifyClientContacts({
    workspaceId: thread.workspaceId,
    clientId: thread.clientId,
    event: "new_message",
    area: "messages",
    title: "New message from your team",
    body: thread.subject,
    href: `/client-portal/messages?thread=${thread.id}`,
    entityType: "message_thread",
    entityId: thread.id,
    onlyContactIds: contactIds,
  });
}

/**
 * Sending a reply.
 *
 * If a draft of this reply already exists it becomes the sent message rather
 * than leaving a copy behind — same row, same id, status flipped. Otherwise
 * there is nothing to promote and one is written outright.
 *
 * A message with no words but a file attached is still a message, so either
 * one on its own is enough to send.
 */
export async function sendMessage(formData: FormData) {
  await stopIfReadOnly();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  /* What this answers, where it answers one line rather than the
     conversation. Checked below against the thread it is claimed to be in. */
  const replyTo = String(formData.get("reply_to") ?? "").trim();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!threadId || (!body && files.length === 0)) {
    redirect(`${LIST}?thread=${threadId}`);
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LIST);

  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, workspace_id, request_id, client_id, kind, subject")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.workspace_id !== workspaceId) redirect(LIST);

  const now = new Date().toISOString();

  /*
   * A quote has to be of something that was said here.
   *
   * The id arrives from a form, so it is checked rather than trusted: same
   * workspace, and sent — a draft is not something anybody can answer.
   */
  let answers: string | null = null;
  if (replyTo) {
    const { data: quoted } = await supabase
      .from("whitbyos_messages")
      .select("id, workspace_id, status")
      .eq("id", replyTo)
      .maybeSingle();

    if (quoted && quoted.workspace_id === workspaceId && quoted.status !== "draft") {
      answers = quoted.id as string;
    }
  }

  /* The unsent row the box is showing, which may be held on another thread
     of the same conversation — see `saveDraft`. */
  const draftId = String(formData.get("draft_id") ?? "").trim();
  const existing = draftId
    ? await mine(supabase, draftId, user.id)
    : (
        await supabase
          .from("whitbyos_messages")
          .select("id")
          .eq("thread_id", threadId)
          .eq("sender_id", user.id)
          .eq("status", "draft")
          .maybeSingle()
      ).data;

  let messageId: string | null = null;

  if (existing) {
    const { data } = await supabase
      .from("whitbyos_messages")
      .update({
        body,
        status: "sent",
        created_at: now,
        reply_to_message_id: answers,
        /* Sent from this conversation, so it belongs to the thread the box
           writes to rather than to whichever one held the draft. */
        thread_id: threadId,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    messageId = (data?.id as string) ?? null;
  } else {
    const { data } = await supabase
      .from("whitbyos_messages")
      .insert({
        workspace_id: workspaceId,
        thread_id: threadId,
        request_id: thread.request_id,
        client_id: thread.client_id,
        sender_type: "user",
        sender_id: user.id,
        body,
        status: "sent",
        source: "whitbyos",
        reply_to_message_id: answers,
      })
      .select("id")
      .single();
    messageId = (data?.id as string) ?? null;
  }

  if (messageId && files.length > 0) {
    const failed = await attach(messageId, threadId, workspaceId, user.id, files);
    if (failed) {
      revalidatePath(ROUTE, "page");
      redirect(
        `${LIST}?tab=${thread.kind}&thread=${threadId}&error=${encodeURIComponent(failed)}`,
      );
    }
  }

  /*
   * The two things left, at once.
   *
   * Saying something in a conversation that was put away brings it back —
   * otherwise the reply lands in a list nobody is looking at — and the people
   * on the other side are told. Neither waits on the other, and the sender is
   * watching a bubble that says "Sending…" until both have finished.
   */
  await Promise.all([
    supabase
      .from("whitbyos_message_threads")
      .update({ last_message_at: now, archived_at: null })
      .eq("id", threadId),
    messageId
      ? tellClientsOnThread(supabase, {
          id: threadId,
          workspaceId,
          clientId: (thread.client_id as string | null) ?? null,
          subject: (thread.subject as string | null) ?? null,
        })
      : Promise.resolve(),
  ]);

  // No redirect. The sender is already looking at this thread, so navigating
  // to it again only threw away the optimistic bubble and re-rendered the
  // whole page a second time. Revalidating replaces the pending message in
  // place, which is the only thing that needed to change.
  revalidatePath(ROUTE, "page");
}

/**
 * Puts the files in the private bucket and records them against the message.
 *
 * Returns a message to show if anything went wrong — most likely that the
 * attachments migration has not been run, which is worth saying plainly rather
 * than letting a file vanish without explanation.
 */
async function attach(
  messageId: string,
  threadId: string,
  workspaceId: string,
  userId: string,
  files: File[],
): Promise<string | null> {
  const supabase = await createClient();
  const rows: Record<string, unknown>[] = [];

  for (const file of files) {
    // Nothing from the file's own name reaches the path — it is only kept as a
    // label — so a name with a slash or a traversal in it cannot escape.
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `messages/${threadId}/${crypto.randomUUID()}-${safe}`;

    const { error } = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (error) return `Could not upload ${file.name}: ${error.message}`;

    rows.push({
      workspace_id: workspaceId,
      message_id: messageId,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_path: path,
      uploaded_by_user_id: userId,
    });
  }

  const { error } = await supabase.from("whitbyos_message_attachments").insert(rows);
  if (error) {
    return error.message.includes("does not exist")
      ? "Attachments need migration 015 to be run before files can be kept."
      : error.message;
  }

  return null;
}

/**
 * Autosave. A draft is written while someone types and is never a second
 * message — one row per person per thread, replaced in place.
 *
 * This deliberately does not revalidate: it fires mid-sentence, and re-rendering
 * the page under someone's cursor would take the focus out of the box they are
 * still typing in.
 */
export async function saveDraft(threadId: string, body: string, draftId?: string | null) {
  await stopIfReadOnly();

  const trimmed = body.trim();
  if (!threadId) return;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, workspace_id, request_id, client_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.workspace_id !== workspaceId) return;

  /*
   * The draft the composer is actually showing, wherever it is stored.
   *
   * A conversation is read from several threads — see `fold` — so the draft
   * in the box can belong to one of the others, and looking for it on the
   * thread the box writes to found nothing: emptying the box deleted nothing
   * and the rail went on saying "Draft:" for a message that was no longer
   * anywhere. The id travels with the box for that reason.
   */
  const existing = draftId
    ? await mine(supabase, draftId, user.id)
    : (
        await supabase
          .from("whitbyos_messages")
          .select("id")
          .eq("thread_id", threadId)
          .eq("sender_id", user.id)
          .eq("status", "draft")
          .maybeSingle()
      ).data;

  // Emptying the box is discarding the draft, not saving a blank one.
  if (!trimmed) {
    if (existing) await supabase.from("whitbyos_messages").delete().eq("id", existing.id);
    revalidatePath(ROUTE, "page");
    return;
  }

  if (existing) {
    await supabase
      .from("whitbyos_messages")
      .update({ body: trimmed, created_at: new Date().toISOString() })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("whitbyos_messages").insert({
    workspace_id: workspaceId,
    thread_id: threadId,
    request_id: thread.request_id,
    client_id: thread.client_id,
    sender_type: "user",
    sender_id: user.id,
    body: trimmed,
    status: "draft",
    source: "whitbyos",
  });

  /*
   * The first keystroke, and the last one, and nothing in between.
   *
   * A draft appearing in the rail and disappearing from it are both things
   * somebody is looking at — the row says "Draft:" or it does not. What it
   * says the draft is does not have to keep up, and revalidating on every
   * autosave would re-render the screen every 800ms while somebody types.
   */
  revalidatePath(ROUTE, "page");
}

/** One of this person's own unsent messages, by id, or nothing. */
async function mine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  draftId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("whitbyos_messages")
    .select("id")
    .eq("id", draftId)
    .eq("sender_id", userId)
    .eq("status", "draft")
    .maybeSingle();

  return data;
}

/** Throwing a draft away without sending it. */
export async function discardDraft(formData: FormData) {
  await stopIfReadOnly();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const draftId = String(formData.get("draft_id") ?? "").trim();
  if (!threadId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LIST);

  /* By id where the box knows which row it is showing — it can belong to
     another thread of the same conversation. */
  if (draftId) {
    await supabase
      .from("whitbyos_messages")
      .delete()
      .eq("id", draftId)
      .eq("sender_id", user.id)
      .eq("status", "draft");
  } else {
    await supabase
      .from("whitbyos_messages")
      .delete()
      .eq("thread_id", threadId)
      .eq("sender_id", user.id)
      .eq("status", "draft");
  }

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?thread=${threadId}`);
}

/**
 * The + above the conversation list — one person, straight into a conversation
 * with them.
 *
 * Reaching for the same person twice should land back in the same conversation
 * rather than starting a parallel one, so an existing direct thread between the
 * two of you is reused.
 */
export async function startDirect(person: string, formData: FormData) {
  await stopIfReadOnly();

  /*
   * Who it is with is bound to the action rather than posted by the button.
   *
   * Every row in the picker is a submit of the same form, and a form's submits
   * all report busy together — so pressing one name lit a spinner on all of
   * them. A button carrying its own `formAction` spins only when it was the
   * one pressed, and `name`/`value` cannot travel with a server action because
   * React uses the name to encode which action was pressed.
   */
  const chosen = person.trim();
  /*
   * One conversation per person per Request, and one more for everything else.
   *
   * A direct thread carries the Request it is about, so reaching for the same
   * person about a different piece of work has to be a different conversation
   * — otherwise filing the second one moves the first one's history under a
   * Request it was never about. "No Request" is a conversation of its own by
   * the same rule: general talk is not the visa thread.
   */
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!chosen.includes(":")) redirect(`${LIST}?new=1`);

  const [kind, id] = chosen.split(":");
  const type = PARTICIPANT_TYPE[kind!] ?? "contact";
  if (!id) redirect(`${LIST}?new=1`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LIST);

  const [{ data: theirs }, { data: ours }] = await Promise.all([
    supabase
      .from("whitbyos_message_participants")
      .select("thread_id")
      .eq("participant_type", type)
      .eq("participant_id", id)
      .is("removed_at", null),
    supabase
      .from("whitbyos_message_participants")
      .select("thread_id")
      .eq("participant_type", "user")
      .eq("participant_id", user.id)
      .is("removed_at", null),
  ]);

  /*
   * Theirs, not "theirs and mine".
   *
   * This used to require a participant row for both of you, which a thread the
   * client started from the portal does not have — it is addressed to the firm
   * and names no user — so reaching for that person opened a second
   * conversation beside the one already on the screen. A direct thread is
   * identified by the one person it is with; whether anybody has written you
   * onto it yet is a different question, and `markThreadRead` answers it.
   */
  const mine = new Set((ours ?? []).map((row) => row.thread_id as string));
  const candidates = [...new Set((theirs ?? []).map((row) => row.thread_id as string))];

  if (candidates.length > 0) {
    const [{ data: direct }, { data: everyone }] = await Promise.all([
      supabase
        .from("whitbyos_message_threads")
        .select("id, last_message_at, created_at, request_id")
        .in("id", candidates)
        .eq("workspace_id", workspaceId)
        .eq("kind", "direct"),
      supabase
        .from("whitbyos_message_participants")
        .select("thread_id, participant_type, participant_id")
        .in("thread_id", candidates)
        .is("removed_at", null),
    ]);

    // Direct means the two of you. A thread that also has a third person on it
    // is a group in all but name, and reusing it would put this conversation
    // in front of somebody it was never addressed to.
    const others = new Map<string, number>();
    for (const row of everyone ?? []) {
      if (row.participant_type === "user" && row.participant_id === user.id) continue;
      others.set(row.thread_id as string, (others.get(row.thread_id as string) ?? 0) + 1);
    }

    const already = (direct ?? [])
      .filter((row) => others.get(row.id as string) === 1)
      // About the same work, or about nothing in particular — see above.
      .filter((row) => ((row.request_id as string | null) ?? "") === requestId)
      .sort((a, b) =>
        String(b.last_message_at ?? b.created_at).localeCompare(
          String(a.last_message_at ?? a.created_at),
        ),
      )[0];

    if (already) {
      if (!mine.has(already.id as string)) {
        await supabase.from("whitbyos_message_participants").insert({
          thread_id: already.id,
          participant_type: "user",
          participant_id: user.id,
          added_by_user_id: user.id,
          last_read_at: new Date().toISOString(),
        });
      }
      redirect(`${LIST}?tab=direct&thread=${already.id}`);
    }
  }

  const name = await nameOf(type, id);

  /* Whose work it is, so the client filter and the Request page both find it. */
  let clientId: string | null = null;
  if (requestId) {
    const { data: request } = await supabase
      .from("whitbyos_requests")
      .select("id, client_id")
      .eq("id", requestId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!request) backWithError("new=1", "That request is not in this workspace.");
    clientId = (request.client_id as string | null) ?? null;
  }

  const { data: thread, error } = await supabase
    .from("whitbyos_message_threads")
    .insert({
      workspace_id: workspaceId,
      subject: name,
      kind: "direct",
      request_id: requestId || null,
      client_id: clientId,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !thread) backWithError("new=1", error?.message ?? "Could not start it.");

  const { error: peopleError } = await supabase.from("whitbyos_message_participants").insert([
    {
      thread_id: thread.id,
      participant_type: "user",
      participant_id: user.id,
      added_by_user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    {
      thread_id: thread.id,
      participant_type: type,
      participant_id: id,
      added_by_user_id: user.id,
    },
  ]);

  if (peopleError) {
    await supabase.from("whitbyos_message_threads").delete().eq("id", thread.id);
    backWithError("new=1", cannotAddPeople(peopleError.message));
  }

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?tab=direct&thread=${thread.id}`);
}


/**
 * Opening a thread is reading it — §7.1.5's per-person permissioning again.
 *
 * And, the first time, joining it. A conversation the client starts from the
 * portal is addressed to the firm, not to a person, so `portal_start_thread`
 * writes the contact as its only participant — there is no user for it to
 * name. The professional's inbox lists it anyway, by workspace, which left a
 * thread somebody was reading and answering every day that they were not on.
 *
 * Three things were broken by that and are the same thing. Their read state
 * had nowhere to be written, so "Seen" never moved. `startDirect` looks for a
 * thread the two of you share, found no user row on this one, and started a
 * second conversation with the same person. And "who is on this" left them
 * out of a thread they were half of.
 *
 * Whoever opens it is a member of the workspace that owns it, which is the
 * same test the screen applied before drawing it.
 */
export async function markThreadRead(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "").trim();
  if (!threadId) return;

  /* One conversation can be held on more than one thread — see `fold` in
     lib/messages. Reading it reads all of them, so all of them are marked. */
  const ids = [
    ...new Set(
      [threadId, ...String(formData.get("thread_ids") ?? "").split(",")]
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const now = new Date().toISOString();

  const { data: updated } = await supabase
    .from("whitbyos_message_participants")
    .update({ last_read_at: now })
    .in("thread_id", ids)
    .eq("participant_type", "user")
    .eq("participant_id", user.id)
    .is("removed_at", null)
    .select("thread_id");

  /* The thread you actually opened is the one to join if you were not on it;
     the rest are only being caught up. */
  if (!(updated ?? []).some((row) => row.thread_id === threadId)) {
    const workspaceId = await getCurrentWorkspaceId();
    const { data: thread } = await supabase
      .from("whitbyos_message_threads")
      .select("id, workspace_id")
      .eq("id", threadId)
      .maybeSingle();

    if (workspaceId && thread?.workspace_id === workspaceId) {
      await supabase.from("whitbyos_message_participants").insert({
        thread_id: threadId,
        participant_type: "user",
        participant_id: user.id,
        added_by_user_id: user.id,
        last_read_at: now,
      });
    }
  }

  revalidatePath(ROUTE, "page");
}

/**
 * A reaction, put on or taken off.
 *
 * One tap adds it, the same tap again removes it — there is no separate
 * "unreact", because a reaction is a thing you are either doing or not. The
 * unique index in 096 says the same thing from the database's side, so two
 * taps racing each other cannot leave two thumbs.
 *
 * Deliberately silent: nobody is notified that a message was reacted to, and
 * the conversation is not brought back from Archived by one. A thumb is an
 * acknowledgement, not a new thing to answer.
 */
export async function toggleReaction(formData: FormData) {
  await stopIfReadOnly();

  const messageId = String(formData.get("message_id") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim();
  if (!messageId || !emoji || emoji.length > 16) return;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: message } = await supabase
    .from("whitbyos_messages")
    .select("id, thread_id, workspace_id, status")
    .eq("id", messageId)
    .maybeSingle();

  if (!message || message.workspace_id !== workspaceId || message.status === "draft") return;

  const { data: already } = await supabase
    .from("whitbyos_message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("reactor_type", "user")
    .eq("reactor_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (already) {
    await supabase.from("whitbyos_message_reactions").delete().eq("id", already.id);
  } else {
    await supabase.from("whitbyos_message_reactions").insert({
      workspace_id: workspaceId,
      message_id: messageId,
      thread_id: message.thread_id as string,
      reactor_type: "user",
      reactor_id: user.id,
      emoji,
    });
  }

  revalidatePath(ROUTE, "page");
}

/**
 * The group's picture, carried onto another of its threads.
 *
 * A group is one conversation, but its picture is a file named after a thread
 * — so the General thread of a group that already had one came up wearing
 * initials beside the same group's name. Copied rather than shared, because
 * the storage path is the only handle there is on it.
 */
async function carryGroupPicture(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromId: string,
  toId: string,
) {
  const from = groupPhotoPath(fromId);
  const to = groupPhotoPath(toId);

  const { data: signed } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls([from, to], 60);

  const there = new Map(
    (signed ?? []).map((entry) => [entry.path, !entry.error && Boolean(entry.signedUrl)]),
  );

  /* Nothing to carry, or it is already there and may since have been changed
     on its own — this is not the place to overwrite somebody's picture. */
  if (!there.get(from) || there.get(to)) return;

  await supabase.storage.from(AVATAR_BUCKET).copy(from, to);
}

/**
 * The General thread of a conversation: found, or started.
 *
 * A conversation is one person, or one group, and the Requests written about
 * are threads inside it — so there has to be somewhere to say something that
 * is about none of them. Where the talk began on a Request there is no such
 * thread yet, and this is the pill that asks for one.
 *
 * Nothing is written until it is asked for, and an empty thread is not a
 * conversation: it stays out of the rail until somebody says something in it.
 */
export async function openGeneralThread(formData: FormData) {
  await stopIfReadOnly();

  const from = String(formData.get("thread_id") ?? "").trim();
  if (!from) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LIST);

  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, subject, kind, client_id, workspace_id")
    .eq("id", from)
    .maybeSingle();

  if (!thread || thread.workspace_id !== workspaceId) redirect(LIST);

  const kind = (thread.kind as string) === "group" ? "group" : "direct";
  const here = `${LIST}?tab=${kind}`;

  const { data: people } = await supabase
    .from("whitbyos_message_participants")
    .select("participant_type, participant_id")
    .eq("thread_id", from)
    .is("removed_at", null);

  const others = (people ?? []).filter(
    (row) => !(row.participant_type === "user" && row.participant_id === user.id),
  );

  /* One person: the same find-or-make the rest of the app reaches them by,
     asked for the conversation that is filed under nothing. */
  if (kind === "direct") {
    if (others.length !== 1) redirect(`${here}&thread=${from}`);

    const found = await directThreadOn(supabase, {
      workspaceId,
      userId: user.id,
      type: others[0].participant_type as string,
      participantId: others[0].participant_id as string,
      requestId: null,
      clientId: (thread.client_id as string | null) ?? null,
    });

    revalidatePath(ROUTE, "page");
    redirect(`${here}&thread=${found?.id ?? from}`);
  }

  /*
   * A group is its name — the schema gives it no id of its own — so the
   * General thread is another thread with the same subject and a related
   * roster (add/remove may have drifted one sibling). Exact member match
   * used to miss after a remove and spawn a second "Work Collaboration".
   */
  const subject = String(thread.subject ?? "").trim();
  const mine = others.map((row) => `${row.participant_type}:${row.participant_id}`);
  const withMe = [
    ...mine,
    `user:${user.id}`,
  ];

  const { data: candidates } = await supabase
    .from("whitbyos_message_threads")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "group")
    .eq("subject", subject)
    .is("request_id", null)
    .is("archived_at", null);

  const ids = (candidates ?? []).map((row) => row.id as string);

  if (ids.length > 0) {
    const { data: onThem } = await supabase
      .from("whitbyos_message_participants")
      .select("thread_id, participant_type, participant_id")
      .in("thread_id", ids)
      .is("removed_at", null);

    const byThread = new Map<string, string[]>();
    for (const row of onThem ?? []) {
      const id = row.thread_id as string;
      byThread.set(id, [
        ...(byThread.get(id) ?? []),
        `${row.participant_type}:${row.participant_id}`,
      ]);
    }

    const same = ids.find((id) => membersRelated(byThread.get(id) ?? [], withMe));

    if (same) {
      await carryGroupPicture(supabase, from, same);
      redirect(`${here}&thread=${same}`);
    }
  }

  const { data: made } = await supabase
    .from("whitbyos_message_threads")
    .insert({
      workspace_id: workspaceId,
      subject,
      kind: "group",
      request_id: null,
      client_id: (thread.client_id as string | null) ?? null,
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (!made) redirect(`${here}&thread=${from}`);

  /* The same people, so it is the same group and folds with it. */
  const { error: peopleError } = await supabase.from("whitbyos_message_participants").insert([
    {
      thread_id: made.id,
      participant_type: "user",
      participant_id: user.id,
      added_by_user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    ...others.map((row) => ({
      thread_id: made.id,
      participant_type: row.participant_type as string,
      participant_id: row.participant_id as string,
      added_by_user_id: user.id,
    })),
  ]);

  if (peopleError) {
    await supabase.from("whitbyos_message_threads").delete().eq("id", made.id);
    backWithError(`tab=group&thread=${from}`, cannotAddPeople(peopleError.message));
  }

  await carryGroupPicture(supabase, from, made.id as string);

  revalidatePath(ROUTE, "page");
  redirect(`${here}&thread=${made.id}`);
}

/** Screen 9.1 — Add to Request. §2.5 keeps the source record intact. */
export async function linkThreadToRequest(formData: FormData) {
  await stopIfReadOnly();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!threadId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LIST);

  let clientId: string | null = null;
  if (requestId) {
    const { data: request } = await supabase
      .from("whitbyos_requests")
      .select("id, client_id")
      .eq("id", requestId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!request) redirect(`${LIST}?thread=${threadId}`);
    clientId = (request.client_id as string) ?? null;
  }

  /*
   * On a direct conversation this picker opens a conversation; it never moves
   * one.
   *
   * A direct conversation is the person and the work together, so pointing an
   * existing one at another Request would take everything already said under a
   * Request it was never about. What somebody means by it is "talk to them
   * about this instead", and that is a different conversation: theirs, on that
   * Request, opened if it exists and started if it does not.
   *
   * "Not linked" is the same move rather than an exception — general talk is a
   * conversation of its own, and unfiling this one in place would leave two
   * conversations with the same person about nothing in particular.
   *
   * A group still moves: a group is not one person's thread about one piece of
   * work, and filing one is a filing decision.
   */
  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, kind, request_id, workspace_id")
    .eq("id", threadId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const was = (thread?.request_id as string | null) ?? null;

  if (thread?.kind === "direct" && (requestId || "") !== (was ?? "")) {
    const { data: onIt } = await supabase
      .from("whitbyos_message_participants")
      .select("participant_type, participant_id")
      .eq("thread_id", threadId)
      .is("removed_at", null);

    const them = (onIt ?? []).filter(
      (row) => !(row.participant_type === "user" && row.participant_id === user.id),
    );

    // One other person is what makes it direct; anything else is left alone.
    if (them.length === 1) {
      const other = {
        type: String(them[0]!.participant_type),
        id: String(them[0]!.participant_id),
      };

      const moved = await directThreadOn(supabase, {
        workspaceId,
        userId: user.id,
        type: other.type,
        participantId: other.id,
        requestId: requestId || null,
        clientId,
      });

      if (moved) {
        revalidatePath(ROUTE, "page");
        /* Which of the two happened, so the toast can say the true one: a
           conversation that was already there is not one you just started. */
        redirect(
          `${LIST}?tab=direct&thread=${moved.id}&opened=${moved.created ? "new" : "existing"}`,
        );
      }
    }
  }

  await supabase
    .from("whitbyos_message_threads")
    .update({ request_id: requestId || null, client_id: clientId })
    .eq("id", threadId)
    .eq("workspace_id", workspaceId);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?thread=${threadId}&linked=1`);
}


/**
 * Screen 9.4b — Add Participant.
 *
 * On a direct conversation as well as a group. A two-person thread that gains
 * a third person is a group by definition, so it becomes one here rather than
 * staying a "direct" thread with three people on it that the Direct tab draws
 * with one face and one name.
 */
export async function addParticipant(
  threadId: string,
  contactIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  await stopIfReadOnly();

  const id = String(threadId ?? "").trim();
  const chosen = contactIds.map(String).filter(Boolean);
  if (!id || chosen.length === 0) {
    return { ok: false, error: "Pick at least one person to add." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, kind, subject, client_id, request_id, workspace_id")
    .eq("id", id)
    .maybeSingle();

  if (!thread) return { ok: false, error: "Could not find that conversation." };

  const adding = chosen.map((value) => {
    const [kind, personId] = value.includes(":") ? value.split(":") : ["contact", value];
    return { kind: kind!, id: personId! };
  });

  if (thread.kind === "group" || adding.length > 0) {
    const { data: existing } = await supabase
      .from("whitbyos_message_participants")
      .select("participant_type")
      .eq("thread_id", id)
      .is("removed_at", null);

    const already = sidesInKinds(
      (existing ?? []).map((row) => {
        const side = sideOfParticipantType(row.participant_type as string);
        return side === "client" ? "contact" : side === "provider" ? "provider" : "teammate";
      }),
    );
    const incoming = sidesInKinds(adding.map((row) => row.kind));
    const wouldMix =
      (already.has("client") && incoming.has("provider")) ||
      (already.has("provider") && incoming.has("client")) ||
      (incoming.has("client") && incoming.has("provider"));

    if (wouldMix) {
      return { ok: false, error: MIXED_GROUP_MESSAGE };
    }
  }

  const workspaceId =
    (thread.workspace_id as string | null) ?? (await getCurrentWorkspaceId());

  const beforeMembers = await activeMemberKeys(supabase, id);
  const siblingIds =
    workspaceId && ((thread.kind as string) === "group" || adding.length > 0)
      ? await relatedGroupThreadIds(supabase, {
          workspaceId,
          threadId: id,
          subject: (thread.subject as string) ?? "",
          members: beforeMembers,
        })
      : [id];

  const onSibling = new Map<string, Set<string>>();
  if (siblingIds.length > 0) {
    const { data: alreadyOn } = await supabase
      .from("whitbyos_message_participants")
      .select("thread_id, participant_type, participant_id")
      .in("thread_id", siblingIds)
      .is("removed_at", null);

    for (const row of alreadyOn ?? []) {
      const tid = row.thread_id as string;
      const key = `${row.participant_type}:${row.participant_id}`;
      const hold = onSibling.get(tid) ?? new Set<string>();
      hold.add(key);
      onSibling.set(tid, hold);
    }
  }

  const inserts = siblingIds.flatMap((tid) =>
    adding
      .map((row) => ({
        thread_id: tid,
        participant_type: PARTICIPANT_TYPE[row.kind] ?? "contact",
        participant_id: row.id,
        added_by_user_id: user?.id ?? null,
        // §5.6 — someone added later sees the thread from here, not the start.
        history_visibility: "from_join",
      }))
      .filter((row) => {
        const key = `${row.participant_type}:${row.participant_id}`;
        return !onSibling.get(tid)?.has(key);
      }),
  );

  const { error } =
    inserts.length > 0
      ? await supabase.from("whitbyos_message_participants").insert(inserts)
      : { error: null };

  if (error) {
    return { ok: false, error: cannotAddPeople(error.message) };
  }

  if (thread.kind === "direct") {
    await supabase.from("whitbyos_message_threads").update({ kind: "group" }).eq("id", id);
  }

  if (workspaceId && user?.id) {
    await tellPeopleAdded(supabase, {
      threadId: id,
      workspaceId,
      clientId: (thread.client_id as string | null) ?? null,
      subject: (thread.subject as string | null) ?? null,
      // Whatever it was, it is a group now.
      kind: "group",
      people: adding,
      byUserId: user.id,
    });

    await postMembershipNotice(supabase, {
      workspaceId,
      threadId: id,
      requestId: (thread.request_id as string | null) ?? null,
      clientId: (thread.client_id as string | null) ?? null,
      actorUserId: user.id,
      event: "added",
      people: adding.map((row) => ({
        type: PARTICIPANT_TYPE[row.kind] ?? "contact",
        id: row.id,
      })),
    });
  }

  revalidatePath(ROUTE, "page");
  return { ok: true };
}

/**
 * Screen 9.4c — taking somebody off a conversation.
 *
 * `removed_at` rather than a delete: what they were sent stays theirs, the
 * transcript keeps its sender, and the row records that they were on it
 * between two dates. Everything that reads participants already ignores a
 * removed one.
 *
 * Returns instead of redirecting — Group settings removes in place and
 * refreshes the RSC tree so the panel and chat update without a full reload.
 */
export async function removeParticipant(
  participant: string,
  threadId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await stopIfReadOnly();

  const [rawType, rawId] = participant.includes(":")
    ? participant.split(":")
    : ["contact", participant];

  const participantId = String(rawId ?? "").trim();
  const type = String(rawType ?? "").trim() || "contact";
  const id = String(threadId ?? "").trim();

  if (!id || !participantId) {
    return { ok: false, error: "Could not remove them." };
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "Could not remove them." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, kind, subject, workspace_id, request_id, client_id")
    .eq("id", id)
    .maybeSingle();

  if (!thread || thread.workspace_id !== workspaceId) {
    return { ok: false, error: "Could not remove them." };
  }

  const beforeMembers = await activeMemberKeys(supabase, id);
  const siblingIds =
    (thread.kind as string) === "group"
      ? await relatedGroupThreadIds(supabase, {
          workspaceId,
          threadId: id,
          subject: (thread.subject as string) ?? "",
          members: beforeMembers,
        })
      : [id];

  const { error } = await supabase
    .from("whitbyos_message_participants")
    .update({ removed_at: new Date().toISOString() })
    .in("thread_id", siblingIds)
    .eq("participant_id", participantId)
    .eq("participant_type", type)
    .is("removed_at", null);

  if (error) {
    return { ok: false, error: `Could not remove them: ${error.message}` };
  }

  if (user?.id && (thread.kind as string) === "group") {
    await postMembershipNotice(supabase, {
      workspaceId,
      threadId: id,
      requestId: (thread.request_id as string | null) ?? null,
      clientId: (thread.client_id as string | null) ?? null,
      actorUserId: user.id,
      event: "removed",
      people: [{ type, id: participantId }],
    });
  }

  revalidatePath(ROUTE, "page");
  return { ok: true };
}

/** Taking a group's picture off again — the object is the record. */
export async function removeGroupPhoto(formData: FormData) {
  await stopIfReadOnly();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  if (!threadId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, subject, workspace_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.workspace_id !== workspaceId) redirect(LIST);

  const siblings = await groupConversationThreadIds(supabase, {
    workspaceId,
    threadId,
    subject: (thread.subject as string) ?? "",
  });

  await supabase.storage
    .from(AVATAR_BUCKET)
    .remove(siblings.map((id) => groupPhotoPath(id)));

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?tab=group&thread=${threadId}&settings=1`);
}

/**
 * Messages' own Archive — 089.
 *
 * A conversation put away leaves the rail and is read from Archived beside it,
 * the way a chat client does it. This is not the workspace Archive: Settings →
 * Archive owns clients, contacts and requests, and a conversation is neither.
 *
 * Nothing is destroyed, nothing is hidden from the client side, and the thread
 * opens at the same address it always did. A reply sent into an archived
 * conversation is a reason to bring it back, which `sendMessage` does.
 */
export async function setThreadArchived(formData: FormData) {
  await stopIfReadOnly();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const archived = String(formData.get("archived") ?? "1") === "1";
  if (!threadId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, kind, workspace_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.workspace_id !== workspaceId) redirect(LIST);

  const { error } = await supabase
    .from("whitbyos_message_threads")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", threadId);

  const tab = (thread.kind as string) ?? "direct";

  if (error) {
    redirect(
      `${LIST}?tab=${tab}&thread=${threadId}&error=${encodeURIComponent(
        `Could not archive it: ${error.message}`,
      )}`,
    );
  }

  revalidatePath(ROUTE, "page");

  /* Archiving sends you back to the list it just left; bringing one back opens
     it, because that is what you wanted it back for. */
  redirect(
    archived
      ? `${LIST}?tab=${tab}&filter=archived&put=1`
      : `${LIST}?tab=${tab}&thread=${threadId}&restored=1`,
  );
}

/**
 * Deleting a group, which is the one thing here that does not come back.
 *
 * Offered on groups only. A direct conversation is the record of what two
 * people said to each other and archiving is what putting it away means; a
 * group is a room somebody made, and a room made by mistake should be
 * removable.
 *
 * The children go first: nothing cascades from a thread, so deleting the row
 * on its own would leave its messages and its participants behind pointing at
 * a thread that is not there. Attachments cascade from their message.
 */
export async function deleteThread(formData: FormData) {
  await stopIfReadOnly();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  if (!threadId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LIST);

  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, kind, workspace_id, created_by_user_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.workspace_id !== workspaceId) redirect(LIST);

  if (thread.kind !== "group") {
    redirect(
      `${LIST}?tab=direct&thread=${threadId}&error=${encodeURIComponent(
        "A direct conversation is archived rather than deleted.",
      )}`,
    );
  }

  /*
   * Only the group's owner, checked here and not only hidden in the menu.
   *
   * Deleting takes the conversation away from everyone on it. Whoever made the
   * group may do that, and so may whoever owns the workspace — somebody has to
   * be able to clear up after a teammate who has left — and nobody else.
   */
  const { data: seat } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const mayDelete =
    (thread.created_by_user_id as string | null) === user.id ||
    String(seat?.role ?? "") === "owner";

  if (!mayDelete) {
    redirect(
      `${LIST}?tab=group&thread=${threadId}&error=${encodeURIComponent(
        "Only the person who created this group can delete it. You can archive it instead.",
      )}`,
    );
  }

  await supabase.from("whitbyos_messages").delete().eq("thread_id", threadId);
  await supabase.from("whitbyos_message_participants").delete().eq("thread_id", threadId);

  const { error } = await supabase
    .from("whitbyos_message_threads")
    .delete()
    .eq("id", threadId);

  if (error) {
    redirect(
      `${LIST}?tab=group&thread=${threadId}&error=${encodeURIComponent(
        `Could not delete it: ${error.message}`,
      )}`,
    );
  }

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?tab=group&deleted=1`);
}

/**
 * Screen 9.4c — a conversation's own settings.
 *
 * Its name and, on a group, its picture. Who can see it is not among them any
 * more — 090 made that the people on it, which is answered by adding somebody
 * or taking them off rather than by a switch.
 */
export async function saveConversation(formData: FormData) {
  await stopIfReadOnly();

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();

  if (!threadId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("whitbyos_message_threads")
    .select("id, kind, subject, workspace_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread || thread.workspace_id !== workspaceId) redirect(LIST);

  const tab = (thread.kind as string) ?? "direct";
  const renamed = subject !== ((thread.subject as string | null) ?? "");

  if (!subject) {
    redirect(
      `${LIST}?tab=${tab}&thread=${threadId}&settings=1&error=${encodeURIComponent(
        "Give the conversation a name.",
      )}`,
    );
  }

  const { error } = await supabase
    .from("whitbyos_message_threads")
    .update({ subject })
    .eq("id", threadId);

  if (error) {
    redirect(
      `${LIST}?tab=${tab}&thread=${threadId}&settings=1&error=${encodeURIComponent(
        `Could not save it: ${error.message}`,
      )}`,
    );
  }

  /*
   * And its picture, if one came with the form.
   *
   * Kept where a contact's is: the object in the private `avatars` bucket is
   * the record, so there is no column to fall out of step with the bucket.
   *
   * A group is several threads (General + each Request). The picture used to
   * land only on the thread that was open, so General wore initials while the
   * Request thread still had the face. Upload once, then carry it onto every
   * sibling that is the same conversation.
   */
  const photo = formData.get("photo");
  const picture = photo instanceof File && photo.size > 0;

  if (picture) {
    if (photo.size > 5 * 1024 * 1024) {
      redirect(
        `${LIST}?tab=${tab}&thread=${threadId}&settings=1&error=${encodeURIComponent(
          "Pictures must be 5 MB or smaller.",
        )}`,
      );
    }

    const { error: upload } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(groupPhotoPath(threadId), photo, {
        contentType: photo.type || undefined,
        upsert: true,
      });

    if (upload) {
      redirect(
        `${LIST}?tab=${tab}&thread=${threadId}&settings=1&error=${encodeURIComponent(
          `Could not save the picture: ${upload.message}`,
        )}`,
      );
    }

    if ((thread.kind as string) === "group") {
      const siblings = await groupConversationThreadIds(supabase, {
        workspaceId,
        threadId,
        subject,
      });
      await Promise.all(
        siblings
          .filter((id) => id !== threadId)
          .map((id) =>
            supabase.storage
              .from(AVATAR_BUCKET)
              .upload(groupPhotoPath(id), photo, {
                contentType: photo.type || undefined,
                upsert: true,
              }),
          ),
      );
    }
  }

  revalidatePath(ROUTE, "page");

  /* What was saved, so the toast can say that rather than something true of
     every save. */
  const what = picture && renamed ? "both" : picture ? "picture" : "name";
  redirect(`${LIST}?tab=${tab}&thread=${threadId}&saved=${what}`);
}

/**
 * Records that a message reached somebody.
 *
 * Called by the recipient's own browser the first time Realtime hands it a
 * message it did not send. That is the only moment anything here knows the
 * message arrived — there is no delivery receipt from anywhere else — and it
 * is what the middle tick means.
 *
 * Written with the service role and guarded here instead of by RLS, because
 * the recipient may be a portal member whose policies allow reading a message
 * and not writing one. The guard is the same either way: you must be a
 * participant of the thread, and you must not be the sender.
 *
 * `coalesce` so the first arrival is the one that counts. A second reader, or
 * the same reader on another device, cannot move the moment later.
 */
export async function markDelivered(messageId: string) {
  if (!messageId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: message } = await supabase
    .from("whitbyos_messages")
    .select("id, thread_id, sender_id, delivered_at")
    .eq("id", messageId)
    .maybeSingle();

  if (!message || message.delivered_at || message.sender_id === user.id) return;

  // Readable at all means the thread is one of theirs, but say so explicitly.
  const { data: seat } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id")
    .eq("thread_id", message.thread_id as string)
    .eq("participant_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!seat) return;

  const service = createServiceClient();
  if (!service) return;

  await service
    .from("whitbyos_messages")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("delivered_at", null);
}

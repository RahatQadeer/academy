import type { createClient } from "@/base/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export const AVATAR_BUCKET = "avatars";

/**
 * Everybody's photo, whichever of the two places it is kept in.
 *
 * There are two, because the two sides of this product put a face on an
 * account by different routes. A Whitby user uploads one through Settings and
 * `lib/avatar.ts` writes a year-long signed URL onto `users.avatar_url`. A
 * client uploads one through the portal, which writes no column at all — the
 * path `<contact id>/photo` in the private `avatars` bucket *is* the record,
 * and its existence is the lookup.
 *
 * So a contact's photo has to be signed on the way out, like an attachment,
 * and a missing object is simply somebody who has not added one. An hour is
 * long enough for a screen to be read and short enough for a private bucket.
 */
const PHOTO_TTL = 60 * 60;

export async function photosFor(
  supabase: Client,
  { userIds, contactIds }: { userIds: string[]; contactIds: string[] },
): Promise<Map<string, string>> {
  const found = new Map<string, string>();

  const users = [...new Set(userIds.filter(Boolean))];
  const contacts = [...new Set(contactIds.filter(Boolean))];
  if (users.length === 0 && contacts.length === 0) return found;

  const [stored, signed] = await Promise.all([
    users.length
      ? supabase.from("users").select("id, avatar_url").in("id", users)
      : Promise.resolve({ data: [] as { id: string; avatar_url: string | null }[] }),
    contacts.length
      ? supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrls(
            contacts.map((id) => `${id}/photo`),
            PHOTO_TTL,
          )
      : Promise.resolve({ data: null }),
  ]);

  for (const row of stored.data ?? []) {
    const url = (row.avatar_url as string | null)?.trim();
    if (url) found.set(row.id as string, url);
  }

  for (const entry of signed.data ?? []) {
    // A path with no object behind it comes back carrying its own error rather
    // than failing the batch — which is the answer for most people.
    if (entry.error || !entry.signedUrl || !entry.path) continue;
    found.set(entry.path.split("/")[0]!, entry.signedUrl);
  }

  return found;
}

/**
 * One contact's photograph, for a screen that needs a single face.
 *
 * `photosFor` is built for lists — it takes the ids in one go so a table of
 * twenty people costs one round trip. This is the one-face version of it, so
 * a client header does not have to assemble a batch to ask about one person.
 */
export async function photoOf(contactId: string | null): Promise<string | null> {
  if (!contactId) return null;

  const { createClient } = await import("@/base/lib/supabase/server");
  const supabase = await createClient();
  const found = await photosFor(supabase, { userIds: [], contactIds: [contactId] });
  return found.get(contactId) ?? null;
}

/**
 * A group conversation's own picture.
 *
 * Kept the way a contact's is — the object's existence in the private
 * `avatars` bucket is the record, under `group/<thread id>/photo`, so there is
 * no column to keep in step with the bucket and no migration to run before a
 * group can have a face. Signed on the way out, in one call for the whole
 * list, and a path with nothing behind it is simply a group nobody has given a
 * picture to.
 */
export async function groupPhotos(
  supabase: Client,
  threadIds: string[],
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const ids = [...new Set(threadIds.filter(Boolean))];
  if (ids.length === 0) return found;

  const { data } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(ids.map((id) => `${GROUP_PHOTO_PREFIX}/${id}/photo`), PHOTO_TTL);

  for (const entry of data ?? []) {
    if (entry.error || !entry.signedUrl || !entry.path) continue;
    const id = entry.path.split("/")[1];
    if (id) found.set(id, entry.signedUrl);
  }

  return found;
}

import { membersRelated } from "@/whitbyos/lib/message-fold";

/** Where a group's picture lives, named once so both sides agree. */
export const GROUP_PHOTO_PREFIX = "group";

export function groupPhotoPath(threadId: string) {
  return `${GROUP_PHOTO_PREFIX}/${threadId}/photo`;
}

/**
 * Every thread that is the same group conversation.
 *
 * A group has no id of its own — only a name and the people on it — so its
 * picture can end up on one Request thread while General still wears initials.
 * Callers that need "the group's face" ask every sibling, not only the thread
 * that happens to be open. Rosters that drifted by add/remove still match.
 */
export async function groupConversationThreadIds(
  supabase: Client,
  input: { workspaceId: string; threadId: string; subject: string },
): Promise<string[]> {
  const subject = input.subject.trim();
  if (!subject) return [input.threadId];

  const [{ data: people }, { data: candidates }] = await Promise.all([
    supabase
      .from("whitbyos_message_participants")
      .select("participant_type, participant_id")
      .eq("thread_id", input.threadId)
      .is("removed_at", null),
    supabase
      .from("whitbyos_message_threads")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("kind", "group")
      .eq("subject", subject)
      .is("archived_at", null),
  ]);

  const mine = (people ?? []).map(
    (row) => `${row.participant_type}:${row.participant_id}`,
  );

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

  const same = ids.filter((id) => membersRelated(byThread.get(id) ?? [], mine));

  return same.length > 0 ? same : [input.threadId];
}


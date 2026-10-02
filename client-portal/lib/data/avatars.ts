import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { avatarStoragePath } from "@/client-portal/lib/storage";

const BUCKET = "avatars";

/** An hour, which comfortably outlasts any one page and keeps the URL short-lived. */
const TTL_SECONDS = 60 * 60;

/**
 * A contact's own photo, from the bucket their Profile screen writes it to.
 *
 * A contact has no `photo_url` column anywhere. The portal writes the file to
 * `avatars/<contact id>/photo` and the path's existence *is* the record — which
 * is why this signs rather than selects, and why a person who has never added
 * one comes back as `null` from a failed signing rather than as a throw.
 *
 * The bucket is private, so every URL here is signed and expires. It is never a
 * path that could be pasted anywhere and still work tomorrow.
 *
 * Cached per request: the rail and the open screen both want the reader's own
 * face, and that should not be two signings of the same object.
 */
export const portalAvatarUrl = cache(
  async (contactId: string | null | undefined): Promise<string | null> => {
    if (!contactId) return null;

    const supabase = await createClient();
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(avatarStoragePath(contactId), TTL_SECONDS);

    return data?.signedUrl ?? null;
  },
);

/**
 * The same for a list of people, in one round trip rather than one per face.
 *
 * `createSignedUrls` answers for every path it was given, whether or not the
 * object is there, so a missing photo arrives as a row with an error on it and
 * is read as "no photo" — the same answer `portalAvatarUrl` gives.
 *
 * Returns a map keyed by contact id, so a caller reads `photos.get(id) ?? null`
 * without caring which of its people actually have one.
 */
export async function portalAvatarUrls(
  contactIds: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(contactIds.filter((id): id is string => !!id))];
  const photos = new Map<string, string>();
  if (ids.length === 0) return photos;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(ids.map(avatarStoragePath), TTL_SECONDS);

  for (const row of data ?? []) {
    if (!row.signedUrl || row.error) continue;
    // `path` comes back exactly as it was sent — "<contact id>/photo".
    const contactId = (row.path ?? "").split("/")[0];
    if (contactId) photos.set(contactId, row.signedUrl);
  }

  return photos;
}

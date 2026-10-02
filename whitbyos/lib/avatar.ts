import { createClient } from "@/base/lib/supabase/server";

export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Store a photo against the signed-in account.
 *
 * Shared by Settings → Profile and the screen an invited teammate lands on, so
 * a photo added on the way in and a photo added a month later are the same
 * object in the same bucket, and either one can replace the other.
 *
 * Returns the reason it could not, or null when it did — the two callers send
 * their errors to different screens, so neither redirect belongs in here.
 */
export async function storeAvatar(file: unknown): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return "Choose a photo to upload.";
  if (file.size > MAX_AVATAR_BYTES) return "Photos must be 5 MB or smaller.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sign in again to change your photo.";

  const path = `${user.id}/photo`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: true });

  if (error) return error.message;

  // The bucket is private, so what is stored is a signed URL rather than a
  // path — long-lived, because it hangs in the nav on every page.
  const { data: signed } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  await supabase
    .from("users")
    .update({ avatar_url: signed?.signedUrl ?? null })
    .eq("id", user.id);

  return null;
}

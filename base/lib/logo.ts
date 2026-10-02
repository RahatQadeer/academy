import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";

const BUCKET = "avatars";
const TTL_SECONDS = 60 * 60;

/**
 * A viewable URL for a workspace logo.
 *
 * `workspaces.logo_url` holds a storage path, not a URL: the `avatars` bucket
 * is private, per the schema's rule that nothing gated is ever public. So the
 * path has to be signed before it can be rendered.
 *
 * Returns null when there is no logo or the signature fails, so callers can
 * simply fall back to initials.
 */
export const getWorkspaceLogoUrl = cache(async (
  logoPath: string | null | undefined,
): Promise<string | null> => {
  if (!logoPath) return null;

  // A full URL means it was stored as a public link elsewhere — use it as is.
  if (logoPath.startsWith("http")) return logoPath;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(logoPath, TTL_SECONDS);

  return data?.signedUrl ?? null;
});

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isHttpUrl } from "@/academy/lesson-player/utils/curriculum";

export async function resolveAcademyAssetUrl(
  supabase: SupabaseClient,
  stored: string | null | undefined,
  expiresInSeconds = 60 * 60 * 24,
): Promise<string | null> {
  const value = stored?.trim();
  if (!value) return null;
  if (isHttpUrl(value)) return value;

  const path = value.replace(/^\/+/, "").replace(/^academy\//, "");
  const { data, error } = await supabase.storage.from("academy").createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

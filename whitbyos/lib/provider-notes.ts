import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";

/**
 * Internal notes on a provider.
 *
 * Not one box that gets overwritten. What a firm knows about a provider
 * accumulates — a call in March, a quote in June, why they were passed over in
 * September — and each of those is a separate thing said by a particular
 * person on a particular day. A single field turns that into whatever the last
 * person to type had room for.
 *
 * Internal by definition: the client never reads these, which is why the table
 * carries one policy and it is the workspace's. `qualifications`,
 * `restrictions` and `missing_information` stay what they are — those are
 * facts about the provider, on the record; this is the firm talking.
 */
export type ProviderNote = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  /** Whether the reader wrote it, which is who may take it back down. */
  mine: boolean;
};

export async function listProviderNotes(providerId: string): Promise<ProviderNote[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const profile = await getSessionProfile();

  const { data } = await supabase
    .from("whitbyos_provider_notes")
    .select("id, body, created_at, author_user_id")
    .eq("provider_id", providerId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const authorIds = [
    ...new Set(rows.map((row) => row.author_user_id as string | null).filter(Boolean)),
  ] as string[];

  const { data: users } = authorIds.length
    ? await supabase
        .from("users")
        .select("id, full_name, preferred_name, email")
        .in("id", authorIds)
    : { data: [] };

  const names = new Map(
    (users ?? []).map((row) => [
      row.id as string,
      (row.preferred_name as string) ||
        (row.full_name as string) ||
        (row.email as string) ||
        "Someone",
    ]),
  );

  return rows.map((row) => ({
    id: row.id as string,
    body: row.body as string,
    createdAt: row.created_at as string,
    // A note whose author has since left the workspace still says something.
    authorName: names.get((row.author_user_id as string) ?? "") ?? "Someone",
    mine: Boolean(profile && row.author_user_id === profile.user.id),
  }));
}

export async function addProviderNoteRow(providerId: string, body: string) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false as const, error: "No workspace is open." };

  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("whitbyos_provider_notes").insert({
    provider_id: providerId,
    workspace_id: workspaceId,
    author_user_id: profile?.user.id ?? null,
    body,
  });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/** Only the person who wrote it; the policy allows more, this does not. */
export async function deleteProviderNoteRow(noteId: string) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("whitbyos_provider_notes")
    .delete()
    .eq("id", noteId)
    .eq("author_user_id", profile.user.id);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { photosFor } from "@/whitbyos/lib/people-photos";

/**
 * Which client workspace is open, across the whole product.
 *
 * Every list screen used to carry its own "All Workspaces" dropdown
 * writing `?client=` into that screen's URL, so the answer to "whose work am I
 * looking at" was set seven times, held in seven places, and lost on every
 * navigation. It is one answer now: chosen on Workspace Overview, which is the
 * screen Whitby opens on, and kept until it is changed there.
 *
 * `null` is a real choice, not a missing one — every client at once, which is
 * what somebody wants when they are looking for what needs attention rather
 * than working on one family's move.
 *
 * A cookie, like the firm workspace beside it, and checked the same way: what
 * is stored is a preference, tested against the clients this firm actually has
 * every time it is read, so a stale or tampered value falls back to "all"
 * rather than naming a client the reader cannot see.
 */
export const OPEN_CLIENT_COOKIE = "pa_whitbyos_client";

/** A year: this is where somebody works, not a thing to re-decide weekly. */
const KEEP = 60 * 60 * 24 * 365;

/*
 * Deduped per request.
 *
 * The database is in Tokyo and a query from here costs a third of a second,
 * so the cost of a screen is mostly the number of round trips it makes one
 * after another. These answers cannot change while one request is being
 * served — the cookie is already set, the plan is already what it is — and
 * they were being fetched again by every list, widget and header that wanted
 * them. `cache` makes the second and tenth caller free.
 */
export const getOpenClientId = cache(async (): Promise<string | null> => {
  const { usesClientWorkspaces } = await import("@/whitbyos/lib/client-workspace");
  if (!(await usesClientWorkspaces())) return null;

  const stored = (await cookies()).get(OPEN_CLIENT_COOKIE)?.value;
  if (!stored) return null;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_clients")
    .select("id, preferences, primary_contact_id, client_type, classification")
    .eq("id", stored)
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .maybeSingle();

  const { isHiddenFirmClient } = await import("@/whitbyos/lib/client-workspace");
  if (!data || isHiddenFirmClient(data)) return null;

  return stored;
});

/**
 * The open client, for the two places that have to say where you are.
 *
 * With a face where there is one to have. A client workspace is an account
 * rather than a person and has no photograph of its own, so the one it wears
 * is its primary contact's — the person you are actually dealing with, and the
 * one whose photo the portal already holds. Initials where nobody has added
 * one, which is most of them.
 */
export const getOpenClient = cache(async (): Promise<{
  id: string;
  name: string;
  photo: string | null;
} | null> => {
  const id = await getOpenClientId();
  if (!id) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_clients")
    .select("id, name, primary_contact_id")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const contactId = (data.primary_contact_id as string | null) ?? null;
  const photos = contactId
    ? await photosFor(supabase, { userIds: [], contactIds: [contactId] })
    : null;

  return {
    id: data.id as string,
    name: data.name as string,
    photo: contactId ? (photos?.get(contactId) ?? null) : null,
  };
});

/**
 * Open one, or open all of them. Called from the server actions that own the
 * choice; nothing else writes this.
 */
export async function setOpenClientId(clientId: string | null) {
  const jar = await cookies();

  if (!clientId) {
    jar.delete(OPEN_CLIENT_COOKIE);
    return;
  }

  jar.set(OPEN_CLIENT_COOKIE, clientId, {
    path: "/",
    maxAge: KEEP,
    sameSite: "lax",
    httpOnly: true,
  });
}

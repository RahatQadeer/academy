import "server-only";

import { createClient } from "@/base/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * The direct conversation with one person about one Request: found, or made.
 *
 * The same pairing `startDirect` looks for — one other live participant, and
 * the same Request — so reaching for it from two places cannot drift into two
 * answers.
 */
export async function directThreadOn(
  supabase: Client,
  input: {
    workspaceId: string;
    userId: string;
    type: string;
    participantId: string;
    /** Null is a conversation of its own: general talk, filed under nothing. */
    requestId: string | null;
    clientId: string | null;
  },
): Promise<{ id: string; created: boolean } | null> {
  const { data: theirs } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id")
    .eq("participant_type", input.type)
    .eq("participant_id", input.participantId)
    .is("removed_at", null);

  const ids = [...new Set((theirs ?? []).map((row) => row.thread_id as string))];

  if (ids.length > 0) {
    const [{ data: direct }, { data: everyone }] = await Promise.all([
      supabase
        .from("whitbyos_message_threads")
        .select("id, request_id, last_message_at, created_at")
        .in("id", ids)
        .eq("workspace_id", input.workspaceId)
        .eq("kind", "direct"),
      supabase
        .from("whitbyos_message_participants")
        .select("thread_id, participant_type, participant_id")
        .in("thread_id", ids)
        .is("removed_at", null),
    ]);

    const others = new Map<string, number>();
    for (const row of everyone ?? []) {
      if (row.participant_type === "user" && row.participant_id === input.userId) continue;
      others.set(row.thread_id as string, (others.get(row.thread_id as string) ?? 0) + 1);
    }

    const found = (direct ?? [])
      .filter((row) => others.get(row.id as string) === 1)
      .filter((row) => ((row.request_id as string | null) ?? "") === (input.requestId ?? ""))
      .sort((a, b) =>
        String(b.last_message_at ?? b.created_at).localeCompare(
          String(a.last_message_at ?? a.created_at),
        ),
      )[0];

    if (found) {
      // They may be on it without you: a thread the client started names no
      // professional until one opens it.
      const mine = (everyone ?? []).some(
        (row) =>
          row.thread_id === found.id &&
          row.participant_type === "user" &&
          row.participant_id === input.userId,
      );

      if (!mine) {
        await supabase.from("whitbyos_message_participants").insert({
          thread_id: found.id,
          participant_type: "user",
          participant_id: input.userId,
          added_by_user_id: input.userId,
          last_read_at: new Date().toISOString(),
        });
      }

      return { id: found.id as string, created: false };
    }
  }

  const name = await nameOf(input.type, input.participantId);

  /* With no Request to take it from, a contact's own client workspace, so the
     conversation is still filed under whose work it is. */
  let clientId = input.clientId;
  if (!clientId && input.type === "contact") {
    const { data: membership } = await supabase
      .from("whitbyos_client_members")
      .select("client_id")
      .eq("contact_id", input.participantId)
      .limit(1)
      .maybeSingle();

    clientId = (membership?.client_id as string | null) ?? null;
  }

  const { data: made } = await supabase
    .from("whitbyos_message_threads")
    .insert({
      workspace_id: input.workspaceId,
      subject: name,
      kind: "direct",
      request_id: input.requestId || null,
      client_id: clientId,
      created_by_user_id: input.userId,
    })
    .select("id")
    .single();

  if (!made) return null;

  const { error } = await supabase.from("whitbyos_message_participants").insert([
    {
      thread_id: made.id,
      participant_type: "user",
      participant_id: input.userId,
      added_by_user_id: input.userId,
      last_read_at: new Date().toISOString(),
    },
    {
      thread_id: made.id,
      participant_type: input.type,
      participant_id: input.participantId,
      added_by_user_id: input.userId,
    },
  ]);

  if (error) {
    await supabase.from("whitbyos_message_threads").delete().eq("id", made.id);
    return null;
  }

  return { id: made.id as string, created: true };
}


/** What to call a new direct thread — the person it is with. */
export async function nameOf(type: string, id: string): Promise<string> {
  const supabase = await createClient();

  if (type === "company") {
    const { data } = await supabase.from("companies").select("name").eq("id", id).maybeSingle();
    return (data?.name as string) || "Conversation";
  }

  if (type === "user") {
    const { data } = await supabase
      .from("users")
      .select("full_name, preferred_name, email")
      .eq("id", id)
      .maybeSingle();
    return (
      (data?.preferred_name as string) ||
      (data?.full_name as string) ||
      (data?.email as string) ||
      "Conversation"
    );
  }

  const { data } = await supabase
    .from("contacts")
    .select("first_name, last_name, preferred_name")
    .eq("id", id)
    .maybeSingle();

  return (
    (data?.preferred_name as string) ||
    [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
    "Conversation"
  );
}

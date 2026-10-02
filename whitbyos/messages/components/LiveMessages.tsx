"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/base/lib/supabase/client";
import { markDelivered } from "@/whitbyos/messages/actions";

/** How often the screen re-reads itself while the socket is not carrying rows. */
const FALLBACK_POLL_MS = 15_000;

/**
 * Keeps the inbox and the open conversation current without a reload.
 *
 * Rows arrive through the same RLS as everything else, so a subscriber is only
 * ever sent what they could already have read. There is no socket server here:
 * this is Supabase Realtime over its own connection.
 *
 * Which is also why the token is set before the channel is joined.
 * `whitbyos_messages_all` is `is_workspace_member(workspace_id)`, and a socket
 * that has not been given this person's access token is not a member of
 * anything — it is sent no rows at all, with no error anywhere to say so. The
 * page still fills in on a reload, because that read goes through the server
 * with the session cookie, so the failure reads as "live messages stopped
 * working" rather than as anything broken. supabase-js loads the session
 * asynchronously, so joining in the same tick as `createClient()` races it;
 * `getSession` and an explicit `setAuth` settle that, and `onAuthStateChange`
 * keeps the socket on the current token for as long as the tab is open.
 *
 * Drafts are written continuously while someone types, and they are nobody
 * else's business. They are discarded below rather than in the subscription:
 * filtering on `status` server-side also decides whether the draft-to-sent
 * update — which is how a reply that was autosaved gets sent — counts as a
 * match, and that is the one event this component exists to receive.
 *
 * If the channel never opens, the screen falls back to re-reading itself on a
 * timer. A blocked WebSocket should cost someone freshness, not the message.
 */
export function LiveMessages() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    let cancelled = false;
    let me: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const refresh = () => router.refresh();

    const stopPolling = () => {
      if (poll === null) return;
      clearInterval(poll);
      poll = null;
    };

    const startPolling = () => {
      if (poll !== null || cancelled) return;
      poll = setInterval(() => {
        // A background tab is nobody reading.
        if (document.visibilityState === "visible") refresh();
      }, FALLBACK_POLL_MS);
    };

    // Until the channel says it is subscribed, assume it is not.
    startPolling();

    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);
    });

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.access_token) return;

      me = session.user?.id ?? null;
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel("whitbyos-messages")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "whitbyos_messages" },
          (payload) => {
            const row = payload.new as
              | { id?: string; status?: string; sender_id?: string }
              | null;

            // Somebody mid-sentence. See the note above on why this is here and
            // not in the subscription.
            if (!row?.id || row.status !== "sent") return;

            // Your own message is already on screen — it was drawn optimistically
            // and the action that sent it revalidates. Refreshing again here made
            // every send render the page a third time.
            if (row.sender_id && me && row.sender_id === me) return;

            // This browser is the other side, and this is the moment the
            // message reached it — the only moment anything can say so.
            void markDelivered(row.id);

            refresh();
          },
        )
        /* A reaction is a change to a message that is not a row in
           `whitbyos_messages` — 096 put it in its own table, and without this
           a thumb from the other side arrives on the next reload. */
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "whitbyos_message_reactions" },
          () => refresh(),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            stopPolling();
            // Anything that landed while the socket was down is read on the way
            // in, so reconnecting is never the same as having missed it.
            refresh();
            return;
          }
          startPolling();
        });
    })();

    return () => {
      cancelled = true;
      stopPolling();
      auth.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}

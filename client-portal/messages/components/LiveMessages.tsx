"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/base/lib/supabase/client";
import { markDelivered } from "@/client-portal/lib/actions/messages";

/** How often the screen re-reads itself while the socket is not carrying rows. */
const FALLBACK_POLL_MS = 15_000;

/**
 * Keeps the inbox and the open conversation current without a reload.
 *
 * The portal's counterpart to whitbyos/messages/components/LiveMessages, and it
 * listens on the same publication (whitbyos/016, repeated in
 * client-portal/004). A client waiting on their professional should not have to
 * refresh to find out they answered.
 *
 * Rows arrive through the same RLS as any query, so a client is only ever sent
 * what they could already have read. There is no socket server involved: this
 * is Supabase Realtime over its own connection.
 *
 * THE TOKEN IS SET BEFORE THE CHANNEL IS JOINED, AND THAT IS THE WHOLE POINT
 *
 * Realtime decides what to send a subscriber by running the table's RLS as
 * whoever the socket says they are. The portal's read policy
 * (`whitbyos_messages_select_client`) resolves through `portal_in_thread()`,
 * which is built on `auth.uid()` — so a socket carrying only the anon key
 * matches no thread, is sent no rows, and fails completely silently. The page
 * still renders every message on a reload, because that read goes through the
 * server with the session cookie attached, which is exactly the symptom:
 * everything is there, nothing arrives.
 *
 * supabase-js reads the session asynchronously, so joining in the same tick as
 * `createClient()` is a race against it. `getSession()` and an explicit
 * `realtime.setAuth()` settle that race before the channel is joined, and
 * `onAuthStateChange` keeps the socket on the current token afterwards — an
 * access token lasts an hour and a conversation can outlast one.
 *
 * `status` IS FILTERED HERE AND NOT ON THE SERVER
 *
 * WhitbyOS autosaves a professional's reply as a draft while they type, and a
 * client must never see one. It never could: 001's select policy already
 * forbids reading a draft, so nothing about this is enforced by the
 * subscription. A server-side `status=eq.sent` filter only decided whether the
 * *draft-to-sent update* — which is how WhitbyOS sends a reply it autosaved —
 * counted as a match, and that is the single event this screen exists to
 * receive. It is checked below instead, where the row in hand is the one being
 * judged.
 *
 * AND IT STILL REFRESHES IF THE SOCKET NEVER OPENS
 *
 * A blocked WebSocket, a sleeping laptop, a dropped channel: none of those
 * should mean a client sits in front of an answer they cannot see. Whenever the
 * channel is anything other than subscribed, the screen re-reads itself on a
 * timer, and stops as soon as the channel is live again.
 */
export function LiveMessages({
  enabled,
  contactId,
}: {
  enabled: boolean;
  /**
   * Who this reader is on a thread. A client sits on one as a `contact`, so
   * their own messages carry `sender_id = contact_id` — which is how their own
   * send is told apart from somebody else's arrival.
   */
  contactId: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    // A demo session has no Supabase credentials to open a channel with, and
    // nothing behind it to receive: its messages are fixtures.
    if (!enabled) return;

    const supabase = createClient();

    let cancelled = false;
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
        // A background tab is nobody reading. Refreshing it burns a render and
        // a round trip to update a screen that is not on screen.
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

      // No session is not an error here — the layout will have sent them to
      // sign in — but it is a socket that would be sent nothing, so the timer
      // is left running rather than joining a channel that cannot deliver.
      if (!session?.access_token) return;

      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel("client-portal-messages")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "whitbyos_messages" },
          (payload) => {
            const row = payload.new as
              | { id?: string; status?: string; sender_id?: string }
              | null;

            // A draft is not a message. See the note above on why this is here
            // and not in the subscription.
            if (!row?.id || row.status !== "sent") return;

            // Their own message is already on screen — `sendMessage` revalidates
            // and redirects back to the thread. Refreshing again here rendered
            // the page a second time for every send.
            if (row.sender_id && contactId && row.sender_id === contactId) return;

            // This browser is the other side, and this is the moment the message
            // reached it — the only moment anything can say so.
            void markDelivered(row.id);

            refresh();
          },
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
  }, [contactId, enabled, router]);

  return null;
}

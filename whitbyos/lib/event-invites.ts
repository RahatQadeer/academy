import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { directThreadOn } from "@/whitbyos/lib/direct-thread";
import { listRecipients } from "@/whitbyos/lib/messages";
import { notifyClientContacts, notifyPeople } from "@/whitbyos/lib/notify";

const MESSAGES = "/whitbyos/messages";

/**
 * Telling the people in a meeting that there is a meeting.
 *
 * An event with three names on it changed nothing for any of them: the client
 * saw nothing in their portal, the teammate saw nothing at all, and whoever
 * made it had to go and say so by hand in three conversations.
 *
 * So it is said where a firm says things: in the conversation with that
 * person, about the work it belongs to. An event filed under a Request goes
 * into that Request's conversation with them — opened if it exists, started if
 * it does not, which is the same pairing New Message follows. An event filed
 * under nothing goes into the general conversation with them, for the same
 * reason.
 *
 * Attendees are free text and always will be, because a meeting can have a
 * registrar in it who is in none of Whitby's lists. Whoever the names match is
 * written to; whoever they do not is simply on the event.
 *
 * Best effort throughout: a message that will not write must not undo an event
 * that is already in the calendar.
 */
export async function tellAttendees(input: {
  workspaceId: string;
  /** Names as they were typed, comma separated. */
  attendees: string | null;
  title: string;
  /** When it is, already written out in the workspace's own words. */
  when: string;
  requestId: string | null;
  clientId: string | null;
  eventId: string;
}): Promise<number> {
  const names = (input.attendees ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length === 0) return 0;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const everyone = await listRecipients();
    const fold = (name: string) => name.trim().toLowerCase();

    const matched = names
      .map((name) => everyone.find((person) => fold(person.name) === fold(name)) ?? null)
      .filter((person): person is NonNullable<typeof person> => Boolean(person))
      // A provider is a firm reached by email, which is not connected, so there
      // is nowhere to write to.
      .filter((person) => person.kind !== "provider");

    if (matched.length === 0) return 0;

    const body = `${input.title}, ${input.when}. You are on the invitation.`;
    const TYPE: Record<string, string> = { contact: "contact", teammate: "user" };

    let told = 0;

    for (const person of matched) {
      const type = TYPE[person.kind] ?? "contact";

      const thread = await directThreadOn(supabase, {
        workspaceId: input.workspaceId,
        userId: user.id,
        type,
        participantId: person.id,
        requestId: input.requestId,
        clientId: input.clientId,
      });

      if (!thread) continue;

      await supabase.from("whitbyos_messages").insert({
        workspace_id: input.workspaceId,
        thread_id: thread.id,
        request_id: input.requestId,
        client_id: input.clientId,
        sender_type: "user",
        sender_id: user.id,
        body,
        status: "sent",
        source: "whitbyos",
      });

      await supabase
        .from("whitbyos_message_threads")
        .update({ last_message_at: new Date().toISOString(), archived_at: null })
        .eq("id", thread.id);

      /* And a notice, because a message in a conversation nobody has open is
         a message nobody has seen. */
      if (type === "user") {
        await notifyPeople({
          workspaceId: input.workspaceId,
          userIds: [person.id],
          kind: "calendar_event",
          title: `You are on ${input.title}`,
          body: input.when,
          href: `${MESSAGES}?tab=direct&thread=${thread.id}`,
          entityType: "calendar_event",
          entityId: input.eventId,
          skipUserId: user.id,
        });
      } else {
        /*
         * A calendar change, told as a calendar change.
         *
         * This used to be raised as `new_message`, because the notice is
         * delivered into a conversation and the conversation is where the
         * client reads it. But `event` is not where a notice is *put* — it is
         * what a client is being told about, and it is the key their own
         * Notifications screen switches off by. Filed as a message, this had
         * two consequences the client could not see: turning off "New
         * message" also turned off every appointment they were added to, and
         * the "Calendar change" switch sitting right below it governed
         * nothing at all.
         *
         * `area` stays `messages`: it is still a conversation they have to be
         * able to reach, and a notice that lands somewhere a client cannot
         * open is worse than no notice.
         */
        await notifyClientContacts({
          workspaceId: input.workspaceId,
          clientId: input.clientId,
          event: "calendar_change",
          area: "messages",
          kind: "calendar_event",
          title: `You are on ${input.title}`,
          body: input.when,
          href: `/client-portal/messages?thread=${thread.id}`,
          entityType: "calendar_event",
          entityId: input.eventId,
          onlyContactIds: [person.id],
        });
      }

      told += 1;
    }

    return told;
  } catch {
    // Same contract as notify.ts: telling somebody must not fail the thing it
    // was about.
    return 0;
  }
}

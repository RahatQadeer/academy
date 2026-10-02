"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { createServiceClient } from "@/base/lib/supabase/service";
import { listMessageablePeople } from "@/client-portal/lib/data/people";
import { TOASTS } from "@/client-portal/lib/toasts";
import { requireLiveContext, requireWrite, text, toastUrl } from "./guard";

const MESSAGES_PATH = "/client-portal/messages";

/**
 * Opening a thread marks it read, through the security-definer function added in
 * client-portal/003 — the portal has no update policy on the participants table
 * on purpose, since RLS grants a whole row and that one carries the columns
 * deciding how far back a client may read.
 */
export async function markThreadRead(threadId: string) {
  if (!threadId) return;

  const ctx = await requireLiveContext();
  if (!ctx) return;

  const supabase = await createClient();
  await supabase.rpc("portal_mark_thread_read", { p_thread_id: threadId });

  revalidatePath(MESSAGES_PATH);
}

/**
 * Records that a message reached this client.
 *
 * `whitbyos_messages.delivered_at` (whitbyos/035) is the middle tick — arrived,
 * but not opened. It is written by the recipient's own browser the first time
 * Realtime hands it a message it did not send, because that is the only moment
 * anything knows the message landed. Whitby writes it from its own
 * `LiveMessages`; without this, a professional watching a thread would never
 * see the second tick on anything sent to a client, and would be told
 * "Sent. Not delivered yet." about a message the client was reading.
 *
 * Not a call into `whitbyos/messages/actions.ts`. That version checks the
 * participant seat with `participant_id = auth.uid()`, which is right for a
 * teammate and never true here: a client sits on the thread as a `contact`,
 * keyed by `contact_id`. It would refuse every portal delivery silently.
 *
 * Service role and guarded here rather than by RLS, for the reason Whitby's
 * version gives: the portal's policies let a client read a message and not
 * write one, and widening them to allow this write would hand a client every
 * other column on the row. The guard is the same either way — you must be a
 * participant of the thread, and you must not be the sender.
 */
export async function markDelivered(messageId: string) {
  if (!messageId) return;

  const ctx = await requireLiveContext();
  if (!ctx) return;

  const supabase = await createClient();

  const { data: message } = await supabase
    .from("whitbyos_messages")
    .select("id, thread_id, sender_id, delivered_at")
    .eq("id", messageId)
    .maybeSingle();

  // Readable at all means it is a thread of theirs, but nothing already
  // delivered is moved, and your own message never delivers to you.
  if (!message || message.delivered_at || message.sender_id === ctx.contactId) {
    return;
  }

  const { data: seat } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id")
    .eq("thread_id", message.thread_id as string)
    .eq("participant_type", "contact")
    .eq("participant_id", ctx.contactId)
    .is("removed_at", null)
    .maybeSingle();

  if (!seat) return;

  const service = createServiceClient();
  if (!service) return;

  // `is null` so the first arrival is the one that counts — a second member of
  // the account, or the same person on another device, cannot move the moment
  // later.
  await service
    .from("whitbyos_messages")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("delivered_at", null);
}

export async function sendMessage(formData: FormData) {
  const threadId = formData.get("threadId");
  const body = text(formData, "body");
  const threadPath =
    typeof threadId === "string" && threadId
      ? `${MESSAGES_PATH}?thread=${threadId}`
      : MESSAGES_PATH;

  if (!body || typeof threadId !== "string" || !threadId) {
    redirect(toastUrl(threadPath, "Write a message before sending."));
  }

  const guard = await requireWrite("messages");
  if ("reason" in guard) redirect(toastUrl(threadPath, guard.reason));
  const { ctx } = guard;

  const supabase = await createClient();

  // Membership is re-checked here, not just at render — a stale tab must not be
  // able to post into a thread the client was since removed from.
  const { data: participant } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id")
    .eq("thread_id", threadId)
    .eq("participant_type", "contact")
    .eq("participant_id", ctx.contactId)
    .is("removed_at", null)
    .maybeSingle();

  if (!participant) {
    redirect(toastUrl(MESSAGES_PATH, "You are no longer part of that conversation."));
  }

  const { error } = await supabase.from("whitbyos_messages").insert({
    workspace_id: ctx.workspaceId,
    thread_id: threadId,
    client_id: ctx.clientId,
    sender_type: "contact",
    sender_id: ctx.contactId,
    body,
    // Stated rather than left to the column default: the portal's insert policy
    // requires 'sent', so this is what makes the row legal, not a convenience.
    status: "sent",
    source: "native",
  });

  if (error) {
    redirect(toastUrl(threadPath, "Could not send. Please try again."));
  }

  // No redirect on success, and no toast. Every other action in the portal
  // confirms itself with one because it leaves you looking at a list that does
  // not obviously contain what you just did; a reply is different — it appears
  // in the conversation you are already reading, which says "sent" better than
  // a sentence in the corner does.
  //
  // It is also what stops the screen going blank. A redirect here changed the
  // URL, so the send became a navigation: the route re-suspended, `loading.tsx`
  // took over the whole content area, and because that skeleton is held back
  // 120ms the client watched their conversation flash white on every message.
  // `revalidatePath` alone re-renders the thread in place, with the form reset
  // and the new message on the end of it.
  revalidatePath(MESSAGES_PATH);
}

const NEW_PATH = `${MESSAGES_PATH}?new=1`;

/**
 * Screen 13.6 has no new-conversation affordance drawn on it, and the empty
 * state used to say so: "your team can start one from any request". That is a
 * fair description of how threads have always begun, and a poor answer to a
 * client with something to say and no open Request to say it against — their
 * only route was to raise a Request they did not want in order to send one
 * message.
 *
 * `portal_start_thread()` (client-portal/004) is the write. Three tables have to
 * move together — the thread row the professional's inbox lists from, the
 * participant seat that makes it the client's, and the first message — and the
 * client's own policies cannot do it: between the thread insert and the
 * participant insert there is no seat yet, so they cannot SELECT the row they
 * just wrote and `insert ... returning` fails. The function does all three in
 * one transaction, `security definer`, granted to `authenticated` only.
 *
 * A thread starts with one participant, which is correct rather than incomplete:
 * Whitby's inbox lists every thread in the workspace (`listThreads` in
 * `whitbyos/lib/messages.ts`), so it arrives in front of the whole team, and
 * whoever picks it up adds themselves. `kind` is 'direct' for the same reason —
 * a client-started thread has exactly one participant until the workspace joins.
 */
export async function startConversation(formData: FormData) {
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  const requestId = text(formData, "requestId");
  const recipientContactId = text(formData, "recipientContactId");

  if (!subject) {
    redirect(toastUrl(NEW_PATH, "Give the conversation a subject."));
  }
  if (!body) {
    redirect(toastUrl(NEW_PATH, "Write your first message."));
  }

  const guard = await requireWrite("messages");
  if ("reason" in guard) redirect(toastUrl(MESSAGES_PATH, guard.reason));

  // The RPC resolves the contact, client and workspace itself from
  // `portal_contact_id()`, so nothing off the guard is passed to it — the guard
  // is here to refuse the write, not to supply it.
  const supabase = await createClient();

  // The Request the conversation is about, if they named one. Re-read under the
  // client's own policies rather than trusted from the form: the select is a
  // rendering of what they could see when the page loaded, and the RPC would
  // otherwise be handed an id from a page that is minutes old. `portal_start_thread`
  // checks it again with `portal_request_client_ok`; this is the check that can
  // say something useful about it.
  if (requestId) {
    const { data: request } = await supabase
      .from("whitbyos_requests")
      .select("id")
      .eq("id", requestId)
      .maybeSingle();

    if (!request) {
      redirect(toastUrl(NEW_PATH, "That request is no longer available to you."));
    }
  }

  // The recipient is re-checked the same way and for the same reason: it is an
  // id off a form, and the person it names may have been removed from the
  // account since the page rendered. `portal_start_thread` refuses an unknown
  // one itself (011); this is the check that can say why.
  if (recipientContactId) {
    const people = await listMessageablePeople();
    if (!people.some((person) => person.contactId === recipientContactId)) {
      redirect(toastUrl(NEW_PATH, "That person is no longer on this account."));
    }
  }

  // The fourth argument is only sent when there is one to send. A three-argument
  // call is what every environment understands — 011 gives the parameter a
  // default precisely so the "message my team" path is unchanged by it — and
  // omitting it means an account that has not applied 011 keeps working for the
  // conversation it could already start, rather than failing on both.
  const { data, error } = await supabase.rpc(
    "portal_start_thread",
    recipientContactId
      ? {
          p_subject: subject,
          p_body: body,
          p_request_id: requestId,
          p_recipient_contact_id: recipientContactId,
        }
      : { p_subject: subject, p_body: body, p_request_id: requestId },
  );

  if (error) {
    redirect(
      toastUrl(MESSAGES_PATH, startThreadMessage(error, Boolean(recipientContactId))),
    );
  }

  revalidatePath(MESSAGES_PATH);

  // Straight into the conversation they just started, which is where they were
  // going anyway. `data` is the new thread's id; falling back to the list keeps
  // the redirect honest if the function ever returns nothing.
  redirect(
    toastUrl(
      typeof data === "string" && data
        ? `${MESSAGES_PATH}?thread=${data}`
        : MESSAGES_PATH,
      TOASTS.conversationStarted,
    ),
  );
}

/**
 * What to say when the RPC refuses.
 *
 * `client-portal/004` re-signs `portal_start_thread` as
 * `(p_subject, p_body, p_request_id)`; the version in `001` takes two arguments
 * and never wrote the thread row at all. On an environment where 004 has not
 * been applied, PostgREST cannot find a function of this shape and answers
 * PGRST202 — which is a deployment fact, not something the client did, and must
 * not reach them as "could not send, please try again". Retrying would never
 * work.
 *
 * Everything else is one of the function's own `raise exception` messages, all
 * of which describe a broken identity chain rather than a bad message.
 */
function startThreadMessage(
  error: { code?: string; message?: string },
  namedSomeone = false,
): string {
  if (error.code === "PGRST202" || /portal_start_thread/i.test(error.message ?? "")) {
    // Two different deployment states reach this branch, and they are not the
    // same news. Without 011 the four-argument call is the only one that fails,
    // so the team is still reachable and saying otherwise would send a client
    // to the phone over a conversation they could have started here.
    return namedSomeone
      ? "Writing to someone else on this account is not switched on yet. You can still start a conversation with your team."
      : "Starting a conversation is not switched on for this account yet. Your team can start one for you.";
  }
  return "Could not start that conversation. Please try again.";
}

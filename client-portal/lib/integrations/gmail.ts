import { createServiceClient } from "@/base/lib/supabase/service";
import { normalizeEmail } from "@/base/lib/email";
import { grantFor, markNeedsAttention, markSynced, saveCursor } from "./connection";
import { settingOn } from "./catalog";
import { addressIn, displayNameIn, header, textOf, type GmailMessage } from "./gmail-message";
import {
  MAIL_HREF,
  allowedSources,
  alreadyRead,
  outcomeOf,
  storeReading,
  type MailMessage,
  type SyncOutcome,
} from "./mail";

/**
 * A client's Gmail — `whitbyos/lib/gmail-sync.ts` and `gmail-context.ts`, for a
 * person instead of a practice.
 *
 * The model is Whitby's, step for step. Connecting says the mailbox *may* be
 * read; nothing is read until the client names people. Mail to or from those
 * people in the last thirty days is fetched, handed to the model, and what comes
 * back — one sentence and the facts worth acting on — is stored. The message
 * body is not stored anywhere. Everything else in the mailbox is never opened.
 *
 * What differs is who it is for. Whitby files a reading against a client for
 * the whole practice to see; here it is the client's own note about their own
 * correspondence, readable by them and nobody else (client-portal/018).
 *
 * Only the fetching lives here. Choosing who may be read, asking the model,
 * keeping the answer and reading it back are `mail.ts`, which Outlook Mail
 * shares — the two mailboxes differ in how you ask for messages and in
 * nothing else.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const WINDOW = "newer_than:30d";
/** One run's ceiling, so a busy mailbox cannot spend an unbounded model bill. */
const MAX_MESSAGES = 40;
/** How long a reading stays fresh before opening the portal earns another. */
const STALE_AFTER_MS = 10 * 60 * 1000;

export const GMAIL_HREF = MAIL_HREF.gmail;

/**
 * Read what the chosen people have exchanged with this client, and keep the
 * reading. Best effort: a failure marks the connection Needs attention, which
 * Integrations draws, rather than throwing at whoever triggered it.
 */
export async function syncGmail(contactId: string): Promise<SyncOutcome> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "The server is missing its credentials." };

  const { data: integration } = await supabase
    .from("client_portal_integrations")
    .select("workspace_id, client_id, sync_settings")
    .eq("contact_id", contactId)
    .eq("provider", "gmail")
    .neq("status", "disconnected")
    .maybeSingle();

  if (!integration) return { ok: false, error: "Gmail is not connected." };

  const grant = await grantFor(contactId, "gmail");
  if (!grant) return { ok: false, error: "Gmail is not connected." };

  const workspaceId = (integration.workspace_id as string | null) ?? undefined;
  const clientId = (integration.client_id as string | null) ?? null;
  const settings = (integration.sync_settings as Record<string, boolean>) ?? {};

  const allowed = await allowedSources(contactId, "gmail");

  // Nobody named is a complete answer, not a failure.
  if (allowed.size === 0) {
    await markSynced(contactId, "gmail");
    return { ok: true, count: 0 };
  }

  const terms = [...allowed.keys()].flatMap((email) => [`from:${email}`, `to:${email}`]).join(" OR ");
  const list = new URL(`${API}/messages`);
  list.searchParams.set("q", `(${terms}) ${WINDOW}`);
  list.searchParams.set("maxResults", String(MAX_MESSAGES));
  if (settingOn(settings, "include_spam", "gmail")) list.searchParams.set("includeSpamTrash", "true");

  const listed = await fetch(list.toString(), {
    headers: { Authorization: `Bearer ${grant.accessToken}` },
    cache: "no-store",
  });

  if (!listed.ok) {
    await markNeedsAttention(contactId, "gmail", "Gmail did not answer. Try connecting it again.");
    return { ok: false, error: (await listed.text()).slice(0, 200) };
  }

  const ids = (((await listed.json()) as { messages?: { id?: string }[] }).messages ?? [])
    .map((row) => row.id)
    .filter(Boolean) as string[];

  let count = 0;
  /** Fetched, handed to the model, and dropped because it did not answer. */
  let unread = 0;
  let lastError: string | undefined;

  if (ids.length > 0) {
    const seen = await alreadyRead(contactId, "gmail", ids);

    for (const id of ids.filter((one) => !seen.has(one))) {
      const response = await fetch(`${API}/messages/${id}?format=full`, {
        headers: { Authorization: `Bearer ${grant.accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) continue;

      const message = (await response.json()) as GmailMessage;
      const built = toMailMessage(message, id, allowed);
      if (!built) continue;

      const outcome = await storeReading({
        contactId,
        provider: "gmail",
        workspaceId,
        clientId,
        message: built,
      });

      if (outcome === "stored") count += 1;
      else if (outcome === "unread") {
        unread += 1;
        lastError = "The reading could not be made.";
      }
    }
  }

  const profile = await fetch(`${API}/profile`, {
    headers: { Authorization: `Bearer ${grant.accessToken}` },
    cache: "no-store",
  });
  if (profile.ok) {
    const { historyId } = (await profile.json()) as { historyId?: string };
    await saveCursor(contactId, "gmail", historyId ?? null);
  }

  /*
   * Stamped as synced either way — the mailbox *was* read, and leaving the
   * clock alone would retry every failing message on every page load. But a
   * run where new mail arrived and none of it could be summarised is not a
   * success, and Sync now says so rather than reporting nothing new.
   *
   * Deliberately not `markNeedsAttention`: that draws Reconnect on the row,
   * and reconnecting Gmail fixes nothing when the fault is the model.
   */
  await markSynced(contactId, "gmail");
  return outcomeOf(count, unread, lastError);
}

/**
 * One Gmail message in the shape `mail.ts` keeps, or null if it is not with
 * anybody chosen.
 *
 * Gmail's own matching is looser than equality — an alias satisfies `from:` —
 * so both directions are confirmed against the list here rather than trusted
 * from the search that returned the message.
 */
function toMailMessage(
  message: GmailMessage,
  id: string,
  allowed: Map<string, string>,
): MailMessage | null {
  const from = header(message.payload, "From");
  const sender = addressIn(from);

  let sourceId = allowed.get(sender);
  let direction: "incoming" | "outgoing" = "incoming";
  let counterparty = sender;

  if (!sourceId) {
    const recipients = [header(message.payload, "To"), header(message.payload, "Cc")]
      .filter(Boolean)
      .join(",")
      .split(",")
      .map((part) => addressIn(part))
      .filter(Boolean);

    for (const address of recipients) {
      const match = allowed.get(address);
      if (match) {
        sourceId = match;
        direction = "outgoing";
        counterparty = address;
        break;
      }
    }
  }

  if (!sourceId) return null;

  const body = textOf(message.payload).slice(0, 12_000);
  if (!body.trim()) return null;

  return {
    id,
    threadId: message.threadId ?? null,
    fromEmail: normalizeEmail(sender),
    fromName: displayNameIn(from),
    subject: header(message.payload, "Subject"),
    snippet: message.snippet ?? null,
    receivedAt: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : null,
    body,
    direction,
    sourceId,
    counterparty,
  };
}

/** Sync, if the last one is old enough to be worth repeating. Never throws. */
export async function syncGmailIfStale(contactId: string | null): Promise<void> {
  if (!contactId) return;
  try {
    const supabase = createServiceClient();
    if (!supabase) return;

    const { data } = await supabase
      .from("client_portal_integrations")
      .select("last_sync_at")
      .eq("contact_id", contactId)
      .eq("provider", "gmail")
      .eq("status", "connected")
      .maybeSingle();

    if (!data) return;
    const last = data.last_sync_at ? new Date(data.last_sync_at as string).getTime() : 0;
    if (Date.now() - last < STALE_AFTER_MS) return;

    await syncGmail(contactId);
  } catch {
    // Reading a mailbox must never take a page down with it.
  }
}

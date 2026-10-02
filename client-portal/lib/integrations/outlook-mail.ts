import { createServiceClient } from "@/base/lib/supabase/service";
import { normalizeEmail } from "@/base/lib/email";
import { grantFor, markNeedsAttention, markSynced } from "./connection";
import { settingOn } from "./catalog";
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
 * A client's Outlook mailbox — `gmail.ts`, asked of Microsoft Graph.
 *
 * Same product, same promise: nothing is read until the client names people,
 * only mail with those people is opened, only the summary and the facts are
 * kept, and the body is stored nowhere. `mail.ts` does all of that; this file
 * is the Graph half — how you ask for the messages exchanged with an address,
 * which is the one thing the two mailboxes do not share.
 *
 * WHY TWO QUERIES RATHER THAN ONE
 *
 * Gmail answers `(from:a OR to:a) newer_than:30d` in a single search. Graph
 * does not: `$search` and `$filter` cannot be combined on a message query, and
 * `$filter` cannot mix a date comparison with a lambda over `toRecipients`
 * without tipping into an unsupported combination. So incoming is filtered on
 * the sender, and outgoing is read from Sent Items and matched locally — which
 * is the same two directions Gmail's one query returns.
 */

const API = "https://graph.microsoft.com/v1.0/me";
/** How far back a run reads, matching Gmail's `newer_than:30d`. */
const WINDOW_DAYS = 30;
/** One run's ceiling, so a busy mailbox cannot spend an unbounded model bill. */
const MAX_MESSAGES = 40;
const STALE_AFTER_MS = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const FIELDS =
  "id,conversationId,subject,bodyPreview,receivedDateTime,from,toRecipients,ccRecipients,body";

export const OUTLOOK_MAIL_HREF = MAIL_HREF.outlook_mail;

type GraphAddress = { emailAddress?: { name?: string; address?: string } };

type GraphMessage = {
  id?: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  ccRecipients?: GraphAddress[];
  body?: { contentType?: string; content?: string };
};

function addressOf(entry: GraphAddress | undefined) {
  return normalizeEmail(entry?.emailAddress?.address ?? "");
}

/** Graph gives HTML unless the mailbox is plain-text — the same reduction Gmail's parts get. */
function textOf(body: GraphMessage["body"]): string {
  const content = body?.content ?? "";
  if ((body?.contentType ?? "").toLowerCase() !== "html") return content.replace(/\s+/g, " ").trim();

  return content
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A single-quoted OData literal. An apostrophe in an address is doubled, not escaped. */
function odataString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function graph(
  path: string,
  accessToken: string,
): Promise<{ ok: true; value: GraphMessage[] } | { ok: false; error: string }> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Graph returns HTML bodies by default; asking for text costs a
      // conversion on their side and saves the stripping on ours. It is only
      // a preference — `textOf` still handles HTML when it is ignored.
      Prefer: 'outlook.body-content-type="text"',
    },
    cache: "no-store",
  });

  if (!response.ok) return { ok: false, error: (await response.text()).slice(0, 200) };

  const page = (await response.json()) as { value?: GraphMessage[] };
  return { ok: true, value: page.value ?? [] };
}

/**
 * Read what the chosen people have exchanged with this client, and keep the
 * reading. Best effort, as Gmail's is: a mailbox that will not answer marks
 * the connection Needs attention rather than throwing at the caller.
 */
export async function syncOutlookMail(contactId: string): Promise<SyncOutcome> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "The server is missing its credentials." };

  const { data: integration } = await supabase
    .from("client_portal_integrations")
    .select("workspace_id, client_id, sync_settings")
    .eq("contact_id", contactId)
    .eq("provider", "outlook_mail")
    .neq("status", "disconnected")
    .maybeSingle();

  if (!integration) return { ok: false, error: "Outlook Mail is not connected." };

  const grant = await grantFor(contactId, "outlook_mail");
  if (!grant) return { ok: false, error: "Outlook Mail is not connected." };

  const workspaceId = (integration.workspace_id as string | null) ?? undefined;
  const clientId = (integration.client_id as string | null) ?? null;
  const settings = (integration.sync_settings as Record<string, boolean>) ?? {};

  const allowed = await allowedSources(contactId, "outlook_mail");

  // Nobody named is a complete answer, not a failure.
  if (allowed.size === 0) {
    await markSynced(contactId, "outlook_mail");
    return { ok: true, count: 0 };
  }

  const since = new Date(Date.now() - WINDOW_DAYS * DAY).toISOString();
  const addresses = [...allowed.keys()];

  // Incoming: the sender is somebody chosen. Filtered by Graph, so a busy
  // mailbox cannot push a chosen person's mail off the first page.
  const senders = addresses
    .map((email) => `from/emailAddress/address eq ${odataString(email)}`)
    .join(" or ");

  const inbound = await graph(
    `/messages?$select=${FIELDS}&$top=${MAX_MESSAGES}&$orderby=receivedDateTime desc` +
      `&$filter=${encodeURIComponent(`receivedDateTime ge ${since} and (${senders})`)}`,
    grant.accessToken,
  );

  if (!inbound.ok) {
    await markNeedsAttention(
      contactId,
      "outlook_mail",
      "Outlook did not answer. Try connecting it again.",
    );
    return { ok: false, error: inbound.error };
  }

  // Outgoing: Sent Items in the same window, matched on recipients here —
  // see the note at the top for why this is not one query with the above.
  const sent = settingOn(settings, "include_sent", "outlook_mail")
    ? await graph(
        `/mailFolders/sentitems/messages?$select=${FIELDS}&$top=${MAX_MESSAGES}` +
          `&$orderby=receivedDateTime desc` +
          `&$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}`,
        grant.accessToken,
      )
    : { ok: true as const, value: [] as GraphMessage[] };

  // Sent Items failing is not the mailbox failing: the inbound half is the
  // half that matters, and a tenant can hide that folder on its own.
  const outbound = sent.ok ? sent.value : [];

  const messages = [...inbound.value, ...outbound];
  const ids = messages.map((message) => message.id).filter(Boolean) as string[];

  let count = 0;
  /** Fetched, handed to the model, and dropped because it did not answer. */
  let unread = 0;
  let lastError: string | undefined;

  if (ids.length > 0) {
    const seen = await alreadyRead(contactId, "outlook_mail", ids);

    for (const message of messages) {
      if (!message.id || seen.has(message.id)) continue;
      if (count + unread >= MAX_MESSAGES) break;

      const built = toMailMessage(message, allowed);
      if (!built) continue;

      const outcome = await storeReading({
        contactId,
        provider: "outlook_mail",
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

  // Synced either way, and honest about a run that read nothing it fetched —
  // the same rule as Gmail's, and `outcomeOf` is where it is written down.
  await markSynced(contactId, "outlook_mail");
  return outcomeOf(count, unread, lastError);
}

/**
 * One Graph message in the shape `mail.ts` keeps, or null if it is not with
 * anybody chosen.
 *
 * The direction is decided here rather than from which query returned it: a
 * message the client sent to themselves, or one from a chosen person that also
 * sits in Sent Items, would otherwise be filed by where it was found instead
 * of by who wrote it.
 */
function toMailMessage(message: GraphMessage, allowed: Map<string, string>): MailMessage | null {
  if (!message.id) return null;

  const sender = addressOf(message.from);

  let sourceId = allowed.get(sender);
  let direction: "incoming" | "outgoing" = "incoming";
  let counterparty = sender;

  if (!sourceId) {
    const recipients = [...(message.toRecipients ?? []), ...(message.ccRecipients ?? [])]
      .map(addressOf)
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

  const body = textOf(message.body).slice(0, 12_000);
  if (!body.trim()) return null;

  return {
    id: message.id,
    threadId: message.conversationId ?? null,
    fromEmail: sender,
    fromName: message.from?.emailAddress?.name?.trim() || null,
    subject: message.subject?.trim() || null,
    snippet: message.bodyPreview?.trim() || null,
    receivedAt: message.receivedDateTime
      ? new Date(message.receivedDateTime).toISOString()
      : null,
    body,
    direction,
    sourceId,
    counterparty,
  };
}

/** Sync, if the last one is old enough to be worth repeating. Never throws. */
export async function syncOutlookMailIfStale(contactId: string | null): Promise<void> {
  if (!contactId) return;
  try {
    const supabase = createServiceClient();
    if (!supabase) return;

    const { data } = await supabase
      .from("client_portal_integrations")
      .select("last_sync_at")
      .eq("contact_id", contactId)
      .eq("provider", "outlook_mail")
      .eq("status", "connected")
      .maybeSingle();

    if (!data) return;
    const last = data.last_sync_at ? new Date(data.last_sync_at as string).getTime() : 0;
    if (Date.now() - last < STALE_AFTER_MS) return;

    await syncOutlookMail(contactId);
  } catch {
    // Reading a mailbox must never take a page down with it.
  }
}

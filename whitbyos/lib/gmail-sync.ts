import { createClient } from "@/base/lib/supabase/server";
import { createServiceClient } from "@/base/lib/supabase/service";
import { generateJson } from "@/whitbyos/lib/ai/provider";
import {
  GMAIL_PROVIDER,
  gmailGrant,
  markGmailNeedsAttention,
  markGmailSynced,
  normalizeEmail,
  saveGmailCursor,
} from "@/whitbyos/lib/gmail";
import type { GmailSelectedSource } from "@/whitbyos/lib/gmail-context";
import {
  addressIn,
  displayNameIn,
  header,
  textOf,
  type GmailMessage,
} from "@/whitbyos/lib/gmail-message";
import { IN_APP, notifyWorkspaceMembers } from "@/whitbyos/lib/notify";

/**
 * Reading the allowed mail — SRS §11.1.
 *
 * Two halves. `saveGmailSources` records who the professional has allowed;
 * `syncGmailContext` reads what those people sent and keeps the reading.
 *
 * The body is never stored. A message is fetched, handed to the model, and
 * what comes back — a sentence and the facts worth acting on — is what lands
 * in the table. Keeping the mail beside it would be a second mail store with
 * none of Gmail's retention or deletion rules, which is not what a client
 * agreed to when they emailed their family office.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * How far back a first sync looks.
 *
 * Far enough that a newly connected mailbox has something to show, short
 * enough that connecting does not read a year of somebody's mail. Later syncs
 * are bounded by the same window and by what is already stored.
 */
const WINDOW = "newer_than:30d";

/** One run's ceiling, so a busy mailbox cannot spend an unbounded model bill. */
const MAX_MESSAGES = 40;

export type GmailSaveResult = { ok: true } | { ok: false; error: string };

/**
 * Replace the allowed list with exactly what was chosen.
 *
 * A replace rather than a merge, because the dialog sends the whole list and
 * un-ticking someone is the only way to withdraw permission. Removing someone
 * stops them being read from that moment on; `whitbyos_gmail_extracts.source_id`
 * is `on delete set null`, so what was already read stays as the professional's
 * note about work that has happened, with nothing left pointing at a permission
 * that no longer exists.
 *
 * Written with the caller's own client so the workspace's `_staff` policy is
 * what authorises it. This is the professional acting, not a background job.
 */
export async function saveGmailSources(
  workspaceId: string,
  userId: string,
  rows: GmailSelectedSource[],
): Promise<GmailSaveResult> {
  const supabase = await createClient();

  const emails = rows.map((row) => normalizeEmail(row.email)).filter(Boolean);

  // Gone first. An address removed and re-added in the same Save keeps its row
  // through the upsert below, so this only ever deletes real removals.
  let remove = supabase
    .from("whitbyos_gmail_context_sources")
    .delete()
    .eq("workspace_id", workspaceId);

  if (emails.length > 0) {
    remove = remove.not("email", "in", `(${emails.map((e) => `"${e}"`).join(",")})`);
  }

  const { error: removeError } = await remove;
  if (removeError) return { ok: false, error: removeError.message };

  if (rows.length === 0) return { ok: true };

  const { error } = await supabase.from("whitbyos_gmail_context_sources").upsert(
    rows.map((row) => ({
      workspace_id: workspaceId,
      kind: row.kind,
      source_id: row.sourceId,
      client_id: row.clientId,
      email: normalizeEmail(row.email),
      label: row.label,
      created_by_user_id: userId,
    })),
    { onConflict: "workspace_id,email" },
  );

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export type GmailSyncOutcome = { ok: boolean; error?: string; count?: number };

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    facts: { type: "array", items: { type: "string" } },
    relevant: { type: "boolean" },
  },
  required: ["summary", "facts", "relevant"],
};

const EXTRACT_SYSTEM = `You read one email on behalf of a family-office professional and
report what it means for their work. Answer with a one-sentence summary and a short list of
facts worth acting on: dates, amounts, decisions, requests, deadlines. Quote figures and
dates exactly as written. Set relevant to true only when the message needs the professional
to know or do something; a newsletter, a receipt for something routine, or a thank-you is
not relevant. If nothing is actionable, return an empty list of facts. Never invent a detail
the message does not contain.`;

/**
 * Read what the allowed people have sent, and keep the reading.
 *
 * Best effort by design: this is called after Save on Screen 16.2, where a
 * mailbox that cannot be read must not fail the saving of who may be read. A
 * failure marks the integration `needs_attention` and Screen 16 says so.
 *
 * The service role, not the caller's client: this runs with no session behind
 * it — the AI provider is told the workspace for the same reason.
 */
export async function syncGmailContext(workspaceId: string): Promise<GmailSyncOutcome> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "Server credentials are missing." };

  const grant = await gmailGrant(workspaceId);
  if (!grant) return { ok: false, error: "Gmail is not connected." };

  const { data: sources } = await supabase
    .from("whitbyos_gmail_context_sources")
    .select("id, kind, source_id, client_id, email")
    .eq("workspace_id", workspaceId);

  const allowed = new Map(
    (sources ?? []).map((row) => [
      normalizeEmail(row.email as string),
      {
        id: row.id as string,
        clientId: (row.client_id as string | null) ?? null,
        // Only a `contact` source points at a contact row. For a client the
        // source is the client, and for a teammate it is a user — neither
        // belongs in `contact_id`.
        contactId:
          row.kind === "contact" ? ((row.source_id as string | null) ?? null) : null,
      },
    ]),
  );

  // Nobody named is a complete answer, not a failure. The mailbox is connected
  // and there is nothing it is allowed to read.
  if (allowed.size === 0) {
    await markGmailSynced(workspaceId);
    return { ok: true, count: 0 };
  }

  // Both directions. `from:` is what a client sent the professional; `to:` is
  // what the professional sent back, which is context of exactly the same kind
  // — a plan drafted from only one half of a conversation is drafted from the
  // requests and none of the answers.
  const terms = [...allowed.keys()]
    .flatMap((email) => [`from:${email}`, `to:${email}`])
    .join(" OR ");
  const list = new URL(`${API}/messages`);
  list.searchParams.set("q", `(${terms}) ${WINDOW}`);
  list.searchParams.set("maxResults", String(MAX_MESSAGES));

  const listed = await fetch(list.toString(), {
    headers: { Authorization: `Bearer ${grant.accessToken}` },
    cache: "no-store",
  });

  if (!listed.ok) {
    const detail = await listed.text();
    await markGmailNeedsAttention(workspaceId, "Gmail did not answer.");
    return { ok: false, error: detail.slice(0, 200) };
  }

  const payload = (await listed.json()) as { messages?: { id?: string }[] };
  const ids = (payload.messages ?? []).map((row) => row.id).filter(Boolean) as string[];

  if (ids.length === 0) {
    await markGmailSynced(workspaceId);
    return { ok: true, count: 0 };
  }

  // What is already read is not read again — the window overlaps the last run
  // every time, and a re-read would spend the model on a message twice.
  const { data: stored } = await supabase
    .from("whitbyos_gmail_extracts")
    .select("gmail_message_id")
    .eq("workspace_id", workspaceId)
    .in("gmail_message_id", ids);

  const seen = new Set((stored ?? []).map((row) => row.gmail_message_id as string));
  const fresh = ids.filter((id) => !seen.has(id));

  let count = 0;

  for (const id of fresh) {
    const response = await fetch(`${API}/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${grant.accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) continue;

    const message = (await response.json()) as GmailMessage;
    const sender = addressIn(header(message.payload, "From"));

    /**
     * Who this message is with, and which way it went.
     *
     * Incoming is the simple case: the sender is somebody named. Outgoing is
     * the professional writing to one of them, so the allowed address is in
     * To or Cc instead — a header that can hold several addresses, hence the
     * split rather than `addressIn`, which reads only the first.
     *
     * Gmail's own matching is looser than an equality check: an alias or a
     * display name satisfies `from:`. Both sides are confirmed against the
     * allowed list here. The list is the consent; the query is only a filter.
     */
    let source = allowed.get(sender);
    let direction: "incoming" | "outgoing" = "incoming";
    let counterparty = sender;

    if (!source) {
      const recipients = [
        header(message.payload, "To"),
        header(message.payload, "Cc"),
      ]
        .filter(Boolean)
        .join(",")
        .split(",")
        .map((part) => addressIn(part))
        .filter(Boolean);

      for (const address of recipients) {
        const match = allowed.get(address);
        if (match) {
          source = match;
          direction = "outgoing";
          counterparty = address;
          break;
        }
      }
    }

    if (!source) continue;

    const body = textOf(message.payload).slice(0, 12_000);
    if (!body.trim()) continue;

    const subject = header(message.payload, "Subject");

    const read = await generateJson<{
      summary: string;
      facts: string[];
      relevant: boolean;
    }>({
      system: EXTRACT_SYSTEM,
      prompt:
        direction === "outgoing"
          ? `Subject: ${subject ?? "(none)"}\nThe professional wrote this, to ${counterparty}.\n\n${body}`
          : `Subject: ${subject ?? "(none)"}\nFrom: ${sender}\n\n${body}`,
      schema: EXTRACT_SCHEMA,
      workspaceId,
      feature: "gmail_context",
    });

    if (!read.ok) continue;

    const received = message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : null;

    const { data: saved, error } = await supabase
      .from("whitbyos_gmail_extracts")
      .upsert(
      {
        workspace_id: workspaceId,
        source_id: source.id,
        client_id: source.clientId,
        contact_id: source.contactId,
        gmail_message_id: id,
        gmail_thread_id: message.threadId ?? null,
        from_email: sender,
        from_name: displayNameIn(header(message.payload, "From")),
        subject,
        // Gmail's own preview line, which it returns beside the message. The
        // body it was taken from is not written anywhere.
        snippet: message.snippet ?? null,
        received_at: received,
        direction,
        summary: read.data.summary,
        extracted: { facts: read.data.facts ?? [] },
        relevant: read.data.relevant === true,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,gmail_message_id" },
    )
      .select("id")
      .maybeSingle();

    if (error) continue;
    count += 1;

    /**
     * The bell, for a message Whitby found something in.
     *
     * Incoming only. Outgoing mail is read for context, but a bell for a
     * message the professional wrote themselves, a moment after they wrote it,
     * is a notice about nothing they do not already know.
     *
     * Gated on `relevant` rather than raised for everything that arrives: a
     * mailbox that rings once per email is a mailbox somebody turns off, and
     * the extractor has already been asked to say whether there was anything
     * here. Members who would rather not hear from the mailbox at all switch
     * `gmail_context` off in 17.3.
     *
     * The extract's own id is the entity, so re-syncing a message that was
     * already stored cannot ring twice — the upsert returns the same row, and
     * `notifyWorkspaceMembers` refuses a second unread notice for an entity
     * somebody has not read yet.
     */
    if (direction === "incoming" && read.data.relevant === true && saved?.id) {
      await notifyWorkspaceMembers({
        workspaceId,
        event: IN_APP.gmailContext,
        title: `Email from ${displayNameIn(header(message.payload, "From")) || sender}`,
        body: read.data.summary,
        href: source.clientId ? `/whitbyos/clients/${source.clientId}` : "/whitbyos",
        entityType: "gmail_extract",
        entityId: saved.id as string,
      });
    }
  }

  // Gmail's own history id, taken after the read rather than before, so a
  // message that arrived mid-run is not skipped by the next one.
  const profile = await fetch(`${API}/profile`, {
    headers: { Authorization: `Bearer ${grant.accessToken}` },
    cache: "no-store",
  });

  if (profile.ok) {
    const body = (await profile.json()) as { historyId?: string };
    await saveGmailCursor(workspaceId, body.historyId ?? null);
  }

  await markGmailSynced(workspaceId);
  return { ok: true, count };
}

export { GMAIL_PROVIDER };

/** How long a reading stays fresh before opening the app earns another. */
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Sync, but only if the last one is old enough to be worth repeating.
 *
 * Pressing Save on Screen 16.2 was the only thing that ever read the mailbox,
 * which made a feature about incoming mail depend on the professional going to
 * a settings dialog and pressing a button in it. This is what makes it happen
 * on its own: Whitby's header runs it after the response, so opening any page
 * in the product brings the mailbox up to date without the page waiting for it.
 *
 * Throttled rather than run every time, because a sync costs a model call per
 * new message and a professional clicking around the product would otherwise
 * pay for one on every navigation. Ten minutes is the window; `last_sync_at`
 * on the integration row is the clock, and `syncGmailContext` stamps it.
 *
 * Silent by design. Nothing on the page is waiting for this, and a mailbox
 * that cannot be read already says so through `needs_attention` on Screen 16.
 */
export async function syncGmailIfStale(workspaceId: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return;

    const { data } = await supabase
      .from("whitbyos_integrations")
      .select("last_sync_at")
      .eq("workspace_id", workspaceId)
      .eq("provider", GMAIL_PROVIDER)
      .eq("status", "connected")
      .maybeSingle();

    // No row is not an error: Gmail is simply not connected here.
    if (!data) return;

    const last = data.last_sync_at ? new Date(data.last_sync_at as string).getTime() : 0;
    if (Number.isFinite(last) && Date.now() - last < STALE_AFTER_MS) return;

    await syncGmailContext(workspaceId);
  } catch {
    // Reading the mailbox must never take a page down with it.
  }
}

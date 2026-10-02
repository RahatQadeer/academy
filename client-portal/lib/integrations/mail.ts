import { createServiceClient } from "@/base/lib/supabase/service";
import { normalizeEmail } from "@/base/lib/email";
import { generateJson } from "@/whitbyos/lib/ai/provider";
import { notifyClientContacts } from "@/whitbyos/lib/notify";
import { listMessageablePeople } from "@/client-portal/lib/data/people";
import type { PortalContext } from "@/client-portal/lib/portal-context";
import type { ChosenSource, SourceKind, SourceOption } from "./catalog";

/**
 * What a client's two mailboxes have in common.
 *
 * Gmail and Outlook Mail differ in exactly one place — how you ask a provider
 * for the messages exchanged with an address. Everything on either side of
 * that is the same work: who may be read, what the model is asked, what is
 * kept, what the bell says, and how the screen reads it back. That all lives
 * here, so `gmail.ts` and `outlook-mail.ts` are each only the fetching.
 *
 * Keyed on the provider throughout (client-portal/021). The two mailboxes keep
 * separate lists of people and separate readings: the same address read in
 * both is two rows, because the message ids are different namespaces and a
 * conversation seen from each side is two copies of it.
 *
 * The tables are still named `client_portal_gmail_*` and the id column is
 * still `gmail_message_id`. 021 says why they were not renamed.
 */

/** The two mailboxes. Calendar providers never reach this module. */
export type MailProvider = "gmail" | "outlook_mail";

export const MAIL_HREF: Record<MailProvider, string> = {
  gmail: "/client-portal/integrations/gmail",
  outlook_mail: "/client-portal/integrations/outlook-mail",
};

export type SyncOutcome = { ok: boolean; error?: string; count?: number };

// ── who may be read ───────────────────────────────────────────────────────

export type SourcePicker = { team: SourceOption[]; people: SourceOption[] };

type TeamMember = { id: string; name: string; email: string | null };

/**
 * The professionals this client actually corresponds with.
 *
 * Whitby offers its whole workspace; a client is offered the people on their
 * own conversations, which is the set they could already see named in
 * Messages. Read on the service role because `users` is closed to a client, and
 * the address is kept on the server: the picker is sent names only.
 */
async function teamFor(ctx: PortalContext): Promise<TeamMember[]> {
  if (!ctx.contactId || !ctx.workspaceId) return [];
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data: seats } = await supabase
    .from("whitbyos_message_participants")
    .select("thread_id")
    .eq("participant_type", "contact")
    .eq("participant_id", ctx.contactId)
    .is("removed_at", null);

  const threadIds = (seats ?? []).map((row) => row.thread_id as string);
  if (threadIds.length === 0) return [];

  const { data: threads } = await supabase
    .from("whitbyos_message_threads")
    .select("id")
    .in("id", threadIds)
    .eq("workspace_id", ctx.workspaceId);

  const inWorkspace = (threads ?? []).map((row) => row.id as string);
  if (inWorkspace.length === 0) return [];

  const { data: others } = await supabase
    .from("whitbyos_message_participants")
    .select("participant_id")
    .in("thread_id", inWorkspace)
    .eq("participant_type", "user")
    .is("removed_at", null);

  const userIds = [...new Set((others ?? []).map((row) => row.participant_id as string))];
  if (userIds.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, preferred_name, email")
    .in("id", userIds);

  return (users ?? [])
    .map((row) => ({
      id: row.id as string,
      name: (row.preferred_name as string) || (row.full_name as string) || "Your team",
      email: (row.email as string | null) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadSourcePicker(ctx: PortalContext): Promise<SourcePicker> {
  const [team, people] = await Promise.all([teamFor(ctx), listMessageablePeople()]);

  return {
    team: team
      .filter((member) => member.email)
      .map((member) => ({ kind: "team" as const, id: member.id, name: member.name, email: null })),
    people: people
      .filter((person) => person.contactId && person.email)
      .map((person) => ({
        kind: "person" as const,
        id: person.contactId as string,
        name: person.name,
        email: person.email,
      })),
  };
}

/** What has been chosen for one mailbox, for Manage to open showing it. */
export async function loadChosenSources(
  contactId: string,
  provider: MailProvider,
): Promise<ChosenSource[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("client_portal_gmail_sources")
    .select("kind, source_id, email, label")
    .eq("contact_id", contactId)
    .eq("provider", provider)
    .order("kind")
    .order("label");

  return (data ?? []).map((row) => ({
    kind: row.kind as SourceKind,
    sourceId: (row.source_id as string | null) ?? null,
    label: (row.label as string) || (row.email as string),
    email: row.kind === "team" ? null : (row.email as string),
  }));
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Replace one mailbox's list with exactly what was chosen, as Whitby's Save does.
 *
 * Nothing from the form is trusted beyond an id and a kind. A teammate or a
 * person on the account must be one the picker offers this client right now,
 * and their address is taken from the record rather than from the browser —
 * so a doctored form cannot point the reading at somebody else's mail.
 */
export async function saveSources(
  ctx: PortalContext,
  provider: MailProvider,
  wanted: ChosenSource[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ctx.contactId) return { ok: false, error: "Sign in to choose whose mail may be read." };
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "The server is missing its credentials." };

  const [team, people] = await Promise.all([teamFor(ctx), listMessageablePeople()]);
  const teamById = new Map(team.map((member) => [member.id, member]));
  const peopleById = new Map(
    people.filter((person) => person.contactId).map((person) => [person.contactId as string, person]),
  );

  const rows: { kind: SourceKind; source_id: string | null; email: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const choice of wanted) {
    let row: (typeof rows)[number] | null = null;

    if (choice.kind === "team" && choice.sourceId) {
      const member = teamById.get(choice.sourceId);
      if (member?.email) {
        row = { kind: "team", source_id: member.id, email: member.email, label: member.name };
      }
    } else if (choice.kind === "person" && choice.sourceId) {
      const person = peopleById.get(choice.sourceId);
      if (person?.email) {
        row = { kind: "person", source_id: choice.sourceId, email: person.email, label: person.name };
      }
    } else if (choice.kind === "external" && choice.email) {
      const email = normalizeEmail(choice.email);
      if (EMAIL.test(email)) row = { kind: "external", source_id: null, email, label: email };
    }

    if (!row) continue;
    row.email = normalizeEmail(row.email);
    if (seen.has(row.email)) continue;
    seen.add(row.email);
    rows.push(row);
  }

  // Removals first, so an address kept in the same Save keeps its row. Scoped
  // to this provider: choosing nobody on Outlook must not clear Gmail's list.
  let remove = supabase
    .from("client_portal_gmail_sources")
    .delete()
    .eq("contact_id", ctx.contactId)
    .eq("provider", provider);
  if (rows.length > 0) {
    remove = remove.not("email", "in", `(${rows.map((row) => `"${row.email}"`).join(",")})`);
  }
  const { error: removeError } = await remove;
  if (removeError) return { ok: false, error: removeError.message };

  if (rows.length === 0) return { ok: true };

  const { error } = await supabase.from("client_portal_gmail_sources").upsert(
    rows.map((row) => ({ ...row, contact_id: ctx.contactId, provider })),
    { onConflict: "contact_id,provider,email" },
  );

  return error ? { ok: false, error: error.message } : { ok: true };
}

/** The addresses one mailbox may read, by normalized address. */
export async function allowedSources(
  contactId: string,
  provider: MailProvider,
): Promise<Map<string, string>> {
  const supabase = createServiceClient();
  if (!supabase) return new Map();

  const { data } = await supabase
    .from("client_portal_gmail_sources")
    .select("id, email")
    .eq("contact_id", contactId)
    .eq("provider", provider);

  return new Map((data ?? []).map((row) => [normalizeEmail(row.email as string), row.id as string]));
}

// ── reading ───────────────────────────────────────────────────────────────

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    facts: { type: "array", items: { type: "string" } },
    relevant: { type: "boolean" },
  },
  required: ["summary", "facts", "relevant"],
};

const EXTRACT_SYSTEM = `You read one email on behalf of the person whose mailbox it is — a
client of a family office — and report what it means for them. Answer with a one-sentence
summary and a short list of facts worth acting on: dates, amounts, decisions, requests,
deadlines. Quote figures and dates exactly as written. Set relevant to true only when the
message needs the reader to know or do something; a newsletter, a routine receipt or a
thank-you is not relevant. If nothing is actionable, return an empty list of facts. Never
invent a detail the message does not contain.`;

/** One message, in the shape both providers reduce their own to. */
export type MailMessage = {
  id: string;
  threadId: string | null;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  snippet: string | null;
  receivedAt: string | null;
  body: string;
  direction: "incoming" | "outgoing";
  /** The chosen person this message is with — never trusted from the provider. */
  sourceId: string;
  counterparty: string;
};

/** Which ids this mailbox has already read, so none is paid for twice. */
export async function alreadyRead(
  contactId: string,
  provider: MailProvider,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const supabase = createServiceClient();
  if (!supabase) return new Set();

  const { data } = await supabase
    .from("client_portal_gmail_extracts")
    .select("gmail_message_id")
    .eq("contact_id", contactId)
    .eq("provider", provider)
    .in("gmail_message_id", ids);

  return new Set((data ?? []).map((row) => row.gmail_message_id as string));
}

export type StoreOutcome = "stored" | "unread" | "failed";

/**
 * Hand one message to the model and keep what comes back.
 *
 * `unread` means the model did not answer — the message was fetched and
 * dropped. The callers count those separately from "nothing new", because a
 * model that cannot be reached otherwise presents as a mailbox that
 * mysteriously never has anything in it.
 */
export async function storeReading(input: {
  contactId: string;
  provider: MailProvider;
  workspaceId?: string;
  clientId: string | null;
  message: MailMessage;
}): Promise<StoreOutcome> {
  const { contactId, provider, workspaceId, clientId, message } = input;

  const supabase = createServiceClient();
  if (!supabase) return "failed";

  const read = await generateJson<{ summary: string; facts: string[]; relevant: boolean }>({
    system: EXTRACT_SYSTEM,
    prompt:
      message.direction === "outgoing"
        ? `Subject: ${message.subject ?? "(none)"}\nThe reader wrote this, to ${message.counterparty}.\n\n${message.body}`
        : `Subject: ${message.subject ?? "(none)"}\nFrom: ${message.fromEmail}\n\n${message.body}`,
    schema: EXTRACT_SCHEMA,
    workspaceId,
    feature: `client_portal_${provider}`,
  });

  if (!read.ok) return "unread";

  const { data: saved, error } = await supabase
    .from("client_portal_gmail_extracts")
    .upsert(
      {
        contact_id: contactId,
        provider,
        source_id: message.sourceId,
        gmail_message_id: message.id,
        gmail_thread_id: message.threadId,
        direction: message.direction,
        from_email: message.fromEmail,
        from_name: message.fromName,
        subject: message.subject,
        snippet: message.snippet,
        received_at: message.receivedAt,
        summary: read.data.summary,
        extracted: { facts: read.data.facts ?? [] },
        relevant: read.data.relevant === true,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "contact_id,provider,gmail_message_id" },
    )
    .select("id")
    .maybeSingle();

  if (error) return "failed";

  // The bell, for incoming mail that turned out to matter — Whitby's rule.
  if (message.direction === "incoming" && read.data.relevant === true && saved?.id && workspaceId) {
    await notifyClientContacts({
      workspaceId,
      clientId,
      event: "new_message",
      kind: "client_gmail",
      area: "integrations",
      title: `Email from ${message.fromName || message.fromEmail}`,
      body: read.data.summary,
      href: MAIL_HREF[provider],
      entityType: "client_portal_gmail_extract",
      entityId: saved.id as string,
      onlyContactIds: [contactId],
    });
  }

  return "stored";
}

// ── the mailbox screens ───────────────────────────────────────────────────

export type EmailRow = {
  id: string;
  direction: "incoming" | "outgoing";
  subject: string | null;
  summary: string | null;
  facts: string[];
  at: string | null;
};

export type EmailPerson = {
  sourceId: string;
  kind: SourceKind;
  name: string;
  rows: EmailRow[];
};

export type MailListing = {
  people: { id: string; label: string; kind: SourceKind }[];
  sections: EmailPerson[];
  /**
   * Messages read in this mailbox and judged routine, which the screen does
   * not draw.
   *
   * Returned so the empty state can say so. The filter below is the single
   * most confusing thing about this feature: a client sends themselves a test
   * email, the sync reads it, the model rightly decides a message saying "hi"
   * needs nothing from anybody, and the screen says "Nothing worth noting yet"
   * — which is true and reads exactly like a mailbox that was never read at
   * all. A number here is the difference between "it is not working" and "it
   * is working and had nothing to tell you".
   *
   * Not narrowed by the search term: it is a fact about the reading, not about
   * what the search matched.
   */
  routine: number;
};

/** Everything read in one mailbox, filed under the people it is with. */
export async function listEmailByPerson(
  contactId: string,
  provider: MailProvider,
  only?: string | null,
  search?: string | null,
): Promise<MailListing> {
  const supabase = createServiceClient();
  if (!supabase) return { people: [], sections: [], routine: 0 };

  let routineQuery = supabase
    .from("client_portal_gmail_extracts")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .eq("provider", provider)
    .eq("relevant", false);
  if (only) routineQuery = routineQuery.eq("source_id", only);

  const [{ data: sources }, { data: rows }, { count: routine }] = await Promise.all([
    supabase
      .from("client_portal_gmail_sources")
      .select("id, kind, email, label")
      .eq("contact_id", contactId)
      .eq("provider", provider)
      .order("label"),
    supabase
      .from("client_portal_gmail_extracts")
      .select("id, source_id, direction, subject, summary, extracted, received_at")
      .eq("contact_id", contactId)
      .eq("provider", provider)
      .eq("relevant", true)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(200),
    routineQuery,
  ]);

  const term = (search ?? "").trim().toLowerCase();
  const bySource = new Map<string, EmailRow[]>();

  for (const row of rows ?? []) {
    const sourceId = (row.source_id as string | null) ?? "";
    if (!sourceId || (only && sourceId !== only)) continue;

    const subject = (row.subject as string | null) ?? null;
    const summary = (row.summary as string | null) ?? null;
    if (term && !`${subject ?? ""} ${summary ?? ""}`.toLowerCase().includes(term)) continue;

    const extracted = row.extracted as { facts?: unknown } | null;
    const list = bySource.get(sourceId) ?? [];
    list.push({
      id: row.id as string,
      direction: (row.direction as "incoming" | "outgoing") ?? "incoming",
      subject,
      summary,
      facts: Array.isArray(extracted?.facts)
        ? extracted.facts.filter((fact): fact is string => typeof fact === "string")
        : [],
      at: (row.received_at as string | null) ?? null,
    });
    bySource.set(sourceId, list);
  }

  const people = (sources ?? []).map((source) => ({
    id: source.id as string,
    label: (source.label as string) || (source.email as string),
    kind: source.kind as SourceKind,
  }));

  return {
    people,
    routine: routine ?? 0,
    sections: people.flatMap((person) => {
      const held = bySource.get(person.id);
      return held && held.length > 0
        ? [{ sourceId: person.id, kind: person.kind, name: person.label, rows: held }]
        : [];
    }),
  };
}

/**
 * Whether a run that stored nothing actually failed.
 *
 * Shared because both mailboxes have the same trap: a message fetched, handed
 * to a model that did not answer, and dropped, is indistinguishable from an
 * empty inbox unless somebody counts it.
 */
export function outcomeOf(count: number, unread: number, lastError?: string): SyncOutcome {
  if (count === 0 && unread > 0) {
    return { ok: false, error: lastError ?? "New mail could not be summarised." };
  }
  return { ok: true, count };
}

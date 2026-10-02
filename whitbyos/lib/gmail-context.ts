import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { normalizeEmail } from "@/base/lib/email";

/**
 * Who Whitby AI may read incoming Gmail from — SRS §11.1.
 *
 * A connected mailbox is not a licence to read all of it. The professional
 * names people, and the sync ignores every other sender. This module is the
 * naming: what can be offered on Screen 16.2, and what has been chosen.
 *
 * The three lists are the three places the workspace already knows an address
 * from, so the common case is picking a name rather than typing an address.
 * `external` is the fourth kind and has no list — it is someone the workspace
 * has no record of, typed in by hand.
 */

export type GmailSourceKind = "client" | "contact" | "team" | "external";

/** One address the professional has allowed, as it is stored. */
export type GmailSelectedSource = {
  kind: GmailSourceKind;
  /** The client, contact or user row this came from. Null for `external`. */
  sourceId: string | null;
  /** Which client the mail is filed against, when that is known. */
  clientId: string | null;
  email: string;
  label: string;
};

/** One address the professional could allow, as it is offered. */
export type GmailPickerOption = {
  kind: Exclude<GmailSourceKind, "external">;
  id: string;
  clientId: string | null;
  /** A client with no primary contact, or a teammate with no address on
   *  their user row, has nothing to read mail from — kept and skipped by the
   *  caller rather than dropped here, so the reason stays visible. */
  email: string | null;
  name: string;
};

export type GmailPicker = {
  clients: GmailPickerOption[];
  contacts: GmailPickerOption[];
  team: GmailPickerOption[];
};

const EMPTY: GmailPicker = { clients: [], contacts: [], team: [] };

function fullName(row: {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
}) {
  return (
    row.preferred_name ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    "Unnamed contact"
  );
}

/**
 * Everyone this workspace could name, in the three groups 16.2 draws them in.
 *
 * Read with the caller's own client, not the service role: the picker must
 * only offer people the professional can already see, and RLS is what decides
 * that. A failure comes back as an empty group rather than an exception — the
 * dialog still has to open, and Save validates against this list again anyway.
 */
export async function loadGmailPicker(): Promise<GmailPicker> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return EMPTY;

  const supabase = await createClient();

  const [{ data: clients }, { data: members }] = await Promise.all([
    supabase
      .from("whitbyos_clients")
      .select(
        "id, name, primary_contact:contacts!primary_contact_id (id, email, first_name, last_name, preferred_name)",
      )
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),
  ]);

  // PostgREST resolves an embedded one-to-one as either an object or a
  // single-element array depending on how it reads the relationship.
  const firstOf = <T,>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? value[0] ?? null : value;

  const clientRows = clients ?? [];

  const clientOptions: GmailPickerOption[] = clientRows.map((row) => {
    const contact = firstOf(
      row.primary_contact as { email?: string | null } | { email?: string | null }[] | null,
    );
    return {
      kind: "client" as const,
      id: row.id as string,
      clientId: row.id as string,
      email: (contact?.email as string | null) ?? null,
      name: row.name as string,
    };
  });

  // Which client each contact belongs to, so an allowed contact's mail can be
  // filed without asking again at sync time.
  const clientIds = clientRows.map((row) => row.id as string);
  const { data: links } = clientIds.length
    ? await supabase
        .from("whitbyos_client_members")
        .select("contact_id, client_id")
        .in("client_id", clientIds)
    : { data: [] };

  const linked = new Map(
    (links ?? []).map((row) => [row.contact_id as string, row.client_id as string]),
  );

  // The same reach as Screen 4.1: contacts this workspace created, plus anyone
  // linked to one of its clients. `contacts` is shared with the Client Portal
  // and Partner Center and carries no workspace column of its own.
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, preferred_name, email, created_by_workspace_id")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const contactOptions: GmailPickerOption[] = (contacts ?? [])
    .filter(
      (row) =>
        row.created_by_workspace_id === workspaceId || linked.has(row.id as string),
    )
    .map((row) => ({
      kind: "contact" as const,
      id: row.id as string,
      clientId: linked.get(row.id as string) ?? null,
      email: (row.email as string | null) ?? null,
      name: fullName(row as never),
    }));

  const userIds = (members ?? []).map((row) => row.user_id as string);
  const { data: users } = userIds.length
    ? await supabase
        .from("users")
        .select("id, full_name, preferred_name, email")
        .in("id", userIds)
    : { data: [] };

  const teamOptions: GmailPickerOption[] = (users ?? []).map((row) => ({
    kind: "team" as const,
    id: row.id as string,
    clientId: null,
    email: (row.email as string | null) ?? null,
    name:
      (row.preferred_name as string) ||
      (row.full_name as string) ||
      (row.email as string) ||
      "Teammate",
  }));

  return { clients: clientOptions, contacts: contactOptions, team: teamOptions };
}

/**
 * What has already been allowed, for the dialog to open showing it.
 *
 * Ordered by kind then label so the list reads the way the picker above is
 * grouped, rather than by whenever each row happened to be added.
 */
export async function loadSelectedGmailSources(): Promise<GmailSelectedSource[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_gmail_context_sources")
    .select("kind, source_id, client_id, email, label")
    .eq("workspace_id", workspaceId)
    .order("kind")
    .order("label");

  return (data ?? []).map((row) => ({
    kind: row.kind as GmailSourceKind,
    sourceId: (row.source_id as string | null) ?? null,
    clientId: (row.client_id as string | null) ?? null,
    email: normalizeEmail(row.email as string),
    label: (row.label as string) || (row.email as string),
  }));
}

/** One recent extract for Home's "Recent Messages & Updates" feed. */
export type RecentGmailExtract = {
  id: string;
  direction: "incoming" | "outgoing";
  summary: string | null;
  subject: string | null;
  fromName: string | null;
  fromEmail: string;
  receivedAt: string | null;
  requestId: string | null;
  clientId: string | null;
};

/**
 * Recent relevant Gmail extracts for Home's feed.
 *
 * Screen 1's "Recent Messages & Updates" mixes in-app traffic with what
 * connected Gmail left behind. Only `relevant` rows: a message that was read
 * and judged empty is stored so the next sync does not pay to read it again,
 * but it is not a thing to show beside a real update.
 */
export async function listRecentGmailContext(
  workspaceId: string,
  limit = 6,
): Promise<RecentGmailExtract[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_gmail_extracts")
    .select(
      "id, direction, summary, subject, from_name, from_email, received_at, request_id, client_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("relevant", true)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    direction: (row.direction as "incoming" | "outgoing") ?? "incoming",
    summary: (row.summary as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    fromName: (row.from_name as string | null) ?? null,
    fromEmail: row.from_email as string,
    receivedAt: (row.received_at as string | null) ?? null,
    requestId: (row.request_id as string | null) ?? null,
    clientId: (row.client_id as string | null) ?? null,
  }));
}

export type ClientGmailContext = {
  id: string;
  /** 'incoming' is from them; 'outgoing' is the professional's own reply. */
  direction: "incoming" | "outgoing";
  /** Who the message is with — the sender, or the person it was sent to. */
  from: string;
  summary: string;
  facts: string[];
  at: string | null;
};

/**
 * What connected Gmail has learned about one client, for Whitby to draft with.
 *
 * Scoped to the client and to `relevant`, which are two different guards doing
 * two different jobs. The client scope is the privacy one: a plan being drafted
 * for the Okonkwo family must not be informed by the Hartwells' mail, and an
 * extract only carries a `client_id` because the sender was named against that
 * client in the first place. `relevant` is the quality one — a message Whitby
 * read and found nothing in is kept so the next sync does not pay to read it
 * again, and it has nothing to contribute to a prompt.
 *
 * Deliberately not offered to playbook drafting. A Playbook is a shape reused
 * across every client the firm has, and one household's correspondence has no
 * business being baked into it.
 *
 * The body is not here because it is not anywhere: migration 060 stores the
 * summary and the facts Whitby pulled out, and Gmail's own preview line, and
 * throws the message away.
 */
export async function listClientGmailContext(
  clientId: string,
  limit = 8,
): Promise<ClientGmailContext[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("whitbyos_gmail_extracts")
    .select("id, direction, from_name, from_email, summary, extracted, received_at")
    .eq("client_id", clientId)
    .eq("relevant", true)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  return (data ?? []).flatMap((row) => {
    const summary = ((row.summary as string | null) ?? "").trim();
    const extracted = row.extracted as { facts?: unknown } | null;
    const facts = Array.isArray(extracted?.facts)
      ? extracted.facts.filter((fact): fact is string => typeof fact === "string")
      : [];

    // Nothing to say is worth no line in the prompt.
    if (!summary && facts.length === 0) return [];

    return [
      {
        id: row.id as string,
        direction: (row.direction as "incoming" | "outgoing") ?? "incoming",
        from: (row.from_name as string | null) || (row.from_email as string),
        summary,
        facts,
        at: (row.received_at as string | null) ?? null,
      },
    ];
  });
}

/** The same, rendered as the lines a prompt can carry. */
export function gmailContextLines(rows: ClientGmailContext[]): string | null {
  if (rows.length === 0) return null;

  const lines = rows.map((row) => {
    const when = row.at ? row.at.slice(0, 10) : "undated";
    const facts = row.facts.length > 0 ? ` (${row.facts.join("; ")})` : "";
    // A request and the answer to it read very differently, and a drafter that
    // cannot tell them apart will plan work that has already been promised.
    const who = row.direction === "outgoing" ? "the professional wrote" : `from ${row.from}`;
    return `- ${when}, ${who}: ${row.summary}${facts}`;
  });

  return [
    "\nFrom this client's correspondence, which the professional allowed Whitby to read:",
    ...lines,
    "Treat these as background the professional already has. Do not quote them back, and do not invent anything they do not say.",
  ].join("\n");
}

/**
 * The one call a drafter makes: a client's allowed email, ready for a prompt.
 *
 * Null in and null out, so a caller that does not know which client it is
 * drafting for simply passes nothing on rather than guarding at every site.
 */
export async function clientEmailContext(
  clientId: string | null | undefined,
): Promise<string | null> {
  if (!clientId) return null;
  return gmailContextLines(await listClientGmailContext(clientId));
}

export type GmailThreadRow = {
  id: string;
  direction: "incoming" | "outgoing";
  subject: string | null;
  summary: string | null;
  facts: string[];
  at: string | null;
  clientId: string | null;
  requestId: string | null;
};

/** One allowed person, with everything Whitby has read to or from them. */
export type GmailPersonSection = {
  sourceId: string;
  kind: GmailSourceKind;
  name: string;
  email: string;
  clientId: string | null;
  rows: GmailThreadRow[];
};

/**
 * Everything the mailbox has brought in, in sections — one per person named.
 *
 * The correspondence is filed under the people it is with, because that is how
 * the professional chose it in the first place: 16.2 is a list of people, and
 * this is the same list with what each one has actually written under it. A
 * flat feed sorted by date would lose the one grouping the feature is built on.
 *
 * `only` narrows to a single person, which is what the picker at the top of the
 * page sets. Everything else is left to the caller — this returns sections that
 * have something in them and nothing else.
 */
export async function listGmailBySource(
  workspaceId: string,
  only?: string | null,
  search?: string | null,
): Promise<GmailPersonSection[]> {
  const supabase = await createClient();

  const [{ data: sources }, { data: rows }] = await Promise.all([
    supabase
      .from("whitbyos_gmail_context_sources")
      .select("id, kind, email, label, client_id")
      .eq("workspace_id", workspaceId)
      .order("label"),
    supabase
      .from("whitbyos_gmail_extracts")
      .select(
        "id, source_id, direction, subject, summary, extracted, received_at, client_id, request_id",
      )
      .eq("workspace_id", workspaceId)
      .eq("relevant", true)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(200),
  ]);

  const term = (search ?? "").trim().toLowerCase();

  const bySource = new Map<string, GmailThreadRow[]>();
  for (const row of rows ?? []) {
    const sourceId = (row.source_id as string | null) ?? "";
    if (!sourceId) continue;
    if (only && sourceId !== only) continue;

    const subject = (row.subject as string | null) ?? null;
    const summary = (row.summary as string | null) ?? null;
    if (term && !`${subject ?? ""} ${summary ?? ""}`.toLowerCase().includes(term)) {
      continue;
    }

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
      clientId: (row.client_id as string | null) ?? null,
      requestId: (row.request_id as string | null) ?? null,
    });
    bySource.set(sourceId, list);
  }

  return (sources ?? []).flatMap((source) => {
    const id = source.id as string;
    const held = bySource.get(id);
    // A person with nothing read yet is not a section; the page says so once,
    // rather than printing an empty heading for each of them.
    if (!held || held.length === 0) return [];

    return [
      {
        sourceId: id,
        kind: source.kind as GmailSourceKind,
        name: (source.label as string) || (source.email as string),
        email: source.email as string,
        clientId: (source.client_id as string | null) ?? null,
        rows: held,
      },
    ];
  });
}

/** The people named, for the page's own picker — including those with no mail. */
export async function listGmailSourceOptions(
  workspaceId: string,
): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_gmail_context_sources")
    .select("id, email, label")
    .eq("workspace_id", workspaceId)
    .order("label");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: (row.label as string) || (row.email as string),
  }));
}

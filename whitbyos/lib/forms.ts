import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { readFields, type FormField } from "@/whitbyos/lib/form-vocab";

export type FormRow = {
  id: string;
  title: string;
  visibility: string;
  category: string | null;
  fieldCount: number;
  timesUsed: number;
  updatedAt: string;
};

export type FormsResult = { ok: true; rows: FormRow[] } | { ok: false; error: string };

/**
 * Screen 11 — Templates. "Used on N requests" is counted from submissions.
 *
 * 11 also draws an "All Workspaces" filter over this list. A form is a
 * workspace-level template and has no client of its own — deliberately, because
 * the same template is sent to many — so the filter reads the other way round:
 * which clients a template has actually been sent to. That link already exists
 * on the submission, so nothing had to be stored to answer it.
 *
 * Under that filter the count follows the filter. Showing "used on 12 requests"
 * while looking at one client who has seen it twice would be two different
 * questions answered in one line.
 */
export async function listForms(
  filters: { client?: string } = {},
): Promise<FormsResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("whitbyos_forms")
    .select("id, title, visibility, category, fields, updated_at, created_by_user_id")
    .eq("workspace_id", workspaceId)
    /*
     * "Only me" means only me.
     *
     * The RLS policy grants every workspace member every form, and narrowing
     * it there would take every other screen's queries with it — so the rule
     * is applied where the list is built. A form marked this way is its
     * author's; anything else is the workspace's.
     *
     * A form with no author recorded is nobody's private form. Thirteen of
     * them predate whitbyos/082 and none is restricted, so this excludes
     * nothing that exists today.
     */
    .or(
      user
        ? `visibility.neq.restricted,created_by_user_id.eq.${user.id}`
        : "visibility.neq.restricted",
    )
    /*
     * Templates only.
     *
     * "Ask the client" builds a form for one plan — its fields are that
     * client's passports and that family's tenancy — and writes it with
     * `is_template: false`. Nothing read the column, so it landed on the
     * Templates tab beside the reusable ones, offering Duplicate and Send: a
     * form named after the Okonkwo relocation, ready to send to somebody else.
     *
     * It is still reachable from the plan that owns it and from Submissions.
     * It is not a thing to pick up and reuse, which is what this list is for.
     */
    .eq("is_template", true)
    .order("updated_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const ids = (data ?? []).map((row) => row.id as string);
  const used = new Map<string, number>();
  const sentTo = new Map<string, Set<string>>();

  if (ids.length > 0) {
    const { data: submissions } = await supabase
      .from("whitbyos_form_submissions")
      .select("form_id, client_id")
      .in("form_id", ids);

    for (const row of submissions ?? []) {
      const id = row.form_id as string;
      const client = (row.client_id as string | null) ?? null;

      if (client) {
        if (!sentTo.has(id)) sentTo.set(id, new Set());
        sentTo.get(id)!.add(client);
      }

      if (filters.client && client !== filters.client) continue;
      used.set(id, (used.get(id) ?? 0) + 1);
    }
  }

  const kept = filters.client
    ? (data ?? []).filter((row) => sentTo.get(row.id as string)?.has(filters.client!))
    : (data ?? []);

  return {
    ok: true,
    rows: kept.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      visibility: (row.visibility as string) ?? "internal",
      category: (row.category as string | null) ?? null,
      fieldCount: readFields(row.fields).length,
      timesUsed: used.get(row.id as string) ?? 0,
      updatedAt: row.updated_at as string,
    })),
  };
}

export type FormDetail = FormRow & {
  fields: FormField[];
  /** 11.1b's header — the template this one was copied from, if it was. */
  duplicatedFrom: string | null;
};

/** Screen 11.1b — the builder's form. */
export async function getForm(formId: string): Promise<FormDetail | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("whitbyos_forms")
    .select(
      "id, title, visibility, category, fields, updated_at, workspace_id, created_by_user_id, duplicated_from_form_id, source:whitbyos_forms!duplicated_from_form_id (title)",
    )
    .eq("id", formId)
    .maybeSingle();

  if (!data || data.workspace_id !== workspaceId) return null;

  // Somebody else's "Only me" form, reached by its address rather than from a
  // list. Not found, rather than forbidden: whose it is is also private.
  if (
    data.visibility === "restricted" &&
    data.created_by_user_id &&
    data.created_by_user_id !== user?.id
  ) {
    return null;
  }

  const { count } = await supabase
    .from("whitbyos_form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("form_id", formId);

  const raw = data.source as unknown as { title: string } | { title: string }[] | null;
  const source = Array.isArray(raw) ? raw[0] : raw;

  const fields = readFields(data.fields);

  return {
    id: data.id as string,
    title: data.title as string,
    visibility: (data.visibility as string) ?? "internal",
    category: (data.category as string | null) ?? null,
    fields,
    fieldCount: fields.length,
    timesUsed: count ?? 0,
    duplicatedFrom: source?.title ?? null,
    updatedAt: data.updated_at as string,
  };
}

export type SubmissionRow = {
  id: string;
  formId: string;
  formTitle: string;
  clientName: string | null;
  /** Who it was addressed to. Not who answered it. */
  sentTo: string | null;
  /** Who actually filled it in, and null until somebody has. */
  submittedBy: string | null;
  status: string;
  /** 11.2's Date — when it came back, or failing that when it went out. */
  submittedAt: string | null;
  /** When it went out, kept apart from when it came back. */
  sentAt: string | null;
  /** Null until the client submits. `submittedAt` falls back and this does not. */
  answeredAt: string | null;
  /** When somebody on this side decided, either way. Null until they have. */
  reviewedAt: string | null;
  /**
   * The answers as they stood when they were accepted (migration 080).
   *
   * Per answer rather than per submission, because a Work Plan's client ask
   * grows: a new question puts the whole submission back to `awaiting`, and
   * the answers already judged should not lose that with it.
   */
  acceptedResponses: Record<string, string>;
  /** The field ids sent back and not yet answered again (migration 081). */
  correctionFields: string[];
  responses: Record<string, string>;
  /**
   * What was asked, in the order it was asked.
   *
   * 11.3 used to print the raw response keys as the questions, which for a
   * Work Plan's client ask meant "need-both-adults-passports" where the
   * question should be. The answers are keyed by each field's id, so the form
   * itself is the only place the readable question lives.
   */
  questions: { key: string; label: string; type: string }[];
  /**
   * The file answers, by the key they were answered under.
   *
   * A `file` field's answer is a path in the documents bucket, which 11.3 was
   * printing as it stands — a client's passport shown as
   * "be1b402f.../1789474881197-scan.png", which nobody can open and which
   * reads as a fault. The upload also writes a `documents` row against the
   * same path, so the file already has a place it can be read from.
   *
   * `documentId` is null where the row is gone or was never written; the name
   * is still worth showing, because something was answered.
   */
  files: Record<string, { documentId: string | null; name: string }>;
  correctionNote: string | null;
};

export type SubmissionsResult =
  | { ok: true; rows: SubmissionRow[] }
  | { ok: false; error: string };

/**
 * Screen 11.2 — Submissions.
 *
 * A submission has no workspace either; it belongs to a Form, and the Form has
 * one. So the workspace's forms decide what is visible, which also means a
 * submission can never outlive the form it answers.
 */
export async function listSubmissions(
  filters: { client?: string } = {},
): Promise<SubmissionsResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: true, rows: [] };

  const supabase = await createClient();
  const { data: forms, error: formError } = await supabase
    .from("whitbyos_forms")
    .select("id, title, fields")
    .eq("workspace_id", workspaceId);

  if (formError) return { ok: false, error: formError.message };

  const titles = new Map((forms ?? []).map((row) => [row.id as string, row.title as string]));
  const questions = new Map(
    (forms ?? []).map((row) => [
      row.id as string,
      readFields(row.fields).map((field) => ({
        key: field.id,
        label: field.label,
        type: field.type,
      })),
    ]),
  );
  if (titles.size === 0) return { ok: true, rows: [] };

  const { data, error } = await supabase
    .from("whitbyos_form_submissions")
    .select(
      "id, form_id, client_id, submitted_by_contact_id, sent_to_contact_id, status, responses, accepted_responses, correction_fields, submitted_at, sent_at, reviewed_at, correction_note",
    )
    .in("form_id", [...titles.keys()])
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (error) return { ok: false, error: error.message };

  // 11.2 draws the same workspace filter the Templates tab has, and here a
  // submission does have a client of its own to filter on.
  const rows = filters.client
    ? (data ?? []).filter((row) => row.client_id === filters.client)
    : (data ?? []);

  /*
   * Every file answer on every row, looked up once.
   *
   * Keyed by path rather than by submission: two rows can answer with the same
   * file, and one `in` is one round trip either way.
   */
  const filePaths = [
    ...new Set(
      rows.flatMap((row) => {
        const fileKeys = new Set(
          (questions.get(row.form_id as string) ?? [])
            .filter((field) => field.type === "file")
            .map((field) => field.key),
        );
        return Object.entries(readResponses(row.responses))
          .filter(([key, value]) => fileKeys.has(key) && value.trim().length > 0)
          .map(([, value]) => value.trim());
      }),
    ),
  ];

  const { data: fileDocs } = filePaths.length
    ? await supabase.from("documents").select("id, file_url").in("file_url", filePaths)
    : { data: [] };

  const docByPath = new Map(
    (fileDocs ?? []).map((doc) => [doc.file_url as string, doc.id as string]),
  );

  const clientIds = [...new Set(rows.map((row) => row.client_id as string).filter(Boolean))];
  // Both, because they are two different people: who it was sent to, and who
  // actually filled it in.
  const contactIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.sent_to_contact_id, row.submitted_by_contact_id])
        .filter(Boolean) as string[],
    ),
  ];

  const [clients, contacts] = await Promise.all([
    clientIds.length
      ? supabase.from("whitbyos_clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] }),
    contactIds.length
      ? supabase
          .from("contacts")
          .select("id, first_name, last_name, preferred_name")
          .in("id", contactIds)
      : Promise.resolve({ data: [] }),
  ]);

  const clientNames = new Map(
    (clients.data ?? []).map((row) => [row.id as string, row.name as string]),
  );
  const contactNames = new Map(
    (contacts.data ?? []).map((row) => [
      row.id as string,
      (row.preferred_name as string) ||
        [row.first_name, row.last_name].filter(Boolean).join(" "),
    ]),
  );

  return {
    ok: true,
    rows: rows.map((row) => ({
      id: row.id as string,
      formId: row.form_id as string,
      formTitle: titles.get(row.form_id as string) ?? "Form",
      clientName: clientNames.get(row.client_id as string) ?? null,
      // Who it went to. Falls back to whoever answered for rows written before
      // the recipient was recorded at all.
      sentTo:
        contactNames.get(row.sent_to_contact_id as string) ??
        contactNames.get(row.submitted_by_contact_id as string) ??
        null,
      submittedBy: contactNames.get(row.submitted_by_contact_id as string) ?? null,
      status: (row.status as string) ?? "draft",
      submittedAt:
        (row.submitted_at as string | null) ?? (row.sent_at as string | null) ?? null,
      sentAt: (row.sent_at as string | null) ?? null,
      answeredAt: (row.submitted_at as string | null) ?? null,
      reviewedAt: (row.reviewed_at as string | null) ?? null,
      acceptedResponses: readResponses(row.accepted_responses),
      correctionFields: Array.isArray(row.correction_fields)
        ? (row.correction_fields as unknown[]).filter(
            (one): one is string => typeof one === "string",
          )
        : [],
      questions: questions.get(row.form_id as string) ?? [],
      files: fileAnswers(
        questions.get(row.form_id as string) ?? [],
        readResponses(row.responses),
        docByPath,
      ),
      responses: readResponses(row.responses),
      correctionNote: (row.correction_note as string | null) ?? null,
    })),
  };
}

/**
 * The file answers on one submission, ready to be linked to.
 *
 * The stored path carries the upload's own millisecond prefix, which is there
 * to keep two files of the same name apart and is not worth showing anybody.
 */
function fileAnswers(
  fields: { key: string; type: string }[],
  responses: Record<string, string>,
  docByPath: Map<string, string>,
): Record<string, { documentId: string | null; name: string }> {
  const out: Record<string, { documentId: string | null; name: string }> = {};

  for (const field of fields) {
    if (field.type !== "file") continue;
    const path = (responses[field.key] ?? "").trim();
    if (!path) continue;

    const leaf = path.split("/").pop() ?? path;
    out[field.key] = {
      documentId: docByPath.get(path) ?? null,
      name: leaf.replace(/^\d{10,}-/, ""),
    };
  }

  return out;
}

/** Answers arrive keyed by each field's id, which is what 11.3 reads back. */
function readResponses(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: Record<string, string> = {};
  for (const [key, answer] of Object.entries(value as Record<string, unknown>)) {
    if (typeof answer === "string") out[key] = answer;
    else if (Array.isArray(answer)) out[key] = answer.filter((x) => typeof x === "string").join(", ");
    else if (typeof answer === "boolean") out[key] = answer ? "Yes" : "No";
    else if (answer != null) out[key] = String(answer);
  }
  return out;
}


/**
 * Who a form can be addressed to — every contact on every client of this
 * workspace, with the client they belong to so the dialog can name the pairing.
 */
export async function listClientContacts(): Promise<
  { id: string; name: string; clientName: string }[]
> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("whitbyos_clients")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null);

  const names = new Map((clients ?? []).map((row) => [row.id as string, row.name as string]));
  if (names.size === 0) return [];

  const { data: members } = await supabase
    .from("whitbyos_client_members")
    .select("client_id, contact:contacts!contact_id (id, first_name, last_name, preferred_name)")
    .in("client_id", [...names.keys()]);

  const rows: { id: string; name: string; clientName: string }[] = [];

  for (const row of members ?? []) {
    const raw = row.contact as unknown as
      | { id: string; first_name?: string; last_name?: string; preferred_name?: string }
      | { id: string; first_name?: string; last_name?: string; preferred_name?: string }[]
      | null;
    const contact = Array.isArray(raw) ? raw[0] : raw;
    if (!contact) continue;

    rows.push({
      id: contact.id,
      name:
        contact.preferred_name ||
        [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
        "Contact",
      clientName: names.get(row.client_id as string) ?? "",
    });
  }

  return rows;
}

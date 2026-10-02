import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import type {
  CorrectionRound,
  FormStatus,
  PortalForm,
  PortalFormField,
  PortalFormFieldType,
} from "@/client-portal/types";

type SubmissionRow = {
  id: string;
  form_id: string;
  request_id: string | null;
  status: string | null;
  responses: Record<string, string> | null;
  /** whitbyos/080 — the answers the professional accepted, as they stood. */
  accepted_responses: Record<string, string> | null;
  /** whitbyos/048 — when it was sent, and to whom. */
  sent_at: string | null;
  sent_to_contact_id: string | null;
  submitted_at: string | null;
  /** whitbyos/027 — when the professional decided, either way. */
  reviewed_at: string | null;
  correction_note: string | null;
  /** whitbyos/081 — the field ids the professional sent back. */
  correction_fields: string[] | null;
  whitbyos_forms: { title: string; category: string | null; fields: unknown } | null;
  whitbyos_requests: { title: string } | null;
};

/*
 * Cached for the length of one request.
 *
 * Home composes Recent Activity from every area's reader while Action Needed
 * composes from three of the same ones, so an uncached read meant the same
 * rows fetched twice on one render. `cache()` is per-request, which is exactly
 * the lifetime wanted: within a render everybody sees one answer, and the next
 * request reads the table again.
 */
export const listForms = cache(async (): Promise<PortalForm[]> => {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.FORMS;
  // The area gate, at the read boundary. RLS scopes these rows to the client
  // *account*; `permissions` decides which of the people on that account may
  // see them, and this is the one place every screen, count and preview of
  // a form passes through.
  if (!ctx.areas.forms) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whitbyos_form_submissions")
    .select(
      "id, form_id, request_id, status, responses, accepted_responses, correction_fields, sent_at, sent_to_contact_id, submitted_at, reviewed_at, correction_note, whitbyos_forms(title, category, fields), whitbyos_requests(title)",
    )
    .eq("client_id", ctx.clientId!)
    // `sent_at` rather than `submitted_at`: every row has been sent, and only
    // some have been answered. Ordering by the answer date put every form still
    // awaiting one — which is every form the client actually has to act on —
    // into one undifferentiated block of nulls at the top.
    .order("sent_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return (data as unknown as SubmissionRow[]).map(toPortalForm);
});

export async function getForm(id: string): Promise<PortalForm | null> {
  const forms = await listForms();
  return forms.find((form) => form.id === id) ?? null;
}

export function filterFormsByStatus(forms: PortalForm[], status: FormStatus) {
  return forms.filter((form) => form.status === status);
}

function toPortalForm(row: SubmissionRow): PortalForm {
  return {
    id: row.id,
    title: row.whitbyos_forms?.title ?? "Form",
    description: null,
    status: toFormStatus(row.status),
    category: row.whitbyos_forms?.category ?? null,
    requestId: row.request_id,
    requestTitle: row.whitbyos_requests?.title ?? null,
    requestedByName: null,
    dueLabel: null,
    sentAt: row.sent_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    correctionNote: row.correction_note,
    correctionFields: Array.isArray(row.correction_fields)
      ? row.correction_fields.filter((one): one is string => typeof one === "string")
      : [],
    fields: parseFields(row.whitbyos_forms?.fields),
    responses: row.responses ?? {},
    acceptedResponses: row.accepted_responses ?? {},
  };
}

/**
 * `status` is text, not an enum — form-vocab.ts's SUBMISSION_STATUS is "the
 * vocabulary the product agrees on": draft, awaiting, submitted, needs_review,
 * accepted, correction_required. All six are carried through unchanged.
 *
 * This used to map them onto three buckets of the portal's own, which is where
 * the client lost sight of what had happened to their answers: `accepted` and
 * `submitted` collapsed into one word, so a form the professional had signed
 * off looked exactly like one still sitting in their queue.
 *
 * `awaiting` is the fallback for an unrecognised value rather than `draft` or
 * `submitted`. A row whose status the portal cannot read is one whose state it
 * does not know, and "this is yours to answer" is the only safe thing to say
 * about it: it puts the form in front of the client, where a wrong guess is
 * visible and correctable, instead of filing it away as done.
 *
 * `submitted_at` is deliberately not consulted. It stays set once a client has
 * ever submitted, so a row sent back as `correction_required` still carries an
 * old one — keying status off that timestamp locked a correction request into
 * the read-only Submitted tab, where the client could never act on it.
 */
function toFormStatus(raw: string | null): FormStatus {
  switch (raw) {
    case "draft":
    case "submitted":
    case "needs_review":
    case "accepted":
    case "correction_required":
    case "awaiting":
      return raw;
    default:
      return "awaiting";
  }
}

/**
 * `whitbyos_forms.fields` is a jsonb schema owned by WhitbyOS. We read it
 * defensively rather than trusting a shape — the professional side can change
 * it and the portal must degrade to "no renderable fields", never crash a page.
 *
 * It is deliberately the mirror of `readFields` in `whitbyos/lib/form-vocab.ts`,
 * because that is the only writer: `saveForm` builds each entry as
 * `{ id, label, type, required }`, with `type` drawn from `FIELD_TYPES`.
 *
 * This function used to require a `key` property and skip any field without
 * one. Nothing has ever written `key` — so `parseFields` returned an empty
 * array for every form in the product, and every client opening any form was
 * told "This form has no questions yet" no matter how many questions it had.
 * `id` is the property, and a `key` fallback is kept only so a hand-seeded
 * fixture row written the old way still renders.
 */
function parseFields(raw: unknown): PortalFormField[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry, index): PortalFormField[] => {
    if (!entry || typeof entry !== "object") return [];
    const field = entry as Record<string, unknown>;

    const key =
      typeof field.id === "string" && field.id
        ? field.id
        : typeof field.key === "string" && field.key
          ? field.key
          : null;

    // The builder drops a field with no label, so one arriving here without a
    // label is a row we cannot draw a question from — not one to invent a name
    // for. The index-based fallback covers only a missing id.
    if (typeof field.label !== "string" || !field.label) return [];

    return [
      {
        key: key ?? `field-${index}`,
        label: field.label,
        type: normaliseType(field.type),
        placeholder:
          typeof field.placeholder === "string" ? field.placeholder : undefined,
        options: Array.isArray(field.options)
          ? field.options.filter((o): o is string => typeof o === "string")
          : undefined,
        required: field.required === true,
        section:
          typeof field.section === "string" && field.section ? field.section : undefined,
        sectionBlurb:
          typeof field.sectionBlurb === "string" && field.sectionBlurb
            ? field.sectionBlurb
            : undefined,
        help: typeof field.help === "string" && field.help ? field.help : undefined,
      },
    ];
  });
}

/**
 * `FIELD_TYPES`' seven values. `short` is the builder's own fallback for an
 * unrecognised type, so it is this one's too — the two sides agreeing on what
 * an unknown field looks like matters more than either answer.
 */
function normaliseType(raw: unknown): PortalFormFieldType {
  const allowed: PortalFormFieldType[] = [
    "short",
    "long",
    "choice",
    "checklist",
    "date",
    "file",
    "boolean",
  ];
  return allowed.includes(raw as PortalFormFieldType)
    ? (raw as PortalFormFieldType)
    : "short";
}

/**
 * The rounds this form has already been through, oldest first.
 *
 * Read from `client_portal_form_corrections` (client-portal/010) rather than
 * from the submission, because the submission cannot hold them: resubmitting
 * clears `correction_note`, and a second correction overwrites the first. So
 * the one column says what is being asked for *now*, and this says what has
 * been asked for and answered already.
 *
 * An empty list is the honest answer both when nothing has been sent back and
 * when 010 has not been applied yet. The screen draws nothing either way, which
 * is what it drew before this existed.
 */
export async function listCorrectionRounds(
  submissionId: string,
): Promise<CorrectionRound[]> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.CORRECTION_ROUNDS[submissionId] ?? [];
  if (!ctx.areas.forms) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_portal_form_corrections")
    .select("id, note, asked_at, answered_at")
    .eq("submission_id", submissionId)
    .order("answered_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    note: (row.note as string | null) ?? null,
    askedAt: (row.asked_at as string | null) ?? null,
    answeredAt: row.answered_at as string,
  }));
}

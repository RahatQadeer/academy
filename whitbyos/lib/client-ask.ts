import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { readNeedEdits, type NeedEdits } from "@/whitbyos/lib/plan-requirements";

/**
 * The one form a plan used to ask its client for their half, and whatever they
 * have answered so far.
 *
 * Read rather than recorded. Migration 078 keeps a single id on the plan and
 * nothing else: which needs have been met is worked out from the client's own
 * answers in `responses`, because a flag on the firm's side would be the firm
 * asserting something about the client. See `plan-requirements.ts`.
 */
export type ClientAsk = {
  submissionId: string;
  formId: string;
  /** form-vocab's SUBMISSION_STATUS — awaiting, submitted, accepted, and so on. */
  status: string;
  sentAt: string | null;
  submittedAt: string | null;
  /**
   * Keyed by `needFieldId(slug)`. Empty where nothing has come back yet.
   *
   * An answer the professional has sent back for correction (whitbyos/081) is
   * left out. The file is still on the submission and the review panel still
   * shows it, but it has been rejected: the plan is waiting on the client
   * again, and a panel that went on saying "In" over something already turned
   * down would be counting it as progress.
   */
  responses: Record<string, string>;
  /**
   * The answers as they stood when somebody accepted them (migration 080).
   *
   * Compared by value rather than by key: a client who replaces an accepted
   * passport scan with a different file has given something nobody has looked
   * at, and the panel has to stop calling that accepted.
   */
  acceptedResponses: Record<string, string>;
  /**
   * The field ids the form already carries, so the panel can tell a need that
   * has been asked for from one that has not. Without it every row offered a
   * ticked box, and the screen went on inviting somebody to ask again for
   * things the client was already looking at.
   */
  fieldIds: Set<string>;
  /** The conversation the ask was posted into, so it can be checked. */
  threadId: string | null;
  /**
   * Which tab that conversation lives on.
   *
   * You and one client contact is a direct conversation, and the link to it
   * said `tab=group` regardless, so pressing "See the message" opened the
   * Group tab with the direct thread showing beside a list it is not in.
   */
  threadKind: "direct" | "group";
};

/** Where the client goes to answer it. */
export function clientAskHref(submissionId: string): string {
  return `/client-portal/forms/${submissionId}`;
}

/** Where the professional goes to read the message that went with it. */
export function askMessageHref(threadId: string, kind: "direct" | "group"): string {
  return `/whitbyos/messages?tab=${kind}&thread=${threadId}`;
}

/**
 * Where the professional goes to read what came back: the Forms screen's
 * Submissions tab, opened on this one. There is no page of its own for a
 * submission — 11.2 reviews it in place — so the review panel is the address.
 */
export function staffAskHref(submissionId: string): string {
  return `/whitbyos/forms?tab=submissions&review=${submissionId}`;
}

/**
 * The ask, and the professional's own edits to what goes in it.
 *
 * Both off the same plan row, so they come back together. The edits exist on a
 * plan nobody has ever asked anything of, which is why they are not hung off
 * `ask` — a list somebody has been pruning before sending it is the normal
 * case, not a property of having sent it.
 */
export type ClientAskState = {
  ask: ClientAsk | null;
  edits: NeedEdits;
  /**
   * The firm's suggested first version for each proposable need, by slug
   * (migration 102).
   *
   * Beside the edits rather than inside the ask, for the same reason they are
   * there: a suggestion is drafted, read and corrected before anything goes
   * out, so it exists on a plan that has asked its client for nothing yet.
   */
  proposals: Record<string, string>;
};

const NOTHING: ClientAskState = {
  ask: null,
  edits: { extra: [], skip: [] },
  proposals: {},
};

/** The proposals jsonb, read back as a plain map of slug to text. */
export function readProposals(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: Record<string, string> = {};
  for (const [slug, text] of Object.entries(value as Record<string, unknown>)) {
    /* A blank suggestion is no suggestion. Stored empty it would put an empty
       box in front of a client under a heading promising the firm's own
       first version, which is worse than the blank box it replaced. */
    if (typeof text === "string" && text.trim()) out[slug] = text;
  }
  return out;
}

export async function getClientAsk(planId: string): Promise<ClientAskState> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return NOTHING;

  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select(
      "id, request_id, client_ask_submission_id, client_ask_extra, client_ask_skip, client_ask_proposals",
    )
    .eq("id", planId)
    .maybeSingle();

  const edits = readNeedEdits(plan?.client_ask_extra, plan?.client_ask_skip);
  const proposals = readProposals(plan?.client_ask_proposals);

  const submissionId = plan?.client_ask_submission_id as string | null | undefined;
  if (!submissionId) return { ask: null, edits, proposals };

  const { data: submission } = await supabase
    .from("whitbyos_form_submissions")
    .select(
      "id, form_id, status, sent_at, submitted_at, responses, accepted_responses, correction_fields, form:whitbyos_forms!form_id (fields)",
    )
    .eq("id", submissionId)
    .maybeSingle();

  // The column is `on delete set null`, so a missing row here means the form
  // was removed between the two reads rather than that the plan never asked.
  // Either way there is nothing to show, and nothing to repair.
  if (!submission) return { ask: null, edits, proposals };

  const sentBack = new Set(
    (Array.isArray(submission.correction_fields) ? submission.correction_fields : []).filter(
      (one): one is string => typeof one === "string",
    ),
  );

  const raw =
    submission.responses &&
    typeof submission.responses === "object" &&
    !Array.isArray(submission.responses)
      ? (submission.responses as Record<string, string>)
      : {};

  const responses = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !sentBack.has(key)),
  );

  const form = Array.isArray(submission.form) ? submission.form[0] : submission.form;
  const fieldIds = new Set(
    (Array.isArray(form?.fields) ? form.fields : [])
      .map((field) => (field as { id?: unknown })?.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  // Best effort: the ask is still an ask without a conversation to point at.
  const requestId = (plan?.request_id as string | null) ?? null;
  const { data: thread } = requestId
    ? await supabase
        .from("whitbyos_message_threads")
        .select("id, kind")
        .eq("request_id", requestId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const ask: ClientAsk = {
    submissionId: submission.id as string,
    formId: submission.form_id as string,
    status: (submission.status as string | null) ?? "awaiting",
    sentAt: (submission.sent_at as string | null) ?? null,
    submittedAt: (submission.submitted_at as string | null) ?? null,
    responses,
    acceptedResponses:
      submission.accepted_responses &&
      typeof submission.accepted_responses === "object" &&
      !Array.isArray(submission.accepted_responses)
        ? (submission.accepted_responses as Record<string, string>)
        : {},
    fieldIds,
    threadId: (thread?.id as string | null) ?? null,
    /* A thread with nobody named is the one case a group is what it is; the
       default matches what `postClientAskMessage` writes. */
    threadKind: (thread?.kind as string | null) === "group" ? "group" : "direct",
  };

  return { ask, edits, proposals };
}

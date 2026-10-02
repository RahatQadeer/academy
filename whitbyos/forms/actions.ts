"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { FIELD_TYPES, readFields } from "@/whitbyos/lib/form-vocab";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { notifyClientContacts } from "@/whitbyos/lib/notify";

const LIST = "/whitbyos/forms";
const ROUTE = "/[product]/[[...slug]]";

const VISIBILITY = new Set(["internal", "client_visible", "restricted"]);
const TYPES = new Set(FIELD_TYPES.map((row) => row.value));

function backWithError(message: string): never {
  redirect(`${LIST}?new=1&error=${encodeURIComponent(message)}`);
}

/** Stay on the Request Forms tab when a send was started from there. */
function sendFormError(formData: FormData, fallback: string, message: string): never {
  const returnTo = String(formData.get("return_to") ?? "").trim();
  if (returnTo.startsWith("/whitbyos/")) {
    const [path, query] = returnTo.split("?");
    const params = new URLSearchParams(query);
    params.set("attach", "1");
    params.set("error", message);
    redirect(`${path}?${params.toString()}`);
  }
  redirect(`${fallback}?send=1&error=${encodeURIComponent(message)}`);
}

/** Screen 11.1 — New Form, blank or copied from one that already works. */
export async function createForm(formData: FormData) {
  await stopIfReadOnly();

  const title = String(formData.get("title") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "internal").trim();
  const category = String(formData.get("category") ?? "").trim();
  const copyFrom = String(formData.get("copy_from") ?? "").trim();

  if (!title) backWithError("Give the form a name.");

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) backWithError("Create your workspace first.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) backWithError("Sign in again to create a form.");

  let fields: unknown = [];
  if (copyFrom) {
    const { data: source } = await supabase
      .from("whitbyos_forms")
      .select("fields, workspace_id")
      .eq("id", copyFrom)
      .maybeSingle();

    // A form from another workspace is not a template to copy.
    if (source?.workspace_id === workspaceId) fields = source.fields ?? [];
  }

  const { data, error } = await supabase
    .from("whitbyos_forms")
    .insert({
      workspace_id: workspaceId,
      title,
      is_template: true,
      visibility: VISIBILITY.has(visibility) ? visibility : "internal",
      category: category || null,
      fields,
      // Who "Only me" means, when that is the visibility chosen.
      created_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) backWithError(error?.message ?? "Could not create the form.");

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}/${data.id}?created=1`);
}

/**
 * Screen 11.1b's Save Form.
 *
 * The whole field list is submitted rather than one field at a time. The
 * builder is a form, and a field that saved on its own would leave a
 * half-edited list behind whenever someone closed the page mid-thought.
 */
export async function saveForm(formData: FormData) {
  await stopIfReadOnly();

  const formId = String(formData.get("form_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "internal").trim();
  const category = String(formData.get("category") ?? "").trim();
  // Preview and Send to Client used to be links out of an unsaved form, so
  // pressing either threw away every field typed since the last save — and Send
  // then posted the empty version to a client. They submit through here now and
  // say where to go afterwards.
  const then = String(formData.get("then") ?? "").trim();

  const back = `${LIST}/${formId}`;
  if (!formId) redirect(LIST);
  if (!title) redirect(`${back}?error=${encodeURIComponent("A form needs a name.")}`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const labels = formData.getAll("field_label").map((v) => String(v).trim());
  const types = formData.getAll("field_type").map((v) => String(v));
  const requiredFlags = formData.getAll("field_required").map((v) => String(v));
  const ids = formData.getAll("field_id").map((v) => String(v));

  const fields = labels.flatMap((label, index) => {
    if (!label) return [];
    const type = types[index] ?? "short";
    return [
      {
        id: ids[index] || randomUUID(),
        label,
        type: TYPES.has(type) ? type : "short",
        // Checkboxes only submit when ticked, so the row's own hidden marker
        // carries the answer instead of the index shifting under a blank.
        required: requiredFlags[index] === "1",
      },
    ];
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("whitbyos_forms")
    .update({
      title,
      visibility: VISIBILITY.has(visibility) ? visibility : "internal",
      category: category || null,
      fields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");

  if (then === "preview") redirect(`${back}?preview=1`);
  if (then === "send") redirect(`${back}?send=1`);

  redirect(`${back}?saved=1`);
}

/** Screen 11's Duplicate. */
export async function duplicateForm(formData: FormData) {
  await stopIfReadOnly();

  const formId = String(formData.get("form_id") ?? "").trim();
  if (!formId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LIST);

  const { data: source } = await supabase
    .from("whitbyos_forms")
    .select("title, visibility, category, fields, workspace_id")
    .eq("id", formId)
    .maybeSingle();

  if (!source || source.workspace_id !== workspaceId) redirect(LIST);

  const { data, error } = await supabase
    .from("whitbyos_forms")
    .insert({
      workspace_id: workspaceId,
      title: `${source.title} (copy)`,
      is_template: true,
      visibility: source.visibility,
      category: source.category,
      fields: source.fields,
      // A copy of somebody's private form is the copier's, not theirs.
      created_by_user_id: user.id,
      // 11.1b's header says where a copy came from, and it could not until now.
      duplicated_from_form_id: formId,
    })
    .select("id")
    .single();

  if (error || !data) redirect(`${LIST}?error=${encodeURIComponent(error?.message ?? "Could not duplicate it.")}`);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}/${data.id}?duplicated=1`);
}

/**
 * Screen 11.3 — accepting a submission, or asking for a correction.
 *
 * Both are the same act from the professional's side: a decision on someone
 * else's answers, recorded with who made it. Asking for a correction keeps the
 * answers — the client is being asked to change something, not start again.
 */
export async function reviewSubmission(formData: FormData) {
  await stopIfReadOnly();

  const submissionId = String(formData.get("submission_id") ?? "").trim();
  const accept = String(formData.get("accept") ?? "") === "1";
  const note = String(formData.get("note") ?? "").trim();

  const back = `${LIST}?tab=submissions`;
  if (!submissionId) redirect(back);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(back);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: submission } = await supabase
    .from("whitbyos_form_submissions")
    .select(
      "id, responses, accepted_responses, client_id, sent_to_contact_id, form:whitbyos_forms!form_id (workspace_id, title, fields)",
    )
    .eq("id", submissionId)
    .maybeSingle();

  const form = submission?.form as unknown as {
    workspace_id: string;
    title: string;
    fields: unknown;
  } | null;
  if (!submission || form?.workspace_id !== workspaceId) redirect(back);

  /*
   * A correction now names the answers it is about (migration 081).
   *
   * Sending the whole form back reopened four answers nobody had complained
   * about and cleared their acceptance with them; the note said which one was
   * wrong and nothing else did. The dialog ticks the ones to send back, and
   * those are the only ones that lose their place.
   */
  const sendBack = formData.getAll("correct").map((value) => String(value));

  if (!accept && !note) {
    redirect(`${back}&review=${submissionId}&error=${encodeURIComponent("Say what needs correcting.")}`);
  }

  const answers = (
    submission.responses && typeof submission.responses === "object" &&
    !Array.isArray(submission.responses)
      ? submission.responses
      : {}
  ) as Record<string, string>;

  if (!accept && sendBack.length === 0) {
    redirect(
      `${back}&review=${submissionId}&error=${encodeURIComponent("Nothing was sent back: tick the box beside each answer you want the client to do again.")}`,
    );
  }

  /*
   * What was accepted, not just that something was (migration 080).
   *
   * A submission carries one status for the whole form, and a Work Plan's
   * client ask grows: a fifth question added to a form whose first four were
   * accepted has to put the submission back to `awaiting`, and that took the
   * acceptance of the first four with it. A copy of the answers as they stood
   * keeps it, and keeps it honest — an answer replaced since is not the answer
   * anybody accepted.
   *
   * Cleared on Request Correction: sending it back says something in it is
   * wrong without saying which part, so nothing in it is still accepted.
   */
  const held = (
    submission.accepted_responses &&
    typeof submission.accepted_responses === "object" &&
    !Array.isArray(submission.accepted_responses)
      ? submission.accepted_responses
      : {}
  ) as Record<string, string>;

  // Only what was ticked loses its acceptance. Everything else stays settled,
  // and stays locked on the client's side.
  const kept = Object.fromEntries(
    Object.entries(held).filter(([key]) => !sendBack.includes(key)),
  );

  /*
   * Accepting answers is not the same as accepting the form.
   *
   * "Accept the other 1" used to mark the whole submission accepted with a
   * question still blank, which told the client nothing further was needed and
   * took the form off their list while the firm was waiting on it. A
   * submission is accepted only when every question on it has been answered
   * and every answer has been accepted; until then it goes back to awaiting,
   * because that is what it is doing.
   */
  const questions = readFields(form?.fields).map((field) => field.id);
  const blank = questions.filter((id) => !answers[id]?.trim());
  const settledStatus = blank.length === 0 ? "accepted" : "awaiting";

  const { error } = await supabase
    .from("whitbyos_form_submissions")
    .update({
      status: accept ? settledStatus : "correction_required",
      correction_note: accept ? null : note,
      accepted_responses: accept ? answers : kept,
      // Rewritten each time, so it describes the correction outstanding now
      // rather than every one ever asked for.
      correction_fields: accept ? [] : sendBack,
      reviewed_by_user_id: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) redirect(`${back}&error=${encodeURIComponent(error.message)}`);

  /*
   * A correction the client is never told about is a correction nobody makes.
   *
   * The submission goes back to their Action Required either way, but only
   * somebody already looking at the portal would find it there. `action_needed`
   * is the event for it: this is a thing they have to do, and it is the switch
   * they would turn off if they did not want to hear about those.
   *
   * Not on Accept. Nothing is being asked of them and the form says Accepted
   * the next time they open it, so a notice would be news with no action in it.
   */
  const clientId = (submission.client_id as string | null) ?? null;
  if (!accept && clientId) {
    const contactId = (submission.sent_to_contact_id as string | null) ?? null;

    await notifyClientContacts({
      workspaceId,
      clientId,
      event: "action_needed",
      area: "forms",
      title: "Your team has asked for a correction",
      body: note,
      href: `/client-portal/forms/${submissionId}`,
      entityType: "form_submission",
      entityId: submissionId,
      onlyContactIds: contactId ? [contactId] : null,
    });
  }

  revalidatePath(ROUTE, "page");
  redirect(
    `${back}&${accept ? "accepted" : "corrected"}=${encodeURIComponent(form?.title ?? "Submission")}${
      // How many questions the client still owes, so the toast can say the
      // answers were accepted without implying the form is finished.
      accept && blank.length > 0 ? `&waiting=${blank.length}` : ""
    }`,
  );
}

/**
 * Screen 11.1b's Send to Client — the only path that turns a Form template
 * into something a client can see.
 *
 * `whitbyos_forms` and `whitbyos_form_submissions` are separate tables on
 * purpose (a template is reused across many clients), but nothing before this
 * ever inserted the submission row. The Client Portal's Forms screen reads
 * only `whitbyos_form_submissions` (client-portal/lib/data/forms.ts), so a
 * form with no submission against a client is invisible there no matter how
 * complete it is.
 *
 * Only a Client Visible form can be sent — SRS 7.2.7 ties the send action to
 * the same visibility level the client-side RLS gates on, so an Internal or
 * Restricted form can never leak by being pointed at a client.
 *
 * `status` starts as 'awaiting' (form-vocab's Awaiting Response), not the
 * column's own default of 'submitted' — a submission that starts out claiming
 * to already be submitted would confuse both the professional's queue and the
 * client's Action Required tab.
 */
export async function sendForm(formData: FormData) {
  await stopIfReadOnly();

  const formId = String(formData.get("form_id") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  const contactId = String(formData.get("contact_id") ?? "").trim();

  const back = `${LIST}/${formId}`;
  if (!formId) redirect(LIST);
  if (!clientId) sendFormError(formData, back, "Choose the client.");

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  const { data: form } = await supabase
    .from("whitbyos_forms")
    .select("id, title, visibility, workspace_id")
    .eq("id", formId)
    .maybeSingle();

  if (!form || form.workspace_id !== workspaceId) redirect(LIST);

  if (form.visibility !== "client_visible") {
    sendFormError(formData, back, "Only a Client Visible form can be sent. Change its visibility first.");
  }

  const { data: client } = await supabase
    .from("whitbyos_clients")
    .select("id")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!client) {
    sendFormError(formData, back, "That client is not in this workspace.");
  }

  // Same rule the Request below follows: the list in the dialog is not scoped
  // to the chosen client by JavaScript, so the pairing is checked here.
  let sentToContactId: string | null = null;
  if (contactId) {
    const { data: member } = await supabase
      .from("whitbyos_client_members")
      .select("contact_id")
      .eq("client_id", clientId)
      .eq("contact_id", contactId)
      .maybeSingle();

    if (!member) {
      sendFormError(formData, back, "That contact is not on this client.");
    }
    sentToContactId = contactId;
  } else {
    // Nobody chosen means the client's primary contact, not nobody. A form goes
    // to a client, and the person who speaks for that client is who it reaches
    // unless somebody says otherwise — leaving it null put a dash in 11.2's
    // Sent To column for every ordinary send.
    const { data: primary } = await supabase
      .from("whitbyos_clients")
      .select("primary_contact_id")
      .eq("id", clientId)
      .maybeSingle();

    sentToContactId = (primary?.primary_contact_id as string | null) ?? null;
  }

  let linkedRequestId: string | null = null;
  if (requestId) {
    const { data: request } = await supabase
      .from("whitbyos_requests")
      .select("id, client_id")
      .eq("id", requestId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!request) {
      sendFormError(formData, back, "That request is not in this workspace.");
    }
    if (request.client_id !== clientId) {
      sendFormError(formData, back, "That request belongs to a different client.");
    }
    linkedRequestId = request.id;
  }

  const { data: submission, error } = await supabase
    .from("whitbyos_form_submissions")
    .insert({
      form_id: formId,
      client_id: clientId,
      request_id: linkedRequestId,
      sent_to_contact_id: sentToContactId,
      // 11.2 dates a row that is still awaiting a response, so the date it went
      // out is recorded now rather than worked out later from a row's created_at.
      sent_at: new Date().toISOString(),
      status: "awaiting",
      responses: {},
    })
    .select("id")
    .single();

  if (error) sendFormError(formData, back, error.message);

  // The person it was sent to is the person asked. Nobody chosen and no
  // primary contact on file leaves it addressed to the account as a whole.
  if (submission) {
    await notifyClientContacts({
      workspaceId,
      clientId,
      event: "form_requested",
      area: "forms",
      title: "A form is waiting for you",
      body: (form.title as string | null) ?? null,
      href: `/client-portal/forms/${submission.id}`,
      entityType: "form_submission",
      entityId: submission.id as string,
      onlyContactIds: sentToContactId ? [sentToContactId] : null,
    });
  }

  revalidatePath(ROUTE, "page");
  const returnTo = String(formData.get("return_to") ?? "").trim();
  redirect(returnTo.startsWith("/whitbyos/") ? returnTo : `${back}?sent=1`);
}

/** Removing a field from the builder without saving the rest of the form. */
export async function removeFormField(formData: FormData) {
  await stopIfReadOnly();

  const formId = String(formData.get("form_id") ?? "").trim();
  const fieldId = String(formData.get("field_id") ?? "").trim();
  if (!formId || !fieldId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_forms")
    .select("fields, workspace_id")
    .eq("id", formId)
    .maybeSingle();

  if (!data || data.workspace_id !== workspaceId) redirect(LIST);

  await supabase
    .from("whitbyos_forms")
    .update({
      fields: readFields(data.fields).filter((field) => field.id !== fieldId),
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}/${formId}`);
}

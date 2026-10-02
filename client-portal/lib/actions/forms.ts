"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { TOASTS } from "@/client-portal/lib/toasts";
import { getForm } from "@/client-portal/lib/data/forms";
import { formIsEditable } from "@/client-portal/lib/status";
import type { PortalFormField } from "@/client-portal/types";
import { requireWrite, toastUrl } from "./guard";
import { IN_APP, notifyWorkspaceMembers } from "@/whitbyos/lib/notify";

const FORMS_PATH = "/client-portal/forms";

/**
 * The three `SUBMISSION_STATUS` values a client may still write to, as the
 * database sees them. Kept beside `formIsEditable`, which answers the same
 * question about a `FormStatus` for the screens — one rule, in the two shapes
 * the two layers need.
 */
const EDITABLE_STATUSES = ["awaiting", "draft", "correction_required"];

/**
 * Placeholder for a file that has been chosen but not yet uploaded.
 *
 * It exists only between the two passes in `persist`, so the required-field
 * check can see that a file field has been answered without the upload having
 * happened yet. Every one is overwritten with a real storage path before the
 * update runs, and a failed upload redirects rather than writing.
 */
const PENDING_UPLOAD = "\u0000pending-upload";

async function persist(formData: FormData, submit: boolean) {
  const submissionId = formData.get("submissionId");
  if (typeof submissionId !== "string" || !submissionId) {
    redirect(toastUrl(FORMS_PATH, "That form could not be found."));
  }

  // Read the field list from the form definition rather than trusting the POST
  // body, so a client cannot write arbitrary keys into the responses jsonb.
  const definition = await getForm(submissionId);
  if (!definition) {
    redirect(toastUrl(FORMS_PATH, "That form could not be found."));
  }

  const wasCorrection = definition.status === "correction_required";

  // Whose move it is, checked on the server and not only in the page.
  //
  // `formIsEditable` decides whether the detail screen draws the buttons at all,
  // and until now that was the only thing stopping a write. It is a rendering
  // decision, and three ordinary situations get past it: a tab left open while
  // the professional accepts the submission, the browser's own resubmission of a
  // POST, and a bookmarked action. Any of them overwrote answers that had
  // already been signed off, and cleared `reviewed_at` in the same statement —
  // so a submission the professional had accepted came back to their queue
  // looking like one nobody had ever looked at.
  //
  // Read from `definition`, which came through `getForm` and therefore through
  // this client's own policies: a form belonging to somebody else is already
  // `null` above.
  if (!formIsEditable(definition.status)) {
    redirect(
      toastUrl(
        `${FORMS_PATH}/${submissionId}`,
        definition.status === "accepted"
          ? "Your team has accepted this form, so it can no longer be changed."
          : "This form is with your team for review and can no longer be changed.",
      ),
    );
  }

  const guard = await requireWrite("forms");
  if ("reason" in guard) {
    redirect(toastUrl(`${FORMS_PATH}/${submissionId}`, guard.reason));
  }
  const { ctx } = guard;

  const supabase = await createClient();

  const responses: Record<string, string> = {};

  // Everything that is already in the POST body, before anything is uploaded.
  //
  // The two passes are the point. A file field is the only answer whose
  // collection has a side effect: `attachFile` writes to storage and inserts a
  // `documents` row. Doing that in the same pass as the text answers meant a
  // submit that failed the required-field check below had already put the file
  // in the client's Documents and then thrown the answers away — so the
  // submission never learned the path, and attaching it again on the retry left
  // two copies of the same file with only the second one referenced.
  const pendingFiles: { field: PortalFormField; file: File }[] = [];

  /**
   * An answer the team has already accepted is settled and cannot be replaced.
   *
   * Compared by value, the same way the professional's side reads it
   * (whitbyos/080). The screen hides the control, and this is what makes that
   * true rather than cosmetic: a post that names one of these fields anyway
   * would otherwise put a file on the record nobody has seen, wearing the
   * approval given to a different one.
   */
  const settled = (key: string) => {
    const was = definition.acceptedResponses[key];
    return Boolean(was) && was === definition.responses[key];
  };

  for (const field of definition.fields) {
    if (settled(field.key)) {
      responses[field.key] = definition.responses[field.key];
      continue;
    }

    // A checklist posts once per ticked box, so `get` would keep only the
    // first answer and silently drop the rest. They are stored newline-joined
    // — see PortalForm.responses for why the column stays a string map.
    if (field.type === "checklist") {
      const ticked = formData
        .getAll(field.key)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      if (ticked.length > 0) responses[field.key] = ticked.join("\n");
      continue;
    }

    if (field.type === "file") {
      const file = formData.get(`file:${field.key}`);
      if (file instanceof File && file.size > 0) {
        pendingFiles.push({ field, file });
        // Stands in for the upload while the required check runs. It is
        // replaced by the real storage path in the second pass, and never
        // reaches the database: nothing is written until every upload has
        // succeeded.
        responses[field.key] = PENDING_UPLOAD;
      } else if (
        definition.responses[field.key] &&
        !definition.correctionFields.includes(field.key)
      ) {
        // Nothing chosen this time keeps whatever was attached last time,
        // rather than clearing an upload because the input came back empty.
        //
        // Except where the team sent that one back. Keeping it would answer a
        // correction with the very file that was turned down, and the check
        // below would see a full form and let it through.
        responses[field.key] = definition.responses[field.key];
      }
      continue;
    }

    const value = formData.get(field.key);
    if (typeof value === "string" && value.trim().length > 0) {
      responses[field.key] = value.trim();
    }
  }

  /*
   * A sent-back answer left untouched is still unanswered.
   *
   * A text field posts whatever is in the box, and the box is prefilled with
   * the answer that was turned down — so retyping nothing would hand the team
   * back the same words they rejected and read as complete. Only a different
   * answer counts.
   */
  for (const key of definition.correctionFields) {
    if (responses[key] && responses[key] === definition.responses[key]) {
      delete responses[key];
    }
  }

  if (submit) {
    /*
     * Submitting means finished, so everything has to be there.
     *
     * The check used to read each field's own `required` flag, and a Work
     * Plan's client ask writes every question as optional on purpose: a client
     * who cannot lay hands on one of six documents today must still be able to
     * send the other five. That left Submit happy over a blank, so a form went
     * to the team saying it was done with a question never answered.
     *
     * Both halves hold together because Save draft is the other button: it
     * keeps whatever is there, the answers reach the plan the moment they are
     * saved, and the form stays on the client's list until it is complete.
     */
    const missing = definition.fields
      .filter((field) => !responses[field.key]?.trim())
      .map((field) => field.label);

    if (missing.length > 0) {
      redirect(
        toastUrl(
          `${FORMS_PATH}/${submissionId}`,
          missing.length === 1
            ? `${missing[0]} is still empty. Use Save draft to keep what you have and finish later.`
            : `${missing.length} answers are still empty, starting with ${missing[0]}. Use Save draft to keep what you have and finish later.`,
        ),
      );
    }
  }

  // Only now, with the answers known to be complete, does anything leave the
  // request. A file field is uploaded on the same path client uploads already
  // take (`uploadDocument`), so what the client attaches to a form lands in
  // their Documents like everything else rather than in a second store only
  // this screen knows about. The response holds the storage path, which is what
  // `documents.file_url` holds too.
  for (const { field, file } of pendingFiles) {
    const path = await attachFile(supabase, ctx, definition, field.label, file);
    if (!path) {
      redirect(
        toastUrl(`${FORMS_PATH}/${submissionId}`, "Upload failed. Please try again."),
      );
    }
    responses[field.key] = path;
  }

  const { data: written, error } = await supabase
    .from("whitbyos_form_submissions")
    .update({
      responses,
      // "draft", not "in_progress" — form-vocab.ts's SUBMISSION_STATUS is the
      // shared vocabulary both sides read; a value outside it falls back to
      // "Draft" on the professional's Submissions screen anyway, so writing
      // anything else here was already silently getting relabeled there.
      //
      // Saving part-way through a correction is the exception, and keeps
      // `correction_required`. Writing "draft" there threw away the one fact
      // the state carries: on the professional's Submissions screen the row
      // stopped saying they had asked for something and started saying the
      // client was still filling it in, and in the portal the correction note
      // vanished from the screen while still sitting in the column. Neither
      // side could then see that a correction was outstanding — over a save
      // button that is supposed to lose nothing.
      /*
       * Saving keeps the state it was in, rather than calling it a draft.
       *
       * A form the team is waiting on is still a form the team is waiting on
       * after the client saves half of it: writing "draft" here took it off
       * their Action Needed and out of the professional's Awaiting queue, over
       * a save button that is supposed to lose nothing. With Submit now
       * refusing an incomplete form, Save is the ordinary way through a long
       * ask, and it has to leave the ask standing.
       */
      status: submit
        ? "submitted"
        : wasCorrection
          ? "correction_required"
          : definition.status === "awaiting"
            ? "awaiting"
            : "draft",
      submitted_at: submit ? new Date().toISOString() : null,
      ...(submit
        ? {
            // Who actually filled it in, which `sendForm` cannot know: 11.2
            // draws Sent To and the submitter as two columns precisely because
            // a form sent to one member of a household is often answered by
            // another. Nothing wrote this before, so the professional's screen
            // could only ever name the person it went to.
            submitted_by_contact_id: ctx.contactId,
            // Resubmitting is how a client answers a correction request; clear
            // the note so it doesn't keep reading as open once they've acted
            // on it, and clear the review with it. `reviewed_at` records a
            // decision about a specific set of answers — leaving it against
            // answers that have just been replaced would date the new
            // submission with the old verdict, and the professional's queue
            // would show a row as reviewed that nobody has looked at yet.
            correction_note: null,
            // The answers it named have just been replaced, so nothing is
            // outstanding under it any more.
            correction_fields: [],
            reviewed_at: null,
            reviewed_by_user_id: null,
          }
        : {}),
    })
    .eq("id", submissionId)
    .eq("client_id", ctx.clientId)
    // The same editability check again, this time as part of the statement.
    //
    // The one above closed the door on a stale *page*; this closes it on a
    // stale *read*. Between `getForm` and here the professional may have
    // accepted the submission, and two people on one account may be answering
    // the same form in two tabs. Naming the states that may be written makes
    // the check and the write one operation, so a decision made in between
    // costs nothing and stands.
    .in("status", EDITABLE_STATUSES)
    .select("id");

  if (error) {
    redirect(
      toastUrl(`${FORMS_PATH}/${submissionId}`, "Could not save. Please try again."),
    );
  }

  // No error and no row means the filter above matched nothing: something moved
  // underneath this write. Said plainly, because the client's answers were not
  // saved and "saved" would be a lie.
  if (!written || written.length === 0) {
    redirect(
      toastUrl(
        `${FORMS_PATH}/${submissionId}`,
        "Your team reviewed this form while you were working on it, so nothing was saved. Open it again to see where it stands.",
      ),
    );
  }

  // The round that has just closed, recorded before the note it describes is
  // gone. The update above cleared `correction_note` and `reviewed_at`, which is
  // right for the professional's queue and destroys the only record the client
  // had of what they were asked for — so it is copied here first.
  //
  // Deliberately after the update and deliberately not fatal: the answers are
  // saved and submitted either way, and losing the history of a round is not a
  // reason to tell a client their form did not go. `client-portal/010` is a
  // proposal until its owner applies it, so on an environment without the table
  // this is simply a write that does not land.
  if (submit && wasCorrection) {
    await supabase.from("client_portal_form_corrections").insert({
      submission_id: submissionId,
      client_id: ctx.clientId,
      note: definition.correctionNote,
      asked_at: definition.reviewedAt,
      answered_by_contact_id: ctx.contactId,
    });
  }

  if (submit) {
    /*
     * A correction coming back is its own news, under its own kind.
     *
     * A notice is suppressed while an unread one about the same kind and the
     * same thing is already sitting in the bell, which is right for a form
     * submitted twice by accident and wrong here: the professional asked for
     * something and this is the answer. Sharing the kind with the first
     * submission would have hidden it behind that first unread notice.
     */
    await notifyWorkspaceMembers({
      workspaceId: ctx.workspaceId,
      event: IN_APP.formSubmission,
      kind: wasCorrection ? "form_correction" : IN_APP.formSubmission,
      title: wasCorrection ? "A correction has come back" : "Form submission received",
      body: definition.title,
      href: `/whitbyos/forms?tab=submissions&review=${submissionId}`,
      entityType: "form_submission",
      entityId: submissionId,
    });
  }

  revalidatePath(FORMS_PATH);
  revalidatePath("/client-portal");

  redirect(
    submit
      ? toastUrl(
          FORMS_PATH,
          // `definition` was read before the update, so its status is the one
          // the client was acting on: a resubmitted correction says so rather
          // than reporting itself as a first submission.
          wasCorrection ? TOASTS.formResubmitted : TOASTS.formSubmitted,
        )
      : toastUrl(`${FORMS_PATH}/${submissionId}`, TOASTS.formSaved),
  );
}

const BUCKET = "documents";
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Puts a form's file answer where every other client upload goes: the private
 * `documents` bucket under the client's own prefix, with a `documents` row at
 * `client_visible` beside it.
 *
 * Returns the storage path, or null if either half failed — the caller turns
 * that into a message rather than saving a response that points at nothing.
 * The row is tagged to the form's Request when it has one, so the file appears
 * on that Request's Documents tab and not only in the flat list.
 */
async function attachFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: { clientId: string; userId: string | null },
  form: { id: string; title: string; requestId: string | null },
  fieldLabel: string,
  file: File,
): Promise<string | null> {
  if (file.size > MAX_BYTES) return null;

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${ctx.clientId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) return null;

  const { error } = await supabase.from("documents").insert({
    // Named for the question it answers, so the Documents list says what it is
    // rather than repeating whatever the file was called on the client's disk.
    title: `${form.title}: ${fieldLabel}`,
    file_url: path,
    context_type: form.requestId ? "request" : "client",
    context_id: form.requestId ?? ctx.clientId,
    visibility: "client_visible",
    status: "current",
    version: 1,
    uploaded_by_user_id: ctx.userId,
  });

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return null;
  }

  return path;
}

export async function saveFormDraft(formData: FormData) {
  await persist(formData, false);
}

export async function submitForm(formData: FormData) {
  await persist(formData, true);
}

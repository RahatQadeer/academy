import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { createForm, reviewSubmission, sendForm } from "@/whitbyos/forms/actions";
import {
  FORM_VISIBILITY,
  submissionLabel,
  submissionTone,
} from "@/whitbyos/lib/form-vocab";
import type { SubmissionRow } from "@/whitbyos/lib/forms";
import { shortDate } from "@/whitbyos/lib/format";

/** Screen 11.1 — New Form. */
export function NewFormDialog({
  forms,
  closeHref,
  error,
  showClients = true,
}: {
  forms: { id: string; title: string }[];
  closeHref: string;
  error?: string;
  showClients?: boolean;
}) {
  return (
    <Modal title="New Form" closeHref={closeHref} width={480} dense>
      <form action={createForm} className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Field label="Start from" htmlFor="copy_from">
          <select id="copy_from" name="copy_from" defaultValue="" className={`${CONTROL} text-[13.5px]`}>
            <option value="">Blank form</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                Duplicate: {form.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Form name" htmlFor="title">
          <input
            id="title"
            name="title"
            required
            placeholder="e.g. Travel Preferences, Summer"
            className={CONTROL}
          />
        </Field>

        {/* 11.1 draws three radios, not a select, and asks for no category at
            all. Visibility is the one choice on this dialog with a consequence
            — who can see the thing — and three options laid out are three
            options read, where a closed select shows one and hides the rest.

            Category still exists on a form and the list still prints it; it is
            simply not asked for here, so a new form starts without one. */}
        <Field label="Visibility" htmlFor="visibility-internal">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {FORM_VISIBILITY.filter((option) => showClients || option.value !== "client_visible").map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 text-[14px]"
              >
                <input
                  id={`visibility-${option.value}`}
                  type="radio"
                  name="visibility"
                  value={option.value}
                  defaultChecked={option.value === "internal"}
                  className="h-[15px] w-[15px]"
                  style={{ accentColor: "var(--accent)" }}
                />
                {option.label}
              </label>
            ))}
          </div>
        </Field>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Create Form
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Screen 11.1b — Send to Client.
 *
 * A Request is optional: SRS 13.8.3 lets a Form link to the Client alone (an
 * intake form with no Request yet) or to a specific Request. The list is not
 * scoped to the chosen Client by JavaScript — this dialog is server-rendered,
 * like every other one in Whitby — so `sendForm` re-checks that the Request
 * actually belongs to the Client picked here and rejects the mismatch.
 */
export function SendFormDialog({
  formId,
  formTitle,
  clients,
  contacts,
  requests,
  closeHref,
  error,
}: {
  formId: string;
  formTitle: string;
  clients: { id: string; title: string }[];
  contacts: { id: string; name: string; clientName: string }[];
  requests: { id: string; title: string; clientName: string }[];
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title={`Send "${formTitle}"`} closeHref={closeHref} width={480} dense>
      <form action={sendForm} className="flex flex-col gap-4">
        <input type="hidden" name="form_id" value={formId} />
        {error ? <Callout tone="danger">{error}</Callout> : null}

        {clients.length === 0 ? (
          <Callout tone="warning">
            Add a Client first, a form has to be sent to someone.
          </Callout>
        ) : (
          <>
            <Field label="Client" htmlFor="client_id">
              <select id="client_id" name="client_id" required className={`${CONTROL} text-[13.5px]`}>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.title}
                  </option>
                ))}
              </select>
            </Field>

            {/* 11.2 draws Sent To on every row, including ones with no answer
                yet, so it is asked here rather than inferred from whoever
                eventually replies. Like the Request below, the list is not
                scoped to the chosen client by JavaScript, `sendForm` checks
                the pairing. */}
            <Field label="Sent To" htmlFor="contact_id">
              <select
                id="contact_id"
                name="contact_id"
                defaultValue=""
                className={`${CONTROL} text-[13.5px]`}
              >
                <option value="">The client&apos;s primary contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} ({contact.clientName})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Request (optional)" htmlFor="request_id">
              <select
                id="request_id"
                name="request_id"
                defaultValue=""
                className={`${CONTROL} text-[13.5px]`}
              >
                <option value="">Not tied to a request</option>
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.title} ({request.clientName})
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized
           
            variant="primary"
            disabled={clients.length === 0}
            className="px-[18px] py-[9px] text-[13.5px]"
          >
            Send
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Screen 11.3 — Review Submission.
 *
 * The answers are read-only. Editing what someone else wrote and then calling
 * it their submission would make the record untrue, which is why the only two
 * ways out are accepting it or saying what needs changing.
 */
export function ReviewSubmissionDialog({
  submission,
  closeHref,
  error,
}: {
  submission: SubmissionRow;
  closeHref: string;
  error?: string;
}) {
  /*
   * What was asked, paired with what came back.
   *
   * Answers are keyed by each field's id, so printing the keys as the
   * questions gave "need-both-adults-passports" where the question belongs.
   * The form's own fields carry the readable one. Anything answered under a
   * key the form no longer has is still shown, under its key, rather than
   * quietly dropped: it is somebody's answer either way.
   */
  /* Accepted is per answer, and by value: an answer replaced since it was
     accepted is something nobody has looked at. See migration 080. */
  const settled = (key: string) => {
    const was = submission.acceptedResponses[key];
    return Boolean(was) && was === submission.responses[key];
  };

  /*
   * An answer sent back reads as unanswered, here as everywhere else.
   *
   * The file is still on the submission and still in the client's Documents,
   * but it has been turned down and the form is waiting on a new one. Showing
   * it as the answer made this the one screen that disagreed with the plan,
   * the task and the export, all of which say the need is waiting again.
   */
  const asked = submission.questions.map((question) => {
    const sentBack = submission.correctionFields.includes(question.key);

    return {
      key: question.key,
      label: question.label,
      answer: sentBack ? null : (submission.responses[question.key] ?? null),
      file: sentBack ? null : (submission.files[question.key] ?? null),
      accepted: settled(question.key),
      sentBack,
    };
  });
  const known = new Set(submission.questions.map((question) => question.key));
  const orphans = Object.entries(submission.responses).filter(([key]) => !known.has(key));

  const rows = [
    ...asked,
    ...orphans.map(([key, answer]) => {
      const sentBack = submission.correctionFields.includes(key);
      return {
        key,
        label: key,
        answer: sentBack ? null : answer,
        file: null,
        accepted: settled(key),
        sentBack,
      };
    }),
  ];
  const answered = rows.filter((row) => row.answer && row.answer.trim().length > 0);

  /*
   * Two different questions, and they used to share one answer.
   *
   * There is nothing to act on at all until the client has answered
   * something — that is `waiting`, and it hides both buttons.
   *
   * Accept needs more than that: it needs an answer nobody has ruled on. Over
   * a form whose only unaccepted question is unanswered, Accept would accept
   * the same two things a second time and report that something happened.
   *
   * Request Correction needs only an answer, accepted or not. Deciding an hour
   * later that a scan is unreadable after all is a real thing to want, and the
   * tick beside it is what makes that deliberate rather than accidental.
   */
  const open = answered.filter((row) => !row.accepted);
  const waiting = answered.length === 0;

  /*
   * Already decided.
   *
   * The two buttons stood over a submission marked Accepted, so the screen
   * offered a decision that had been made and a press that would do nothing.
   * Sending it back after accepting is a real thing to want — the scan turns
   * out to be unreadable an hour later — so that one stays; accepting an
   * accepted submission is not.
   */
  const accepted = submission.status === "accepted";

  return (
    <Modal title={submission.formTitle} closeHref={closeHref} width={560} dense>
      <div className="-mt-3 mb-1 flex items-center gap-2">
        <Pill tone={submissionTone(submission.status)}>
          {submissionLabel(submission.status)}
        </Pill>
      </div>

      {/* Who did what, rather than one line that called the recipient the
          sender. This said "Submitted by Rohail" over a submission nobody had
          touched, next to the date it was sent. */}
      <p className="mb-[18px] text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {(submission.answeredAt
          ? [
              submission.submittedBy ? `Answered by ${submission.submittedBy}` : "Answered",
              shortDate(submission.answeredAt),
              submission.clientName,
            ]
          : [
              submission.sentTo ? `Sent to ${submission.sentTo}` : "Sent",
              submission.sentAt ? shortDate(submission.sentAt) : null,
              submission.clientName,
            ]
        )
          .filter(Boolean)
          .join(" · ")}
      </p>

      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {/*
       * The form starts above the answers, not below them.
       *
       * It used to open at the note field, which left every "send this one
       * back" tick outside the form element: the browser posted none of them,
       * the action saw nothing ticked, and a correction with a box visibly
       * ticked came back saying to tick a box. A control is only part of a
       * form if it is inside it.
       */}
      <form action={reviewSubmission}>
        <input type="hidden" name="submission_id" value={submission.id} />

      {rows.length === 0 ? (
        <p className="mb-5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          This form has no questions on it.
        </p>
      ) : (
        <>
          {waiting ? (
            <p className="mb-4 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Nothing has come back yet. This is what was asked for.
            </p>
          ) : (
            /* Above the boxes, not below them. The instruction sat under the
               list, beside the note field, so it was read after the button had
               already been pressed on a form with nothing ticked. */
            <p className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Tick anything the client should do again. Leave it all unticked to
              accept what is here.
            </p>
          )}

          {/* Three rows, then scroll: a plan's ask runs to twenty questions
              and the two buttons were a screen and a half below them. */}
          <div className="mb-5 flex max-h-[292px] flex-col gap-3.5 overflow-y-auto pr-1">
            {rows.map((row, index) => (
              <div key={`${row.label}-${index}`}>
                <div className="mb-1 flex items-center gap-2">
                  {/* Ticked where it is being sent back. On every answer,
                      including an accepted one: unsettling something already
                      signed off is exactly what this is for, and the tick is
                      what makes it deliberate. Not on a blank, because there
                      is nothing there to correct. */}
                  {row.answer ? (
                    <input
                      type="checkbox"
                      name="correct"
                      value={row.key}
                      aria-label={`Send back ${row.label}`}
                      className="shrink-0"
                    />
                  ) : null}
                  <span className="text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                    {row.label}
                  </span>
                  {row.sentBack ? (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
                      title="Sent back for correction. The client has been asked for a new one."
                    >
                      Sent back
                    </span>
                  ) : null}
                  {/* Said on the answer, because this is what was accepted.
                      The submission's own status covers the whole form and
                      goes back to waiting the moment a question is added. */}
                  {row.accepted ? (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
                    >
                      Accepted
                    </span>
                  ) : null}
                </div>
                {/* A file answer is a path in the documents bucket, which is
                    not something to read. It is a document, and the one thing
                    anybody wants to do with a passport is open it. */}
                {row.file ? (
                  <a
                    href={
                      row.file.documentId
                        ? `/api/whitbyos/documents/${row.file.documentId}/download`
                        : undefined
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13.5px] leading-[1.6] no-underline"
                    style={{
                      color: row.file.documentId ? "var(--accent)" : "var(--text-quiet)",
                    }}
                  >
                    {row.file.name}
                    {row.file.documentId ? null : " (the file is no longer on record)"}
                  </a>
                ) : (
                  <div
                    className="text-[13.5px] leading-[1.6]"
                    style={row.answer ? undefined : { color: "var(--text-quiet)" }}
                  >
                    {row.answer || "Not answered yet"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {submission.correctionNote ? (
        <div className="mb-5">
          <Callout tone="warning">
            Correction asked for: {submission.correctionNote}
          </Callout>
        </div>
      ) : null}

      {accepted ? (
        <div className="mb-4">
          <Callout tone="success">
            {submission.reviewedAt
              ? `Accepted on ${shortDate(submission.reviewedAt)}. Nothing is waiting on anybody.`
              : "Accepted. Nothing is waiting on anybody."}
          </Callout>
        </div>
      ) : null}

      {waiting ? (
        <p
          className="border-t border-line pt-4 text-[12.5px]"
          style={{ color: "var(--text-tertiary)", margin: 0 }}
        >
          There is nothing to accept or send back until the client answers
          something.
        </p>
      ) : (
      <div className="flex flex-col gap-3.5 border-t border-line pt-4">
        {/* Only Request Correction reads this, which the label now says: it
            sat above two buttons with no hint that one of them ignores it. */}
        <Field label="What is wrong with the ones you ticked" htmlFor="note">
          <input
            id="note"
            name="note"
            placeholder="e.g. The passport scan is cut off at the bottom"
            className={CONTROL}
          />
        </Field>

        <div className="flex justify-end gap-2.5">
          <button
            type="submit"
            formNoValidate
            className="rounded-control border px-4 py-[9px] text-[13.5px] font-medium"
            style={{
              borderColor: "var(--danger-border)",
              color: "var(--danger-outline-fg)",
              background: "var(--surface)",
            }}
          >
            Request Correction
          </button>
          {/* Only where something is waiting on a decision. A form whose
              every answer is already accepted has nothing left to accept. */}
          {open.length === 0 ? null : (
            <Submit unsized
              name="accept"
              value="1"
              variant="primary"
              className="px-[18px] py-[9px] text-[13.5px]"
            >
              {open.length === answered.length
                ? "Accept"
                : `Accept the other ${open.length}`}
            </Submit>
          )}
        </div>
      </div>
      )}
      </form>
    </Modal>
  );
}

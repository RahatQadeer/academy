import { notFound } from "next/navigation";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Input } from "@/base/components/Input";
import { cn } from "@/base/lib/cn";
import { getForm, listCorrectionRounds } from "@/client-portal/lib/data/forms";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { dueLabel, longDate } from "@/client-portal/lib/format";
import { saveFormDraft, submitForm } from "@/client-portal/lib/actions/forms";
import { PageBody } from "@/client-portal/components/PageHeader";
import { Select, Textarea } from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { ListPanel, PanelEmpty } from "@/client-portal/components/Panel";
import { CategoryTag } from "@/client-portal/components/CategoryTag";
import { CorrectionHistory } from "./components/CorrectionHistory";
import { StatusPill } from "@/client-portal/components/StatusPill";
import { FORM_STATUS, formIsEditable } from "@/client-portal/lib/status";
import type { PortalFormField } from "@/client-portal/types";

/**
 * One form, answered.
 *
 * WHAT WAS WRONG WITH IT
 *
 * It was a single card of stacked fields, and the hierarchy was upside down.
 * The question itself was drawn at 12.5px in `--text-tertiary` — the caption
 * size every settings pane uses for "Full name" — while the two grey notes
 * under each control ("Saved to your Documents…", the builder's own help text)
 * sat at the same size and nearly the same grey. So the quietest thing on the
 * row was the only thing the client had to read, and three file questions in a
 * row were six near-identical grey lines with a raw "Choose File" button in
 * between.
 *
 * WHAT IT IS NOW
 *
 * A question is a row, in the panel every other list screen uses. Each carries
 * a mark saying where it stands — answered, waiting on you, sent back, accepted
 * — the question at 14.5px in ink, the control under it, and the notes beneath
 * that at a size that reads as a footnote because it is one.
 *
 * Three things the old one never said, which is most of what made it confusing:
 *
 *   — how much is left. A form of twelve questions gave no count anywhere, so
 *     the only way to know whether you were nearly done was to scroll.
 *   — which answers are actually wanted. Required was never marked.
 *   — that help repeated on every field is one fact about the section. Where
 *     every question in a group carries the same note — "Needed for: Collect
 *     sponsor and applicant documents", eight times down a page — it is said
 *     once, under the heading it belongs to.
 */
export default async function FormDetailScreen({ formId }: { formId: string }) {
  const [context, form, rounds] = await Promise.all([
    getPortalContext(),
    getForm(formId),
    listCorrectionRounds(formId),
  ]);
  if (!form) notFound();

  // A view-only member reads a form and answers none of it. `formIsEditable`
  // still decides whether the *submission* is open at all — the two reasons a
  // form is read-only are different, and both have to hold for it to be
  // writable.
  const readOnly = !formIsEditable(form.status) || context.viewOnly;
  const isCorrection = form.status === "correction_required";

  const sections = sectionsOf(form.fields);
  // Which band the page opens on — see the note where `open` is worked out.
  const anyWanted = form.correctionFields.length > 0;
  const firstUnfinished = Math.max(
    0,
    sections.findIndex((group) => group.fields.some((field) => !isAnswered(form, field.key))),
  );
  const answered = form.fields.filter((field) => isAnswered(form, field.key)).length;
  const outstanding = form.fields.filter(
    (field) => field.required && !isAnswered(form, field.key),
  ).length;
  const due = dueLabel(form.dueLabel, new Date(), context.timezone);

  return (
    <PageBody>
      <div className="max-w-3xl">
        {/* The form's name and the way back to the list are on the bar. What
            it is for, who asked and when are not, because they are the answer
            to a different question from "which form is this". */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={FORM_STATUS[form.status]} />
          {form.category ? <CategoryTag category={form.category} /> : null}
        </div>

        <p className="mt-2 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          {[
            form.requestedByName ? `Requested by ${form.requestedByName}` : null,
            form.requestTitle ? `for ${form.requestTitle}` : null,
            form.submittedAt
              ? `Submitted ${longDate(form.submittedAt, context.timezone)}`
              : // `sent_at` (whitbyos/048) is the only date a form still awaiting
                // an answer has. It used to show nothing at all here.
                form.sentAt
                ? `Sent ${longDate(form.sentAt, context.timezone)}`
                : due,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {form.description ? (
          <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {form.description}
          </p>
        ) : null}

        {/* What happened to the answers, in the professional's own words.
            A correction request is the only one that asks for something back, so
            it is the only one drawn as a warning; an acceptance is drawn because
            "did my team sign this off?" had no answer anywhere in the portal
            before, not because it needs acting on. */}
        {isCorrection ? (
          <div className="mt-4">
            <Callout tone="warning" title="Your team has asked for a correction">
              {form.correctionNote ?? "Please check your answers and submit the form again."}
            </Callout>
          </div>
        ) : form.status === "accepted" ? (
          <div className="mt-4">
            <Callout tone="success" title="Accepted">
              {form.reviewedAt
                ? `Your team accepted this on ${longDate(form.reviewedAt, context.timezone)}. Nothing further is needed.`
                : "Your team has accepted this. Nothing further is needed."}
            </Callout>
          </div>
        ) : null}
      </div>

      <div className="mt-6 max-w-3xl">
        {form.fields.length === 0 ? (
          <ListPanel>
            <PanelEmpty
              glyph="▤"
              title="This form has no questions yet"
              detail="Your team is still preparing it. You'll be notified when it's ready."
            />
          </ListPanel>
        ) : (
          <ListPanel
            controls={
              <Progress
                answered={answered}
                total={form.fields.length}
                outstanding={readOnly ? 0 : outstanding}
                due={form.submittedAt ? null : due}
              />
            }
          >
            {/* multipart so a `file` field's upload actually reaches the
                action — without it the browser posts the filename as text. */}
            <form encType="multipart/form-data">
              <input type="hidden" name="submissionId" value={form.id} />

              {sections.map((group, index) => {
                const done = group.fields.filter((field) => isAnswered(form, field.key)).length;
                const wanted = group.fields.some((field) =>
                  form.correctionFields.includes(field.key),
                );
                /*
                 * Which band is open when the page arrives.
                 *
                 * A form of fourteen questions used to open all of it, so the
                 * answer to "how much is this going to take" was a scrollbar.
                 * Open: every band holding a question sent back, because that
                 * is what the client came for; otherwise the first band with
                 * anything left in it; otherwise the first. A form with one
                 * band is not a stack of bands and is simply drawn.
                 */
                const open =
                  sections.length === 1 || (anyWanted ? wanted : index === firstUnfinished);

                const head =
                  group.title || group.sharedHelp || group.blurb ? (
                    <>
                      {group.title ? (
                        <h2 className="m-0 min-w-0 text-[13.5px] font-semibold">{group.title}</h2>
                      ) : null}
                      {/* The blurb the builder wrote, and — where every
                          question in this group repeats the same help — that
                          help, said once instead of once per row. */}
                      {group.blurb || group.sharedHelp ? (
                        <p
                          className="m-0 mt-1 text-[12.5px] leading-[1.5]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {[group.blurb, group.sharedHelp].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </>
                  ) : null;

                const rows = (
                  <ol>
                    {group.fields.map((field) => {
                      const settled = isSettled(form, field.key);
                      const wanted = form.correctionFields.includes(field.key);
                      const filled = isAnswered(form, field.key);

                      return (
                        <li
                          key={field.key}
                          className="border-b px-4 py-4 last:border-b-0 sm:px-5"
                          style={{
                            borderColor: "var(--chat-line)",
                            // A question sent back is the one the client came
                            // for, so it is the one the page colours.
                            background: wanted ? "var(--warning-bg)" : "var(--chat-ground)",
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <Mark settled={settled} wanted={wanted} filled={filled} />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="text-[14.5px] font-semibold leading-snug">
                                  {field.label}
                                </span>
                                {/* Said on every row rather than only on the
                                    required ones: "optional" is the answer to
                                    "can I skip this?", and a page that marks
                                    only one of the two leaves the other
                                    ambiguous. */}
                                <span
                                  className="text-[11.5px] font-medium uppercase tracking-[.04em]"
                                  style={{
                                    color: field.required
                                      ? "var(--danger-text)"
                                      : "var(--text-quiet)",
                                  }}
                                >
                                  {field.required ? "Required" : "Optional"}
                                </span>
                              </div>

                              {wanted ? (
                                <p
                                  className="m-0 mt-1 text-[12.5px] leading-[1.5]"
                                  style={{ color: "var(--warning-fg)" }}
                                >
                                  <span className="font-semibold">
                                    Your team has asked for this one again.
                                  </span>
                                  {form.correctionNote ? ` ${form.correctionNote}` : ""}
                                </p>
                              ) : null}

                              {/* The builder's own note, unless it is the one
                                  every question in the section repeats. */}
                              {field.help && field.help !== group.sharedHelp ? (
                                <p
                                  className="m-0 mt-1 text-[12.5px] leading-[1.5]"
                                  style={{ color: "var(--text-tertiary)" }}
                                >
                                  {field.help}
                                </p>
                              ) : null}

                              <div className="mt-2.5">
                                <FormField
                                  field={field}
                                  value={form.responses[field.key] ?? ""}
                                  /*
                                   * An answer the team has accepted is settled,
                                   * so the form stops offering to replace it.
                                   * Replacing one would put a file on the
                                   * record nobody has seen, indistinguishable
                                   * from the one they signed off. Compared by
                                   * value, the same way the professional's side
                                   * reads it (whitbyos/080).
                                   */
                                  readOnly={readOnly || settled}
                                  settled={settled}
                                />
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                );

                // One band, or a band with nothing to label it: drawn open and
                // without a lid, exactly as this page always drew a form.
                if (!head) {
                  return <section key={`group-${index}`}>{rows}</section>;
                }

                if (sections.length === 1) {
                  return (
                    <section key={group.title ?? `group-${index}`}>
                      <div
                        className="border-b px-4 py-3 sm:px-5"
                        style={{ background: "var(--surface)", borderColor: "var(--chat-line)" }}
                      >
                        {head}
                      </div>
                      {rows}
                    </section>
                  );
                }

                return (
                  <details
                    key={group.title ?? `group-${index}`}
                    open={open}
                    className="cp-band"
                  >
                    <summary
                      className="cp-band-head flex cursor-pointer items-center gap-3 border-b px-4 py-3 sm:px-5"
                      style={{ background: "var(--surface)", borderColor: "var(--chat-line)" }}
                    >
                      <span className="cp-band-caret shrink-0" aria-hidden>
                        ›
                      </span>
                      <span className="min-w-0 flex-1">{head}</span>

                      {/* How much of this band is done, before it is opened —
                          which is the whole reason the bands exist. */}
                      {wanted ? (
                        <Pill tone="warning">Sent back</Pill>
                      ) : done === group.fields.length ? (
                        <Pill tone="success">Done</Pill>
                      ) : (
                        <span
                          className="shrink-0 text-[12px] tabular-nums"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {done} of {group.fields.length}
                        </span>
                      )}
                    </summary>
                    {rows}
                  </details>
                );
              })}

              {readOnly ? (
                <p
                  className="m-0 px-4 py-4 text-[13px] leading-relaxed sm:px-5"
                  style={{ color: "var(--text-tertiary)", background: "var(--surface)" }}
                >
                  {context.viewOnly && formIsEditable(form.status)
                    ? "Your access to this account is view only, so this form is yours to read rather than to answer. Your team can tell you who it is waiting on."
                    : form.status === "accepted"
                      ? "These answers have been accepted and can no longer be changed. Contact your team if something needs to change."
                      : "These answers are with your team for review. Contact your team if something needs to change."}
                </p>
              ) : (
                /* The foot travels with the form. On a twelve-question form the
                   buttons were a screen and a half below the last thing the
                   client looked at, which is the shape that gets abandoned
                   rather than submitted. */
                <div
                  className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--chat-line)",
                    boxShadow: "0 -6px 18px -14px rgb(var(--shade-rgb) / .5)",
                  }}
                >
                  <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                    {outstanding === 0
                      ? "Everything required is answered."
                      : `${outstanding} required ${outstanding === 1 ? "answer" : "answers"} still to go.`}
                  </span>

                  {/* Reversed in the drawing only: Submit stays the first
                      submit in the markup, so Enter in a field still submits
                      rather than saving a draft, and lands at the right. */}
                  <div className="flex flex-row-reverse flex-wrap items-center gap-2.5">
                    <SubmitButton
                      formAction={submitForm}
                      pendingLabel={isCorrection ? "Resubmitting…" : "Submitting…"}
                    >
                      {isCorrection ? "Resubmit" : "Submit"}
                    </SubmitButton>
                    <SubmitButton
                      formAction={saveFormDraft}
                      variant="secondary"
                      pendingLabel="Saving…"
                    >
                      Save draft
                    </SubmitButton>
                  </div>
                </div>
              )}
            </form>
          </ListPanel>
        )}
      </div>

      <div className="max-w-3xl">
        <CorrectionHistory rounds={rounds} timeZone={context.timezone} />
      </div>
    </PageBody>
  );
}

type Form = NonNullable<Awaited<ReturnType<typeof getForm>>>;

/** A question with something in it. Whitespace is not an answer. */
function isAnswered(form: Form, key: string): boolean {
  return Boolean(form.responses[key]?.trim());
}

/** Accepted by the team, and unchanged since — read-only, and said so. */
function isSettled(form: Form, key: string): boolean {
  return (
    Boolean(form.acceptedResponses[key]) && form.acceptedResponses[key] === form.responses[key]
  );
}

/**
 * How far through the form you are.
 *
 * The count is the thing: a client opening a twelve-question form wants to know
 * whether this is five minutes or an afternoon, and the old page answered that
 * by making them scroll to the bottom.
 */
function Progress({
  answered,
  total,
  outstanding,
  due,
}: {
  answered: number;
  total: number;
  outstanding: number;
  due: string | null;
}) {
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
  const pressing = due === "Overdue" || due === "Due today";

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold">
          {answered} of {total} answered
        </span>
        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {due ? (
            <span
              style={{ color: pressing ? "var(--danger-text)" : "var(--text-tertiary)" }}
            >
              {due}
            </span>
          ) : outstanding === 0 ? (
            "Nothing outstanding"
          ) : (
            `${outstanding} required`
          )}
        </span>
      </div>

      <div
        className="h-[6px] w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${answered} of ${total} questions answered`}
        style={{ background: "var(--surface-active)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}

/**
 * Where one question stands, down the left edge — the same tile every list row
 * in the portal leads with, at the size a form row can spare.
 */
function Mark({
  settled,
  wanted,
  filled,
}: {
  settled: boolean;
  wanted: boolean;
  filled: boolean;
}) {
  const tone = settled
    ? { background: "var(--success-bg)", color: "var(--success-fg)", glyph: "✓" }
    : wanted
      ? { background: "var(--warning-border)", color: "var(--warning-fg)", glyph: "!" }
      : filled
        ? { background: "var(--accent-tint)", color: "var(--accent)", glyph: "✓" }
        : { background: "var(--surface-active)", color: "var(--text-quiet)", glyph: "○" };

  const label = settled
    ? "Accepted"
    : wanted
      ? "Sent back"
      : filled
        ? "Answered"
        : "Not answered yet";

  return (
    <span
      title={label}
      className="mt-[2px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none"
      style={{ background: tone.background, color: tone.color }}
    >
      {tone.glyph}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * A form's questions in the order they were written, split wherever the
 * heading above them changes.
 *
 * Grouped in one pass rather than by collecting each distinct heading and
 * filtering for it: order is what the form was written in, and gathering by
 * heading would silently reorder a form whose sections interleave. Most forms
 * carry no heading at all and come back as a single untitled group, which is
 * exactly how they were drawn before headings existed.
 *
 * `sharedHelp` is the note every question in the group repeats, where there is
 * one. The Work Plan's client ask writes the same "Needed for: …" onto each
 * item it sends, so a section of eight uploads carried eight copies of one
 * sentence; it belongs to the section, and is drawn there instead.
 *
 * WHEN THE FORM HAS NO HEADINGS
 *
 * Most do not: the builder's heading is optional and the Work Plan's client
 * ask writes none at all, so the ordinary form arrived here as one untitled
 * group and was drawn as one unbroken column — fourteen questions and a
 * scrollbar, with no way to see the shape of what was being asked or to tell
 * "this is four uploads and two dates" from "this is fourteen essays".
 *
 * So a long headingless form is filed by what it is asking *for*, which is the
 * one grouping available without a human writing it: files to find and send,
 * decisions to make, and everything that is something to type. The order is the
 * order of the questions, so nothing moves relative to anything in its own
 * band. Short forms are left alone — three questions under two headings is
 * furniture, not structure.
 */
const KIND_ORDER = ["files", "decisions", "details"] as const;

const KIND_TITLES: Record<(typeof KIND_ORDER)[number], string> = {
  files: "Documents to send",
  decisions: "Decisions",
  details: "Details",
};

/** Under whose heading a question falls when the form gave it none. */
function kindOf(type: PortalFormField["type"]): (typeof KIND_ORDER)[number] {
  if (type === "file") return "files";
  if (type === "boolean" || type === "choice" || type === "checklist") return "decisions";
  return "details";
}

/** Below this, a form is short enough to read straight down. */
const GROUP_FROM = 5;

function sectionsOf(
  fields: PortalFormField[],
): {
  title: string | null;
  blurb: string | null;
  sharedHelp: string | null;
  fields: PortalFormField[];
}[] {
  const groups: {
    title: string | null;
    blurb: string | null;
    fields: PortalFormField[];
  }[] = [];

  const titled = fields.some((field) => field.section);
  if (!titled && fields.length >= GROUP_FROM) {
    const byKind = new Map<string, PortalFormField[]>();
    for (const field of fields) {
      const kind = kindOf(field.type);
      byKind.set(kind, [...(byKind.get(kind) ?? []), field]);
    }
    // One band holding everything is no grouping at all — a form of nine
    // uploads is nine uploads, and a heading over all of them says nothing.
    if (byKind.size > 1) {
      return KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
        title: KIND_TITLES[kind],
        blurb: null,
        sharedHelp: sharedHelpOf(byKind.get(kind)!),
        fields: byKind.get(kind)!,
      }));
    }
  }

  for (const field of fields) {
    const title = field.section ?? null;
    const open = groups[groups.length - 1];
    if (open && open.title === title) open.fields.push(field);
    // The blurb is taken from whichever field opened the section. Every field
    // in it carries the same one, and disagreement is not worth a rule.
    else groups.push({ title, blurb: field.sectionBlurb ?? null, fields: [field] });
  }

  return groups.map((group) => ({ ...group, sharedHelp: sharedHelpOf(group.fields) }));
}

/** The note every question in a group repeats, said once or not at all. */
function sharedHelpOf(fields: PortalFormField[]): string | null {
  const first = fields[0]?.help ?? null;
  return fields.length > 1 && first && fields.every((field) => field.help === first)
    ? first
    : null;
}

/**
 * One question, drawn as the type the Form Builder chose for it.
 *
 * The seven cases are `FIELD_TYPES` in `whitbyos/lib/form-vocab.ts`. They are
 * matched exhaustively rather than defaulted to a text box, because the whole
 * point of the builder offering a Yes/No and a checklist is that they are not
 * the same question as "type something here".
 *
 * Every one hides its own label: the row above has already drawn the question
 * at the size a question deserves, and a second, quieter copy of it directly
 * underneath was half of what made this page hard to read.
 */
function FormField({
  field,
  value,
  readOnly,
  settled = false,
}: {
  field: PortalFormField;
  value: string;
  readOnly: boolean;
  /** Accepted by the team: read-only, and said so rather than left blank. */
  settled?: boolean;
}) {
  if (field.type === "long") {
    return (
      <Textarea
        label={field.label}
        labelHidden
        name={field.key}
        defaultValue={value}
        placeholder={field.placeholder}
        required={field.required}
        readOnly={readOnly}
        rows={4}
      />
    );
  }

  if (field.type === "choice") {
    return (
      <Select
        label={field.label}
        labelHidden
        name={field.key}
        defaultValue={value}
        required={field.required}
        disabled={readOnly}
        placeholder="Select an option"
        options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
      />
    );
  }

  if (field.type === "checklist") {
    // Answers come back as one newline-joined string, so `responses` stays
    // Record<string, string> — see PortalForm.responses.
    const ticked = new Set(value.split("\n").filter(Boolean));
    return (
      <fieldset>
        <legend className="sr-only">{field.label}</legend>
        {/* Each option is a pressable row rather than a 13px box with a word
            beside it: on a phone the box alone is under the 44px a finger
            needs, and the label was not part of the target. */}
        <div className="grid gap-1.5">
          {(field.options ?? []).map((option) => (
            <label
              key={option}
              className={cn(
                "flex items-center gap-2.5 rounded-control border px-3 py-2 text-[14px] transition-colors",
                readOnly ? "cursor-default" : "cursor-pointer hover:bg-[var(--surface-active)]",
              )}
              style={{ background: "var(--surface)", borderColor: "var(--border-strong)" }}
            >
              <input
                type="checkbox"
                name={field.key}
                value={option}
                defaultChecked={ticked.has(option)}
                disabled={readOnly}
                className="h-[15px] w-[15px] shrink-0 accent-[var(--accent)]"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === "boolean") {
    // A tri-state select rather than a checkbox: an unticked box cannot say
    // whether the answer is No or whether nobody has answered yet, and a
    // required Yes/No has to be able to tell those apart.
    return (
      <Select
        label={field.label}
        labelHidden
        name={field.key}
        defaultValue={value}
        required={field.required}
        disabled={readOnly}
        placeholder="Select an answer"
        options={[
          { value: "Yes", label: "Yes" },
          { value: "No", label: "No" },
        ]}
      />
    );
  }

  if (field.type === "file") {
    // The upload's own millisecond prefix keeps two files of the same name
    // apart and is not worth showing anybody.
    const attached = value ? (value.split("/").pop() ?? value).replace(/^\d{10,}-/, "") : null;

    return (
      <div>
        {attached ? (
          <span
            className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-[12.5px]"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border-strong)",
              color: "var(--text-secondary)",
            }}
          >
            <span aria-hidden style={{ color: "var(--accent)" }}>
              ▥
            </span>
            <span className="min-w-0 truncate">{attached}</span>
          </span>
        ) : null}

        {readOnly ? null : (
          /* The native control, dressed. A styled label over a hidden input
             looks better still and then cannot say which file was chosen,
             because nothing here runs in the browser — and "no file chosen" is
             the one piece of feedback this control has to give. */
          <input
            type="file"
            name={`file:${field.key}`}
            aria-label={attached ? `Replace the file for ${field.label}` : field.label}
            className="w-full cursor-pointer rounded-control border border-dashed bg-[var(--surface-soft)] px-3 py-2.5 text-[12.5px] text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-tint-soft)] file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[var(--accent-tint)] file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-[var(--accent)]"
            style={{ borderColor: "var(--border-strong)" }}
          />
        )}

        <span className="mt-1.5 block text-[12px]" style={{ color: "var(--text-quiet)" }}>
          {settled
            ? "Your team has accepted this one. Nothing further is needed."
            : attached
              ? "Saved to your Documents. Choosing another file replaces it."
              : "A scan or a photo is fine. It is saved to your Documents and shared with your team."}
        </span>
      </div>
    );
  }

  return (
    <Input
      label={field.label}
      labelHidden
      name={field.key}
      type={field.type === "date" ? "date" : "text"}
      defaultValue={value}
      placeholder={field.placeholder}
      required={field.required}
      readOnly={readOnly}
    />
  );
}

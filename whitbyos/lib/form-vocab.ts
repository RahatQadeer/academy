/** Forms vocabulary, kept clear of the server module for the builder. */

/**
 * 11.1's Visibility, and the pill each one draws on the list.
 *
 * "Restricted" said nothing a reader could act on — restricted to whom? — and
 * meant nothing either: every workspace member could see one, exactly like an
 * internal form. It is "Only me" now, and whitbyos/082 gave the row a creator
 * so that is true rather than merely said.
 *
 * The stored value stays `restricted`. It is in the client-side policy, in
 * three other tables' visibility columns, and in the SRS; renaming a label is
 * not a reason to migrate a word people have written down elsewhere.
 */
export const FORM_VISIBILITY = [
  { value: "internal", label: "Internal", tone: "neutral" as const },
  { value: "client_visible", label: "Client Visible", tone: "info" as const },
  { value: "restricted", label: "Only me", tone: "warning" as const },
];

export function visibilityLabel(value: string | null) {
  return FORM_VISIBILITY.find((row) => row.value === value)?.label ?? "Internal";
}

export function visibilityTone(value: string | null) {
  return FORM_VISIBILITY.find((row) => row.value === value)?.tone ?? "neutral";
}

/** The builder's Field Types panel, verbatim. */
export const FIELD_TYPES = [
  { value: "short", label: "Short answer" },
  { value: "long", label: "Long answer" },
  { value: "choice", label: "Multiple choice" },
  { value: "checklist", label: "Checklist" },
  { value: "date", label: "Date" },
  { value: "file", label: "File upload" },
  { value: "boolean", label: "Yes/No" },
];

export function fieldTypeLabel(value: string) {
  return FIELD_TYPES.find((row) => row.value === value)?.label ?? "Short answer";
}

export const FORM_CATEGORIES = ["Onboarding", "Providers", "Confirmations", "Travel", "Other"];

/**
 * A submission's states, in the order 11.2 lists them. Text rather than an
 * enum in the schema, so this is the vocabulary the product agrees on.
 */
/**
 * 11.2's six, and their colours are the point of the column: at a glance it
 * says which rows are waiting on somebody and which are waiting on you.
 *
 * Three of these were wrong. "Awaiting Response" was neutral, so the most
 * common state on the screen read as no state at all — grey text where the
 * reference draws amber. "Submitted" took the darker blue the Requests table
 * uses for Running rather than the accent blue this screen draws. And "Needs
 * Review" shared a colour with "Correction Required", collapsing the two states
 * the screen exists to tell apart.
 */
export const SUBMISSION_STATUS: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" | "review" | "accent" | "neutral" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  awaiting: { label: "Awaiting Response", tone: "warning" },
  submitted: { label: "Submitted", tone: "accent" },
  needs_review: { label: "Needs Review", tone: "review" },
  accepted: { label: "Accepted", tone: "success" },
  correction_required: { label: "Correction Required", tone: "danger" },
};

export function submissionLabel(value: string | null) {
  return SUBMISSION_STATUS[value ?? "draft"]?.label ?? "Draft";
}

export function submissionTone(value: string | null) {
  return SUBMISSION_STATUS[value ?? "draft"]?.tone ?? "neutral";
}

export type FormField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  /**
   * A heading this field sits under, repeated on every field that belongs to
   * it. Optional, and absent on everything the builder writes: a form of six
   * questions needs no headings, and inventing one would put a title above a
   * list that is already obvious.
   *
   * A Work Plan's client ask does need them. It sends documents to upload,
   * details to type and decisions to make in one message, and those are three
   * different kinds of work — a client who has to tell them apart by reading
   * each question is a client who answers half of them.
   */
  section?: string;
  /**
   * One line under the section's heading, repeated on its fields the same way
   * `section` is. Answers the question a heading raises and a list of labels
   * does not: what counts as an acceptable answer.
   */
  sectionBlurb?: string;
  /** Why this is being asked, under the question. Nothing where it is plain. */
  help?: string;
};

/** `fields` is jsonb, so its shape is ours; this is what the builder writes. */
export function readFields(fields: unknown): FormField[] {
  if (!Array.isArray(fields)) return [];

  return fields.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    if (typeof row.label !== "string") return [];

    return [
      {
        id: typeof row.id === "string" ? row.id : `field-${index}`,
        label: row.label,
        type: typeof row.type === "string" ? row.type : "short",
        required: row.required === true,
        options: Array.isArray(row.options)
          ? row.options.filter((option): option is string => typeof option === "string")
          : undefined,
        section: typeof row.section === "string" && row.section ? row.section : undefined,
        sectionBlurb:
          typeof row.sectionBlurb === "string" && row.sectionBlurb
            ? row.sectionBlurb
            : undefined,
        help: typeof row.help === "string" && row.help ? row.help : undefined,
      },
    ];
  });
}

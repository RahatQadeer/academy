/**
 * What comes back from the proposal drafter, and the rules re-applied to it.
 *
 * Stricter than the other two guards in this folder, because this is the only
 * generated text in the product that a client reads. The plan's drafts stay
 * inside the firm and a bad one wastes a professional's minute. A bad
 * suggestion goes out under the firm's name.
 *
 * Kept free of `@/` imports so the tests can load it.
 */

export type DraftedProposal = {
  /** The need it answers, echoed back verbatim so the caller can match it. */
  label: string;
  /** The suggestion itself, as the client will see it. */
  text: string;
};

/** Long enough for a menu or a running order, short enough to read on a phone. */
const TEXT_CHARS = 1200;
const LABEL_CHARS = 120;

/**
 * Openers that turn a suggestion into a covering letter.
 *
 * The text lands in a form field under the question it answers, so anything
 * addressed to the reader is the model writing the wrong artefact. Matched at
 * the start of the whole text only: "Here" is a normal word in the middle of
 * a sentence.
 */
const PREAMBLE =
  /^(dear\b|hi\b|hello\b|here('s| is)\b|below (is|you)|i('ve| have) (drafted|put|prepared)|we('ve| have) (drafted|put|prepared)|please find\b|as requested\b|based on\b|thank you\b)[^\n.]*[.:\n]\s*/i;

/**
 * The question, written out again instead of answered.
 *
 * The labels on a checklist name approvals: "Family approval of the running
 * order", "Family selection of the menu option". Asked to draft one of those
 * the model writes about the approval, and what comes back is the blank box
 * this feature replaces with more words in it: "Not yet chosen. What is
 * needed: which menu option the family wants."
 *
 * The prompt now says not to. This is the same rule where it holds. Dropped
 * rather than trimmed, because there is nothing under the restatement to
 * keep: an empty box is honest, and a paragraph explaining that the box is
 * empty is not.
 */
const RESTATEMENT = [
  /^not yet\b/i,
  /^none (yet|so far)\b/i,
  /^to be (confirmed|decided|agreed|set|chosen)\b/i,
  /^nothing (has been|is) (set|chosen|decided|agreed)\b/i,
  /^what (is|we) need(ed|s)?\s*:/im,
  /^this (is|has) (not|yet)\b/i,
  /*
   * The restatement hiding inside a blank.
   *
   * A blank already says the client fills it, so "[date to be confirmed]" is
   * the word "confirmed" doing nothing twice. It turned up on a plan whose
   * date was on the form, which made it wrong as well as redundant. Matched
   * anywhere, because it arrives mid-draft rather than at the start.
   */
  /\[[^\]]*\bto be (confirmed|decided|agreed|advised|set)\b[^\]]*\]/i,
  /*
   * The firm's own filing language, quoted back at the client.
   *
   * The prompt tells the model the deadline so it stops asking for one, and
   * the first thing it did was repeat the sentence into a box the client
   * reads: "Date: [date] (the work is due 2027-03-28)". Whatever the prompt
   * says about a date, this is where saying it must not end up.
   */
  /\bthe work is due\b/i,
  /\b(deadline|due date) (is|of)\b/i,
];

/** The same dash rule the rest of the product follows. */
function plainDashes(text: string) {
  return text.replace(/\s*[—–]\s*/g, ", ");
}

function trimTo(text: string, most: number) {
  const clean = text.trim();
  if (clean.length <= most) return clean;

  const cut = clean.slice(0, most);
  const stop = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
  return (stop > most * 0.5 ? cut.slice(0, stop + 1) : cut).trimEnd();
}

/**
 * One suggestion, cleaned.
 *
 * Returns null where nothing usable is left. A blank proposal must never be
 * stored: the ask would go out with an empty box that the client has been
 * told is a suggestion, which is worse than the blank box it replaced.
 */
function one(row: Partial<DraftedProposal> | null | undefined): DraftedProposal | null {
  if (!row) return null;

  const label =
    typeof row.label === "string" ? trimTo(row.label.replace(/\s+/g, " "), LABEL_CHARS) : "";
  if (!label) return null;

  let text = typeof row.text === "string" ? plainDashes(row.text) : "";

  /* Strip a covering-letter opener, once. Twice would eat a first line that
     legitimately begins "Based on" in a document about something else. */
  text = text.replace(PREAMBLE, "");

  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  text = trimTo(text, TEXT_CHARS);

  /* A one-word answer is the model restating the label. Nothing usable. */
  if (text.length < 12) return null;

  /* A longer restatement is the same failure with more words. */
  if (RESTATEMENT.some((pattern) => pattern.test(text))) return null;

  return { label, text };
}

/**
 * Everything usable that came back, one per need.
 *
 * `slugOf` is passed in rather than imported so this file keeps no `@/`
 * imports; the caller hands it `needSlug`, which is what decides that two
 * spellings of the same label are the same need everywhere else.
 */
export function tidy(
  rows: Partial<DraftedProposal>[] | null | undefined,
  slugOf: (label: string) => string,
): DraftedProposal[] {
  const out: DraftedProposal[] = [];
  const seen = new Set<string>();

  for (const row of Array.isArray(rows) ? rows : []) {
    const clean = one(row);
    if (!clean) continue;

    const slug = slugOf(clean.label);
    /* A label that slugs to nothing cannot be matched to a need, so it cannot
       be stored against one. Dropped rather than guessed at. */
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    out.push(clean);
  }

  return out;
}

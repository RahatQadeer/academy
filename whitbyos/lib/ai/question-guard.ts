import type { DraftedQuestion } from "./draft-questions.ts";

/**
 * The guard between the model and the screen.
 *
 * Its own module because it is pure and the drafter beside it is not: this
 * can be run by `node --test` without a network, an API key or the path
 * aliases, and every rule in here was written after the model broke it
 * once. See `draft-questions.test.ts`.
 */

/** Guardrails the model is asked for and does not always honour. */
const MOST = 4;
const MOST_OPTIONS = 4;

/**
 * Anything that reads as a question about work in general rather than about
 * this work. The prompt says not to; these are the ones it still reaches for
 * when a description is short, and a short description is exactly when a
 * generic question is least useful.
 */
const GENERIC = [
  /^what (is|'s) the budget\b/i,
  /^who (is|'s) the (main |primary )?(point of )?contact\b/i,
  /^what (is|'s) the deadline\b/i,
  /^is there a deadline\b/i,
  /^what (is|'s) the timeline\b/i,
  /^any other (details|information)\b/i,
  /^anything else\b/i,
];

/**
 * Words that mean "when".
 *
 * Used only where the professional has already given a date on the form
 * before this one. The prompt says not to ask about a settled deadline and
 * the model obeys the letter of it: told the date, it stops asking what the
 * date is and starts asking whether the date is fixed, whether it is
 * flexible, whether it might move. That is the same interruption. Somebody
 * has just typed a date into a date picker and the next screen is asking
 * them about that date.
 *
 * Matched anywhere in the question rather than at the start, because this
 * one arrives wrapped in the work: "Is the wedding date fixed to a specific
 * day at the end of March, or is it still flexible?"
 */
const ABOUT_WHEN = [
  /\bdate\b/i,
  /\bdeadline\b/i,
  /\btimeline\b/i,
  /\bwhen (is|are|will|does|do|should|must)\b/i,
  /\bhow (soon|quickly)\b/i,
  /\b(start|finish|complete|arrive|arriving|due) by\b/i,
];

/**
 * What survives from the model's answer.
 *
 * Every rule here is one the prompt already states. They are enforced again
 * because the cost of a bad question is not a bad question: it is somebody
 * deciding this screen is noise, and skipping it forever on work where it
 * would have mattered.
 */
export function tidy(
  rows: DraftedQuestion[] | undefined,
  /**
   * Whether a deadline was given on the step before this one.
   *
   * Absent means none was, and then a question about timing is a fair
   * question: the plan genuinely does not know when any of this is due.
   */
  opts?: { hasTargetDate?: boolean },
): DraftedQuestion[] {
  const seen = new Set<string>();
  const kept: DraftedQuestion[] = [];

  for (const row of rows ?? []) {
    const question = plain(row?.question);
    if (!question) continue;

    // The same thing asked twice, once with different words.
    const key = question.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    if (!key || seen.has(key)) continue;

    if (GENERIC.some((pattern) => pattern.test(question))) continue;

    /* The date is on the form they just filled in. Whatever this question
       wants to know about it, the answer they would give is the one already
       recorded, and the plan schedules against the field rather than the
       answer anyway. */
    if (opts?.hasTargetDate && ABOUT_WHEN.some((pattern) => pattern.test(question))) {
      continue;
    }

    const options = (row.options ?? [])
      .map((option) => plain(option))
      .filter((option): option is string => Boolean(option))
      .slice(0, MOST_OPTIONS);

    seen.add(key);
    kept.push({
      question: question.endsWith("?") ? question : `${question}?`,
      why: plain(row.why) || null,
      /* One option is not a choice, it is a suggestion wearing a chip. */
      options: options.length > 1 ? options : null,
    });

    if (kept.length === MOST) break;
  }

  return kept;
}

/** The dashes the house style does not use, and the stray whitespace. */
function plain(value: string | null | undefined) {
  return (value ?? "").replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim();
}

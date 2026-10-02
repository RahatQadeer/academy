/**
 * The shape of Whitby's first draft, and the rules re-applied after the model.
 *
 * The prompt asks for a short, honest piece of internal work. Prompts do not
 * hold: the same lesson the plan drafter and the question drafter both learned,
 * which is why `tidy()` exists in all three. What the model returns is trimmed
 * here, by code, before anything is written to a task.
 *
 * Kept free of `@/` imports so the tests can load it. Node's type stripping
 * resolves relative paths and nothing else, and everything real in this file is
 * a pure function over its argument, so there is nothing to mock.
 */

/** One part of the draft: a heading and the material under it. */
export type DraftSection = {
  heading: string;
  body: string;
};

export type AutoDraft = {
  /**
   * One line saying what this is, read before the draft is opened.
   *
   * The plan's summary panel shows only this, one row per task. A summary
   * that restates the task title tells the professional nothing they did not
   * have; it has to say what now exists that did not before.
   */
  summary: string;
  sections: DraftSection[];
  /**
   * What Whitby could not work out, and a person has to supply.
   *
   * The most important field here. A draft that quietly guesses is worse
   * than no draft, because it looks finished. Everything the model did not
   * actually know belongs in this list instead of in the body, and the task
   * stays open precisely because these are outstanding.
   */
  openPoints: string[];
};

/**
 * More than this and it stops being a first pass and becomes a document.
 *
 * Six, then three. The brief is that a draft nobody reads has done nothing,
 * and six headings is already a contents page. Three is what fits in the ten
 * lines this is now held to.
 */
export const MOST_SECTIONS = 3;
/** Beyond this the list of unknowns is itself the work. */
export const MOST_OPEN_POINTS = 5;
/*
 * Room for a working document.
 *
 * These were set at 160, 900 and 180, which is a note rather than a draft,
 * and the first real one was cut in three places: a summary ending "once the
 * wedding date, guest", a section ending "Do not record a price", and an
 * open point ending "since this changes which venues are worth". Whitby had
 * written all three properly. The guard took the ends off.
 *
 * The caps exist to stop a draft becoming a document nobody reads, and that
 * is still worth having. They were simply too tight for the thing being
 * drafted: a venue comparison with thirteen fields in it is long because the
 * work is, and a draft that stops mid sentence reads as broken rather than
 * as brief.
 */
const SUMMARY_CHARS = 220;
const HEADING_CHARS = 70;
const BODY_CHARS = 600;
const POINT_CHARS = 260;

/**
 * The whole draft, across every section.
 *
 * About ten lines. This is the limit that matters, because somebody opening
 * a task reads the draft or they do not, and the first one measured ran to
 * 9,169 characters and fifty-eight lines over forty rows of school names.
 *
 * Twelve hundred characters is roughly ten lines of ordinary text. The point
 * is not the number, it is that the whole thing can be read in a glance and
 * decided on; anything that genuinely needs more room is the task itself,
 * not its first pass.
 */
const DRAFT_CHARS = 1200;

/**
 * Lines that are mostly a blank waiting to be filled.
 *
 * "Beaver Road Primary School, [address verify], admissions contact
 * [verify], deadline [verify], distance [blank], car time [blank]" is one
 * fact and five placeholders. Forty of them is a long draft carrying almost
 * nothing, which is the failure this catches: not length on its own, but
 * length made of blanks.
 *
 * A few are useful, because a marked blank is how a draft leaves room. Past
 * that they are padding, and the draft says so rather than printing them.
 * Four, not eight: at ten lines for the whole draft, eight rows of blanks
 * would be the whole draft.
 */
const MOST_PLACEHOLDER_LINES = 4;

function placeholderHeavy(line: string) {
  const blanks = line.match(/\[[^\]]*\]/g);
  if (!blanks || blanks.length < 3) return false;
  return blanks.join("").length > line.length * 0.4;
}

/**
 * Trim to a length without cutting a word in half.
 *
 * Falls back to a hard cut where there is no space to break at, which is what
 * a single very long token is.
 */
function trimTo(text: string, most: number) {
  const clean = text.trim();
  if (clean.length <= most) return clean;

  const cut = clean.slice(0, most);
  const space = cut.lastIndexOf(" ");
  return (space > most * 0.6 ? cut.slice(0, space) : cut).trimEnd();
}

/**
 * Dashes the product does not use.
 *
 * Em and en dashes are forbidden in the prompt and they come back anyway. They
 * are replaced rather than deleted: a dash is doing a job in the sentence, and
 * removing it joins two clauses into nonsense.
 */
function plainDashes(text: string) {
  return text.replace(/\s*[—–]\s*/g, ", ");
}

function clean(text: unknown, most: number) {
  if (typeof text !== "string") return "";
  return trimTo(plainDashes(text).replace(/\s+/g, " "), most);
}

/**
 * The body keeps its line breaks.
 *
 * A drafted checklist is a list, and collapsing its whitespace turns it into
 * one paragraph of numbered fragments. Runs of blank lines collapse to one so
 * the model cannot pad the draft into looking longer than it is.
 */
function cleanBody(text: unknown) {
  if (typeof text !== "string") return "";

  const lines = plainDashes(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd());

  const kept: string[] = [];
  let blanks = 0;
  let dropped = 0;

  for (const line of lines) {
    if (!placeholderHeavy(line)) {
      kept.push(line);
      continue;
    }

    blanks += 1;
    if (blanks <= MOST_PLACEHOLDER_LINES) kept.push(line);
    else dropped += 1;
  }

  if (dropped > 0) {
    kept.push(
      `(${dropped} more rows like these were left out. Fill the ones above first, then add the rest.)`,
    );
  }

  return trimTo(kept.join("\n"), BODY_CHARS);
}

/**
 * What survives of what the model returned.
 *
 * Returns null where nothing usable came back. A draft with no sections is not
 * a short draft, it is a failure that would otherwise be written to the task
 * and shown as work Whitby did.
 */
export function tidy(draft: Partial<AutoDraft> | null | undefined): AutoDraft | null {
  if (!draft) return null;

  const sections: DraftSection[] = [];
  const seen = new Set<string>();

  for (const row of Array.isArray(draft.sections) ? draft.sections : []) {
    if (sections.length >= MOST_SECTIONS) break;

    const heading = clean(row?.heading, HEADING_CHARS);
    const body = cleanBody(row?.body);
    /* A heading with nothing under it is the model announcing a section it
       did not write. Both halves or neither. */
    if (!heading || !body) continue;

    const key = heading.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    sections.push({ heading, body });
  }

  if (sections.length === 0) return null;

  const openPoints: string[] = [];
  const saidAlready = new Set<string>();

  for (const row of Array.isArray(draft.openPoints) ? draft.openPoints : []) {
    if (openPoints.length >= MOST_OPEN_POINTS) break;

    const point = clean(row, POINT_CHARS);
    if (!point) continue;

    const key = point.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    if (saidAlready.has(key)) continue;
    saidAlready.add(key);

    openPoints.push(point);
  }

  /* Falls back to the first heading rather than to the task title, which the
     row already shows: a summary that repeats the line above it is a wasted
     line on a panel whose whole job is to be skimmed. */
  const summary = clean(draft.summary, SUMMARY_CHARS) || sections[0].heading;

  /*
   * The whole thing, not each part.
   *
   * Sections are capped one at a time, so six long ones still add up to a
   * document. Whole sections go from the end rather than a section being cut
   * in half: half a section is the mid-sentence stop this guard already got
   * wrong once, and the first section is the one the professional reads.
   */
  const fitted: DraftSection[] = [];
  let used = 0;

  for (const part of sections) {
    const size = part.heading.length + part.body.length;
    if (fitted.length > 0 && used + size > DRAFT_CHARS) break;

    fitted.push(part);
    used += size;
  }

  return { summary, sections: fitted, openPoints };
}

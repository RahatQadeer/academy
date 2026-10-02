/**
 * Text that leaves the firm's own screens, with the product's name taken out.
 *
 * SRS §1.4: what a client sees is the firm's, never Whitby's — the portal is
 * "[Company Name] Client Portal" and nothing in it names the software. A
 * Playbook is where that rule is easiest to break by accident: its Work
 * Streams are written by the drafter or copied off a plan the drafter wrote,
 * and a purpose that begins "Whitby will confirm…" carries the name into
 * every plan made from that Playbook afterwards, and from there into the
 * client's own copy.
 *
 * So a Playbook is scrubbed as it is written rather than as it is read: one
 * pass at the moment of conversion, on text nobody has to look at again.
 *
 * Only the product name goes. This is not a censor — it does not touch a
 * person called Whitby, because it only matches the word where the sentence
 * is using it as the thing doing the work, and anything it is unsure of it
 * leaves alone.
 */

/** "Whitby will draft" → "we will draft"; "Ask Whitby to" → "ask us to". */
const PHRASES: { find: RegExp; put: string }[] = [
  // The name as the actor, with a modal after it: "Whitby will confirm".
  { find: /\bWhitby\s+(will|can|may|should|must|would)\b/gi, put: "we $1" },
  // Being asked to do something: "Ask Whitby to redo it".
  { find: /\b(ask|tell|get)\s+Whitby\s+to\b/gi, put: "$1 us to" },
  // Possessive: "Whitby's own check".
  { find: /\bWhitby['’]s\b/gi, put: "our" },
  // Where it is drafted or held: "in Whitby", "from Whitby".
  { find: /\b(in|on|from|by|with|via)\s+Whitby\b/gi, put: "$1 the workspace" },
];

/**
 * The same sentence without the product in it.
 *
 * Left-over mentions — a bare "Whitby" the phrases above do not fit — become
 * "we", which is what a firm calls itself to its own client and reads as
 * written by a person rather than by software.
 */
export function unbranded(text: string): string;
export function unbranded(text: string | null | undefined): string | null;
export function unbranded(text: string | null | undefined): string | null {
  if (text === null || text === undefined) return null;
  if (!text.includes("Whitby") && !text.includes("whitby")) return text;

  let out = text;
  for (const { find, put } of PHRASES) out = out.replace(find, put);

  /*
   * "Whitby drafts" is "we draft", not "we drafts".
   *
   * One name doing the work becomes a firm doing it, and the verb has to
   * agree or the sentence reads as written by a machine — which is the whole
   * thing this is here to avoid.
   */
  out = out.replace(
    /\bWhitby\s+([a-z]+s)\b/gi,
    (whole: string, verb: string) =>
      verb.endsWith("ses") || verb.endsWith("hes")
        ? `we ${verb.slice(0, -2)}`
        : verb.endsWith("s") && !verb.endsWith("ss")
          ? `we ${verb.slice(0, -1)}`
          : whole,
  );

  /* Whatever is left of the name, and then the seam it leaves: a sentence
     that began "Whitby drafted" becomes "we drafted", and one that began
     "Whitby" alone becomes "We" if it is starting the sentence. */
  out = out.replace(/\bWhitby\b/g, "we").replace(/\bwhitby\b/g, "we");
  out = out.replace(/(^|[.!?]\s+)we\b/g, (_, before: string) => `${before}We`);

  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Academy lesson content design system.
 * Single source of truth for Whitby/catalog generation AND learner rendering conventions.
 * Every generated course must follow this so lessons stay scannable, interactive, and tidy.
 */

import { EXERCISE_FORMAT_RULES } from "@/academy/lib/lessonExercise";

/** Master instructions injected into Whitby + catalog pipeline prompts. */
export const LESSON_CONTENT_DESIGN_SYSTEM = `ACADEMY LESSON CONTENT DESIGN (non-negotiable — every lesson must follow this):

GOAL: Learners enjoy reading. Content must feel structured and interactive — never a wall of text, never messy, never endless blocks of unstyled prose.

STRUCTURE — always mark each piece clearly:
1. HEADINGS — every section title on its own line as ## Title (or ### Subtitle). Always put a space after the hashes. Never wrap headings in **bold**. Never write **## Title** or ##Title. Never leave raw # characters visible in body text — learners should see a styled heading, not hashes.
2. DEFINITIONS — the LMS renders each Definition as a **professional Definition card** (accent header, bold term name, separate explanation body). You MUST emit the markdown shape below so the card UI appears — never leave terms as plain "Definition — …" prose in a wall of text.
   Exact shape (two lines minimum — short NAME on line 1 after the label, meaning on the next line(s)):
   Definition — JDK
   The Java Development Kit: the compiler (javac), tools, and libraries needed to write and build Java programs.

   Rules:
   - After "Definition —" put ONLY the short term/name (2–6 words). Do not paste the explanation onto that same line.
   - Put the explanation on the following line(s). Do not repeat the term as the whole meaning.
   - Prefer one card per key term when introducing toolkit concepts (e.g. JDK then JRE as two separate cards).
   - Bold the term on first use in surrounding prose with **Term**, but inside a Definition block the name line is enough.
   - Never write "Definition — TermMeaning…" mashed on one line — that breaks the card.
   Correct:
   Definition — Network failure surface
   The count of synchronous hops where a request can fail before the user sees an error.
   Wrong (name missing / mashed into the meaning):
   Definition — Network failure surfaceThe count of synchronous hops…
   Wrong (same text twice):
   Definition — The count of synchronous hops…
   The count of synchronous hops…
   Wrong (label used as the name):
   Definition — Definition
   The count of synchronous hops…
   Wrong (plain paragraph pretending to be a definition):
   The JDK is the Java Development Kit…
   (Must use the Definition — Name / meaning shape so the card renders.)
3. SCENARIOS — use this exact shape (never squash into one unlabeled paragraph):
   Scenario — Short title
   <2–4 sentence situation>
   Decision: <the question for the learner>
   Recommended answer: <teaching explanation>
   The UI shows a Scenario card; Recommended answer stays hidden until the learner reveals it.
4. QUESTIONS — put every learner-facing question on its own line so it renders bold and separate from the answer:
   ## What Is a Linked List?
   OR
   What Is a Linked List?
   OR
   **Question:** What is a linked list?
   Then put the explanation in the next paragraph — never leave the question in the same weight as body text.
5. TABLES — real multiline markdown tables (one row per line) with a header row and | --- | separator. Never jam an entire table onto one line. Rubrics and success criteria must use this table shape.
6. CODE — fenced blocks with a language tag (\`\`\`js, \`\`\`python, \`\`\`sql, \`\`\`bash, …). Learners see a VS Code–style editor. Prefer short focused snippets (≤20 lines).
7. CALLOUTS — one marker, then a plain sentence. The UI draws the box and the label. Never wrap the sentence in square brackets. Never nest one callout inside another.
   Correct: [Important] A test report is a set of constraints, not a pass/fail document.
   Correct: [Tip] Pre-shrink the yardage before you cut on the bias.
   Wrong: [Important: A test report is a set of constraints.]
   Wrong: [info] [Important: A test report …]
   Wrong: [A test report is a set of constraints.]
8. LISTS — short bullets for steps or takeaways; never a 20-item dump.
9. EXERCISES — one interactive drag-and-drop fill-in per reading/scenario/resource/video lesson:
${EXERCISE_FORMAT_RULES}
   Never print the exercise solution in the paragraph below the fence. Learners reveal it with Show answer.

READABILITY BUDGET:
- Prefer 2–4 sentence paragraphs.
- Insert a ## heading about every 120–200 words.
- Focused ≠ short. Teach one idea per section, but teach it fully: mechanism, example, mistake, and practice. Cut filler, never cut depth.
- Bold (**term**) key terms on first use only — never use #term# or bare # for emphasis.
- Never invent "undefined" / "null" / "TBD" placeholders.
- Never put the correct quiz answer inside questionText; never put model solutions in assignment briefs.
- Never spoil interactive exercises or quizzes in surrounding prose.

UI BEAUTY (when generating or when the instructor asks to polish / beautify / make nicer):
- Prefer structured blocks the LMS styles as cards: Definition —, Scenario —, Example —, Summary —, [Tip]/[Important] callouts, ## headings, short lists, and fenced code — not undifferentiated paragraph walls.
- When the instructor says "make it beautiful / nicer / more professional / prettier / improve the UI / format definitions as cards / style the course / put scenarios in boxes / format code / fix formatting but don't change content", convert plain prose into the shapes above, split mashed terms, add headings, and use callouts for tips — without inventing new facts.
- Style-only requests: preserve meaning and facts; only change markdown structure so cards render.

10. LEARNING OBJECTIVES — put measurable outcomes in the lesson learningObjectives array (JSON field), not only in body prose. Body may also use:
   ## Learning objectives
   - Outcome one
   - Outcome two
11. EXAMPLE — worked examples as cards (not unlabeled paragraphs):
   Example — Compiling Hello.java
   Walk through the command, expected output, and what it proves.
12. SUMMARY — end-of-section wrap-up:
   Summary — What you can do now
   - Point one
   - Point two
13. STEPS — numbered markdown lists (1. 2. 3.) under a ## Steps heading when teaching a procedure.
14. COMPARISON — use a real markdown table (JDK vs JRE, etc.), never a run-on sentence.`;

export type ParsedScenario = {
  title: string;
  situation: string;
  decision: string;
  answer: string;
};

export type ParsedDefinition = {
  term: string;
  meaning: string;
};

const SCENARIO_HEAD =
  /^(?:\*\*)?(scenario|example)(?:\*\*)?\s*[:：—–-]\s*([\s\S]+)$/i;

const EMBEDDED_SCENARIO =
  /\b(?:\*\*)?(Scenario|Example)(?:\*\*)?\s*[:：—–-]\s*([\s\S]+)$/i;

/** Pull Scenario / Decision / Recommended answer from a free-form paragraph. */
export function tryParseScenarioParagraph(text: string): ParsedScenario | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let payload = "";
  let title = "Applied scenario";

  const head = trimmed.match(SCENARIO_HEAD);
  if (head) {
    payload = head[2].trim();
  } else {
    const embedded = trimmed.match(EMBEDDED_SCENARIO);
    if (!embedded) return null;
    if (!/\bDecision\s*:/i.test(embedded[0]) && !/\bRecommended answer\s*:/i.test(embedded[0])) {
      return null;
    }
    payload = embedded[0].replace(/^(?:\*\*)?(Scenario|Example)(?:\*\*)?\s*[:：—–-]\s*/i, "").trim();
  }

  if (!payload) return null;

  // Optional short title before Decision on its own first sentence line
  const answerParts = payload.split(/\bRecommended answer\s*:\s*/i);
  const beforeAnswer = (answerParts[0] ?? "").trim();
  const answer = (answerParts[1] ?? "").trim();

  const decisionParts = beforeAnswer.split(/\bDecision\s*:\s*/i);
  let situation = (decisionParts[0] ?? "").trim();
  const decision = (decisionParts[1] ?? "").trim();

  // "Scenario — Title" style already stripped; if situation is a short title-only line + rest
  const titleBreak = situation.match(/^([^\n.!?]{3,80})\n+([\s\S]+)$/);
  if (titleBreak && !decision) {
    title = titleBreak[1].trim();
    situation = titleBreak[2].trim();
  } else if (
    situation.length < 80 &&
    !/[.!?]$/.test(situation) &&
    decision &&
    !situation.toLowerCase().startsWith("you ")
  ) {
    title = situation;
    situation = "";
  }

  if (!situation && !decision && !answer) return null;

  return { title, situation, decision, answer };
}

const DEFINITION_LABEL =
  /^(?:\*\*)?(definition|key term|term)(?:\*\*)?\s*[:：—–-]\s*/i;

/** True when a line is a Definition card lead (optionally ATX / bold wrapped). */
export function isDefinitionLeadLine(line: string): boolean {
  const text = line
    .trim()
    .replace(/^\*\*\s*/, "")
    .replace(/\s*\*\*$/, "")
    .replace(/^#{1,6}\s*/, "")
    .trim();
  if (!text) return false;
  return DEFINITION_LABEL.test(text);
}

/** Pull Definition cards from a paragraph. */
export function tryParseDefinitionParagraph(text: string): ParsedDefinition | null {
  const trimmed = text
    .trim()
    .replace(/^\*\*\s*/, "")
    .replace(/\s*\*\*$/, "")
    .replace(/^#{1,6}\s*/, "")
    .trim();
  if (!trimmed) return null;
  if (!DEFINITION_LABEL.test(trimmed)) return null;

  const withoutLabel = trimmed.replace(DEFINITION_LABEL, "").trim();
  if (!withoutLabel) return null;

  return splitDefinitionTermAndMeaning(withoutLabel);
}

/**
 * Split term + meaning after the Definition label is stripped.
 * Never returns the same string for both fields.
 */
export function splitDefinitionTermAndMeaning(raw: string): ParsedDefinition | null {
  const withoutLabel = raw.trim();
  if (!withoutLabel) return null;

  const multiline = withoutLabel.match(/^([^\n]{1,120})\n+([\s\S]+)$/);
  if (multiline) {
    const term = cleanDefinitionTerm(multiline[1]);
    const meaning = stripLeadingTerm(multiline[2].trim(), term);
    if (isUsableDefinitionPair(term, meaning)) return { term, meaning };
  }

  const shaped = withoutLabel.match(
    /^(?:\*\*)?([^*\n:：—–-]{1,80}?)(?:\*\*)?\s*[:：—–-]\s*([\s\S]+)$/,
  );
  if (shaped) {
    const term = cleanDefinitionTerm(shaped[1]);
    const meaning = stripLeadingTerm(shaped[2].trim(), term);
    if (isUsableDefinitionPair(term, meaning)) return { term, meaning };
  }

  const boldTerm = withoutLabel.match(/^\*\*([^*]+)\*\*\s*[:—–-]?\s*([\s\S]+)$/);
  if (boldTerm) {
    const term = cleanDefinitionTerm(boldTerm[1]);
    const meaning = stripLeadingTerm(boldTerm[2].trim(), term);
    if (isUsableDefinitionPair(term, meaning)) return { term, meaning };
  }

  // Missing separator: "Deployment complexityThe number…"
  const runOn = withoutLabel.match(
    /^((?:[A-Z][\w'/&-]*)(?:\s+[a-z][\w'/&-]*){0,5})([A-Z][\s\S]{8,})$/,
  );
  if (runOn) {
    const term = cleanDefinitionTerm(runOn[1]);
    const meaning = runOn[2].trim();
    if (isUsableDefinitionPair(term, meaning)) return { term, meaning };
  }

  const copula = withoutLabel.match(
    /^(?:The\s+)?([A-Z][\w /&'’-]{0,70}?)\s+(?:is|are|means|refers to)\b([\s\S]+)$/,
  );
  if (copula) {
    const term = cleanDefinitionTerm(copula[1]);
    const meaning = withoutLabel.trim();
    if (isUsableDefinitionPair(term, meaning)) return { term, meaning };
  }

  const firstLine = withoutLabel.split("\n")[0]?.trim() ?? "";
  if (
    firstLine &&
    firstLine.length <= 80 &&
    !/[.!?]$/.test(firstLine) &&
    withoutLabel.includes("\n")
  ) {
    const term = cleanDefinitionTerm(firstLine);
    const meaning = stripLeadingTerm(withoutLabel.slice(firstLine.length).trim(), term);
    if (isUsableDefinitionPair(term, meaning)) return { term, meaning };
  }

  // Keep the Definition card — never drop styling because the model mashed fields.
  const fallbackTerm =
    cleanDefinitionTerm(
      withoutLabel.match(/^((?:[A-Z][\w'/&-]*)(?:\s+[a-z][\w'/&-]*){0,5})/)?.[1] ?? "",
    ) ||
    cleanDefinitionTerm(firstLine).split(/\s+/).slice(0, 4).join(" ") ||
    "Term";
  const fallbackMeaning = stripLeadingTerm(withoutLabel, fallbackTerm) || withoutLabel;
  if (fallbackTerm && fallbackMeaning && isUsableDefinitionPair(fallbackTerm, fallbackMeaning)) {
    return { term: fallbackTerm, meaning: fallbackMeaning };
  }

  return null;
}

/** Rewrite Definition blocks in lesson markdown into the canonical two-line shape. */
export function normalizeDefinitionMarkdown(body: string): string {
  if (!body.trim()) return body;

  const chunks = body.split(/\n{2,}/);
  const out: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const raw = chunks[i] ?? "";
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (isDefinitionLeadLine(trimmed)) {
      const alone = tryParseDefinitionParagraph(trimmed);
      const aloneOk = alone && isUsableDefinitionPair(alone.term, alone.meaning);
      if (!aloneOk && i + 1 < chunks.length) {
        const next = chunks[i + 1]?.trim() ?? "";
        if (next && !isDefinitionLeadLine(next)) {
          const merged = `${trimmed.replace(/^#{1,6}\s*/, "")}\n${next}`;
          const parsed = tryParseDefinitionParagraph(merged);
          if (parsed && isUsableDefinitionPair(parsed.term, parsed.meaning)) {
            out.push(`Definition — ${parsed.term}\n${parsed.meaning}`);
            i += 1;
            continue;
          }
        }
      }
      if (aloneOk && alone) {
        out.push(`Definition — ${alone.term}\n${alone.meaning}`);
        continue;
      }
    }

    out.push(raw);
  }

  return out.join("\n\n");
}

function cleanDefinitionTerm(raw: string): string {
  return raw
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/^[:：—–-]\s*/, "")
    .replace(/\s*[:：—–-]\s*$/, "")
    .trim();
}

function normalizeDefinitionText(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isUsableDefinitionPair(term: string, meaning: string): boolean {
  return Boolean(
    term &&
      meaning &&
      !/^definition$/i.test(term) &&
      normalizeDefinitionText(term) !== normalizeDefinitionText(meaning),
  );
}

function stripLeadingTerm(meaning: string, term: string): string {
  if (!term || !meaning) return meaning;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return meaning
    .replace(new RegExp(`^\\*{0,2}${escaped}\\*{0,2}\\s*[:—–-]?\\s*`, "i"), "")
    .trim();
}

/**
 * Bold structural labels so questions / answers / key lines scan quickly
 * even when the model forgot markdown.
 */
export function emphasizeStructuralLabels(text: string): string {
  return text.replace(
    /(^|\n)\s*((?:Question|Answer|Decision|Definition|Key idea|Key takeaway|Note|Tip|Warning|Important)\s*:)/gi,
    (_full, lead: string, label: string) => {
      if (label.startsWith("**")) return `${lead}${label}`;
      return `${lead}**${label}**`;
    },
  );
}

/** Standalone or lead-in questions like "What Is a Linked List?" */
export function tryParseQuestionLead(text: string): { question: string; answer: string } | null {
  const trimmed = text.trim().replace(/^\*\*(.+)\*\*$/, "$1").trim();
  if (!trimmed) return null;

  // Whole block is just the question
  if (
    /^(what|how|why|when|where|who|which)\b/i.test(trimmed) &&
    /\?$/.test(trimmed) &&
    trimmed.length <= 120 &&
    !trimmed.includes("\n")
  ) {
    return { question: trimmed, answer: "" };
  }

  // "Question: …" then optional answer
  const labeled = trimmed.match(/^Question\s*:\s*([\s\S]+)$/i);
  if (labeled) {
    const rest = labeled[1].trim();
    const split = rest.match(/^([^\n?]+\?)\s*([\s\S]*)$/);
    if (split) return { question: split[1].trim(), answer: split[2].trim() };
    return { question: rest, answer: "" };
  }

  // Question sentence, then answer prose in the same paragraph
  const lead = trimmed.match(
    /^((?:What|How|Why|When|Where|Who|Which)\b[^?\n]{2,90}\?)\s+([A-Z][\s\S]+)$/,
  );
  if (lead) {
    return { question: lead[1].trim(), answer: lead[2].trim() };
  }

  return null;
}

/** Title-style questions that should render as bold section headings. */
export function looksLikeQuestionHeading(line: string): boolean {
  const text = line.trim().replace(/^\*\*(.+)\*\*$/, "$1").trim();
  if (!text || text.length < 6 || text.length > 100) return false;
  if (!/\?$/.test(text)) return false;
  if (text.includes("\n")) return false;
  return /^(what|how|why|when|where|who|which)\b/i.test(text);
}

/**
 * Infer a Definition card from unlabeled definitional prose
 * e.g. "A variable is a named storage location used to hold data."
 */
export function tryInferDefinitionParagraph(text: string): ParsedDefinition | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 28 || trimmed.length > 420) return null;
  if (isDefinitionLeadLine(trimmed)) return tryParseDefinitionParagraph(trimmed);
  if (tryParseScenarioParagraph(trimmed)) return null;
  if (/^(imagine|suppose|consider|when |if |for example|e\.g\.)/i.test(trimmed)) return null;
  if (trimmed.includes("\n\n")) return null;

  const article = trimmed.match(
    /^(?:A|An|The)\s+([A-Za-z][\w'/&-]{0,40})\s+(?:is|are|means|refers to)\s+([\s\S]{18,})$/i,
  );
  if (article) {
    const term = cleanDefinitionTerm(article[1]);
    const meaning = trimmed;
    if (isUsableDefinitionPair(term, meaning)) return { term, meaning };
  }

  const proper = trimmed.match(
    /^((?:[A-Z][\w'/&-]*)(?:\s+[A-Z][\w'/&-]*){0,4})\s+(?:is|are|means|refers to)\s+(?:a|an|the)\s+([\s\S]{18,})$/,
  );
  if (proper) {
    const term = cleanDefinitionTerm(proper[1]);
    const meaning = trimmed;
    if (isUsableDefinitionPair(term, meaning) && term.length <= 48) return { term, meaning };
  }

  return null;
}

/** Infer a Scenario from “Imagine you…” style paragraphs without a Scenario label. */
export function tryInferScenarioParagraph(text: string): ParsedScenario | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 60) return null;
  if (tryParseScenarioParagraph(trimmed)) return tryParseScenarioParagraph(trimmed);
  if (!/^(imagine|suppose|consider(?:\s+that)?|you are|you're)\b/i.test(trimmed)) return null;
  if (isDefinitionLeadLine(trimmed)) return null;

  const decisionMatch = trimmed.match(/\b(Decision|What (?:should|would|do) you)\b[:?]?\s*([\s\S]+)$/i);
  const situation = decisionMatch
    ? trimmed.slice(0, decisionMatch.index).trim() || trimmed
    : trimmed;
  const decision = decisionMatch ? decisionMatch[0].replace(/^Decision\s*[:—–-]?\s*/i, "").trim() : "";

  return {
    title: "Applied scenario",
    situation,
    decision,
    answer: "",
  };
}

const EXAMPLE_LABEL = /^(?:\*\*)?(example|worked example)(?:\*\*)?\s*[:：—–-]\s*/i;
const SUMMARY_LABEL = /^(?:\*\*)?(summary|in summary|recap)(?:\*\*)?\s*[:：—–-]\s*/i;

export function isExampleLeadLine(line: string): boolean {
  const text = line.trim().replace(/^#{1,6}\s*/, "").replace(/^\*\*|\*\*$/g, "").trim();
  return EXAMPLE_LABEL.test(text);
}

export function isSummaryLeadLine(line: string): boolean {
  const text = line.trim().replace(/^#{1,6}\s*/, "").replace(/^\*\*|\*\*$/g, "").trim();
  return SUMMARY_LABEL.test(text) || /^key takeaways:?$/i.test(text);
}

export function tryParseExampleParagraph(
  text: string,
): { title: string; body: string } | null {
  const trimmed = text.trim();
  if (!EXAMPLE_LABEL.test(trimmed.replace(/^#{1,6}\s*/, ""))) return null;
  const without = trimmed.replace(/^#{1,6}\s*/, "").replace(EXAMPLE_LABEL, "").trim();
  if (!without) return null;
  const multiline = without.match(/^([^\n]{1,100})\n+([\s\S]+)$/);
  if (multiline) {
    return { title: multiline[1].trim(), body: multiline[2].trim() };
  }
  const shaped = without.match(/^([^:：—–-]{1,80})\s*[:：—–-]\s*([\s\S]+)$/);
  if (shaped) return { title: shaped[1].trim(), body: shaped[2].trim() };
  return { title: "Example", body: without };
}

export function tryParseSummaryParagraph(
  text: string,
): { title: string; body: string } | null {
  const trimmed = text.trim();
  if (!SUMMARY_LABEL.test(trimmed.replace(/^#{1,6}\s*/, ""))) return null;
  const without = trimmed.replace(/^#{1,6}\s*/, "").replace(SUMMARY_LABEL, "").trim();
  if (!without) return null;
  const multiline = without.match(/^([^\n]{1,100})\n+([\s\S]+)$/);
  if (multiline) return { title: multiline[1].trim(), body: multiline[2].trim() };
  return { title: "Summary", body: without };
}


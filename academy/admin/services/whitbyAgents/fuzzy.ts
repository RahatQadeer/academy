const ADD_WORDS = ["add", "create", "insert", "include", "append"];
const REMOVE_WORDS = ["remove", "delete", "drop", "eliminate"];
const RENAME_WORDS = ["rename"];
const EDIT_WORDS = [
  "rewrite",
  "expand",
  "improve",
  "tighten",
  "edit",
  "fix",
  "shorten",
  "polish",
  "strengthen",
  "clarify",
  "update",
  "revise",
  "deepen",
  "elaborate",
  "enrich",
  "beautify",
  "prettier",
];

const FORMAT_WORDS =
  /\b(bold|bolded|italic|italics|underline|underlined|strikethrough|highlight|highlighted)\b/i;

/** Instructor wants layout / Definition-card polish (not inventing new topics). */
export function isBeautifyRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /\b(beautif\w*|prettier)\b/i.test(t) ||
    /\b(definition\s+cards?|format\s+definitions?|definitions?\s+as\s+cards?|cards?\s+for\s+definitions?)\b/i.test(
      t,
    ) ||
    /\b(scenario\s+boxes?|scenarios?\s+(in|into|as)\s+(boxes?|cards?)|put\s+.+\s+in\s+scenario)\b/i.test(
      t,
    ) ||
    /\b(style|format|polish)\b.{0,40}\b(course|lesson|content|definitions?|scenarios?|code|objectives?)\b/i.test(
      t,
    ) ||
    /\b(fix|improve)\b.{0,40}\b(formatting|format|layout|ui|styling)\b/i.test(t) ||
    /\b(don'?t|do not)\b.{0,24}\b(change|rewrite)\b.{0,24}\b(content|facts?|meaning)\b/i.test(t) ||
    /\bput\s+.+\s+in\s+(a\s+)?(definition\s+)?cards?\b/i.test(t) ||
    /\bmake\b.{0,48}\b(definitions?|layout|ui|look|lesson|content|objectives?|code|scenarios?)\b.{0,40}\b(professional|beautiful|prettier|nicer|cards?|boxes?|stand out|interactive)\b/i.test(
      t,
    ) ||
    /\bmake\s+(it\s+)?(look\s+)?(nice[r]?|pretty|professional|beautiful)\b/i.test(t) ||
    /\bimprove\s+(the\s+)?(ui|layout|look|visuals?)\b/i.test(t) ||
    /\bpolish\s+(the\s+)?(ui|layout|look|lesson|this)?\b/i.test(t) ||
    /\bconvert\s+all\s+code\b|\bvs\s*code\s+blocks?\b|\bformat\s+all\s+code\b/i.test(t)
  );
}

export function beautifyEditNotes(instruction: string): string {
  return `${instruction.trim()}

UI / STRUCTURE POLISH for the named/selected lesson (preserve facts — do not invent topics):
- Convert key terms into Definition cards:
  Definition — Short term name
  One or two clear sentences (next line).
- Convert “imagine / suppose you…” situations into Scenario cards with Decision + Recommended answer.
- Convert worked walkthroughs into:
  Example — Short title
  Body…
- Convert wrap-ups into Summary — … or Key takeaways lists.
- Put tips/warnings in [Tip] / [Important] callouts.
- Put code in fenced blocks with a language tag (\`\`\`js, \`\`\`java, …).
- Prefer ## headings and short lists over paragraph walls.
- For “fix formatting / style only / don’t change content”: restructure markdown only.
- Do not add outline lessons unless explicitly asked.
- If the lesson is already correctly structured, return the same contentBody and say so in summary — do not invent a fake rewrite.`;
}

/** Format-only asks (“make Key takeaways bold”) — never create outline items. */
export function isFormatRequest(text: string): boolean {
  const t = text.trim();
  if (!t || !FORMAT_WORDS.test(t)) return false;
  // Creating a lesson titled something with “bold” still uses add verbs + noun.
  if (/\b(add|create|insert|append)\s+(a|an|another|new|\d+)/i.test(t)) return false;
  return (
    /\bmake\b.{0,48}\b(bold|italic|italics|underline|strikethrough|highlight)/i.test(t) ||
    /\b(bold|italic|italics|underline)\b.{0,40}\b(text|heading|title|takeaway|section|paragraph|line)\b/i.test(
      t,
    ) ||
    /\b(text|heading|title|takeaway|section|paragraph)\b.{0,40}\b(bold|italic|italics|underline)\b/i.test(
      t,
    ) ||
    /\bput\b.{0,24}\bin\s+(bold|italics?)\b/i.test(t)
  );
}

/**
 * Meta / Q&A — answer in chat, do not mutate the draft.
 * Covers “what you do?”, “what did you change?”, capability asks.
 */
export function isConversationalAsk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isFormatRequest(t) || isBeautifyRequest(t) || isHeadingRenameRequest(t)) return false;
  if (asksAboutLastChange(t)) return true;
  if (
    /\b(add|create|insert|remove|delete|rename|rewrite|deepen|expand|improve|shorten|fix)\b/i.test(
      t,
    ) &&
    !/^(what|whats|what's|why|how|who|which|where|when|did|do|can|could|should|would)\b/i.test(t) &&
    !asksAboutLastChange(t)
  ) {
    return false;
  }
  return (
    /^(what|whats|what's|why|how|who|which|where|when)\b/i.test(t) ||
    /\bwhat (did|do|are|were) you\b/i.test(t) ||
    /\bwhat you (do|did|mean|change|changed)\b/i.test(t) ||
    /\b(did|do) you (just )?(do|add|edit|change|mean)\b/i.test(t) ||
    /\b(explain|tell me) what you (did|do|changed|mean)\b/i.test(t) ||
    /\bwhat can you (do|help)\b/i.test(t) ||
    /^(huh|what\??|sorry\??|come again)\s*$/i.test(t)
  );
}

/**
 * “Where are the changes?” / “what did you change?” — explain last edit, never undo.
 */
export function asksAboutLastChange(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Explicit undo wins.
  if (/^(undo|revert)\b/i.test(t) || /\bremove changes\b/i.test(t)) return false;
  return (
    /\bwhere\b.{0,40}\b(the\s+)?(change|changes|edits?|difference)\b/i.test(t) ||
    /\b(what|whats|what's)\b.{0,40}\b(did you|have you|you)\b.{0,24}\b(change|changed|edit|edited|do|done|update|updated)\b/i.test(
      t,
    ) ||
    /\bwhat you (change|changed|edit|edited|do|did)\b/i.test(t) ||
    /\b(tell|show|explain)\b.{0,24}\b(me\s+)?(what|where)\b.{0,40}\b(change|changed|edits?)\b/i.test(
      t,
    ) ||
    /\b(can you|could you)\b.{0,24}\b(tell|show|explain)\b.{0,40}\b(change|changed)\b/i.test(t)
  );
}

export function formatEditNotes(instruction: string): string {
  return `${instruction.trim()}

FORMAT-ONLY edit for the named lesson/section:
- Apply the requested formatting only (bold → wrap that text in **markdown**; italic → *markdown*).
- Do not add lessons, modules, quizzes, assignments, videos, or new sections.
- Do not invent new headings or topics.
- Keep every other paragraph identical aside from the formatting change.`;
}

/**
 * Rename a heading/title inside a lesson (not the program name).
 * Examples: “heading change name”, “change the heading to X”, “rename heading”.
 */
export function isHeadingRenameRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Course/program title rename is overview — not an in-lesson heading.
  if (
    /\b(program|course)\s+(name|title|heading)\b/i.test(t) &&
    !/\blesson\b|\bmodule\s+\d|\b\d{1,2}\.\d{1,2}\b/i.test(t)
  ) {
    return false;
  }
  return (
    /\b(heading|subheading|subheader|title)\b.{0,32}\b(change|rename|update)\b/i.test(t) ||
    /\b(change|rename|update)\b.{0,32}\b(heading|subheading|subheader|title)\b/i.test(t) ||
    /\b(heading|title)\s+change\s+name\b/i.test(t) ||
    /\bchange\s+(the\s+)?name\b/i.test(t)
  );
}

export function headingRenameNotes(instruction: string): string {
  return `${instruction.trim()}

HEADING RENAME ONLY in the named/selected lesson:
- The instructor wants a heading (or title) inside the lesson body renamed — not a new lesson, not a course rename.
- If they wrote something like “a component is just a function heading change name”, the NEW heading text is: “A component is just a function”.
- Find the best matching heading in that lesson and replace only that heading text.
- Do not add lessons, modules, quizzes, assignments, or rewrite paragraphs.
- Keep every other line identical.`;
}

/**
 * Messy instructor English that is almost certainly a course edit command.
 * These must never become a lesson summary in chat.
 */
export function looksLikeCourseCommand(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (asksAboutLastChange(t) || isConversationalAsk(t)) return false;
  if (isQualityQuestion(t)) return false;
  return (
    isBeautifyRequest(t) ||
    isFormatRequest(t) ||
    isHeadingRenameRequest(t) ||
    /\b(add|create|insert|remove|delete|drop|rename|rewrite|improve|fix|update|revise|shorten|expand|deepen|polish|beautify|bold|italic|underline|attach|replace|move|swap|duplicate)\b/i.test(
      t,
    ) ||
    /\b(change|set|put)\b.{0,40}\b(name|title|heading|text|to)\b/i.test(t) ||
    /\b(heading|title|name)\b.{0,24}\b(change|rename|update)\b/i.test(t)
  );
}

const TYPE_WORDS: Record<string, string> = {
  scenario: "scenario",
  scenarios: "scenario",
  case: "scenario",
  quiz: "quiz",
  quizzes: "quiz",
  question: "quiz",
  questions: "quiz",
  assessment: "quiz",
  video: "video",
  videos: "video",
  youtube: "video",
  assignment: "assignment",
  assignments: "assignment",
  assignmwny: "assignment",
  assigment: "assignment",
  asignement: "assignment",
  assignement: "assignment",
  brief: "assignment",
  rubric: "assignment",
  reading: "reading",
  lesson: "reading",
  lessons: "reading",
  resource: "resource",
  resources: "resource",
  module: "module",
  modules: "module",
  section: "module",
  sections: "module",
};

function damerau(a: string, b: string) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

function tokensOf(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function closeTo(token: string, word: string) {
  if (token === word) return true;
  if (token.length >= 3 && (word.startsWith(token) || token.startsWith(word))) return true;
  const allowed = Math.min(word.length, token.length) <= 4 ? 1 : 2;
  return damerau(token, word) <= allowed;
}

export function fuzzyHas(text: string, words: string[]) {
  const tokens = tokensOf(text);
  return words.some((word) => tokens.some((token) => closeTo(token, word)));
}

export function wantsAdd(text: string) {
  if (isFormatRequest(text) || isConversationalAsk(text)) return false;
  if (fuzzyHas(text, ADD_WORDS) || /\bgive me\b/i.test(text)) return true;
  // make / put / write only when creating something (“make a quiz”), never “make it bold”.
  return /\b(make|put|write)\s+(a|an|another|new|some|\d{1,2})\b/i.test(text);
}

export function wantsRemove(text: string) {
  if (isConversationalAsk(text)) return false;
  return (
    fuzzyHas(text, REMOVE_WORDS) ||
    /\btake out\b|\bget rid of\b|\beliminate\b/i.test(text)
  );
}

export function wantsRename(text: string) {
  if (isConversationalAsk(text)) return false;
  if (isHeadingRenameRequest(text)) return true;
  return (
    fuzzyHas(text, RENAME_WORDS) ||
    /\bcall (it|this)\b/i.test(text) ||
    /\bchange (the )?(program |course )?(title|name|heading)\b/i.test(text) ||
    /\bchange (the )?(title|name|heading) of (the )?(program|course)\b/i.test(text)
  );
}

export function wantsEdit(text: string) {
  if (isConversationalAsk(text)) return false;
  if (isBeautifyRequest(text) || isFormatRequest(text) || isHeadingRenameRequest(text)) return true;
  return fuzzyHas(text, EDIT_WORDS) || /\bchange\b/i.test(text) || wantsDeeperContent(text);
}

const DEPTH_TOPIC_RE =
  /\b(in[- ]?depth|indepth|deeper|deepen|more depth|go deeper|flesh out|surface[- ]level)\b/i;

const REWRITE_DEPTH_RE =
  /\b(make|deepen|expand|rewrite|rebuild|fix|improve|flesh out|go deeper|add more depth)\b/i;

/** Talking about thin/shallow lesson bodies — not a course-title edit. */
export function isDepthTopic(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    DEPTH_TOPIC_RE.test(t) ||
    /\btoo (shallow|thin|basic|short|brief|skimpy|superficial)\b/i.test(t) ||
    /\b(shallow|thin) (content|lesson|course|draft)\b/i.test(t) ||
    /\b(not|isn't|isnt|ain't|aint).{0,28}(in[- ]?depth|detailed|thorough|deep enough|enough depth|enough detail)\b/i.test(
      t,
    ) ||
    /\b(not enough|lacking|missing).{0,16}(depth|detail|content|substance|examples)\b/i.test(t) ||
    /\bcontent.{0,28}(not|isn't|isnt).{0,20}(in[- ]?depth|detailed|deep|enough)\b/i.test(t)
  );
}

/** “Why isn’t this in depth?” — answer, do not rewrite. */
export function isQualityQuestion(text: string): boolean {
  const t = text.trim();
  if (!t || !isDepthTopic(t)) return false;
  // “can you make it deeper?” is a command even with a question mark.
  if (REWRITE_DEPTH_RE.test(t) && !/\bwhy\b/i.test(t)) return false;
  return (
    /\?/.test(t) ||
    /\bwhy\b/i.test(t) ||
    /^(what|whats|what's|how come|how is|is (this|it|the)|does (this|it)|can you (tell|explain)|please explain|tell me|explain)\b/i.test(
      t,
    )
  );
}

/** Instructor asked to actually deepen/rewrite the body. */
export function wantsDeeperContent(text: string): boolean {
  const t = text.trim();
  if (!t || !isDepthTopic(t)) return false;
  if (isQualityQuestion(t)) return false;
  return REWRITE_DEPTH_RE.test(t) || /\bmore in[- ]?depth\b/i.test(t);
}

export function isWholeCourseDepthAsk(text: string): boolean {
  return (
    wantsDeeperContent(text) &&
    /\b(whole|entire|all|every|full)\b.{0,20}\b(course|program|lessons?|modules?|content)\b/i.test(text)
  );
}

export function deepenLessonNotes(instruction: string): string {
  return `${instruction.trim()}

Rewrite this lesson so it is actually teachable — not an overview. Keep the topic and title.
Expand the body with: a precise mechanism, a worked example with names/numbers, a common mistake at this level, a Scenario (Decision + Recommended answer), and an exercise.
Target 1000+ words of scannable teaching. Do not change the program title or other lessons.`;
}

function isCourseBodyTalk(text: string): boolean {
  return (
    isDepthTopic(text) ||
    wantsDeeperContent(text) ||
    /\b(course|program)\s+content\b/i.test(text) ||
    /\bcontent of (the )?(course|program|lesson)\b/i.test(text)
  );
}

/** Course / program title, description, or overview — not a lesson. */
export function wantsProgramOverview(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Lesson/course BODY quality is not a title/overview edit.
  if (isCourseBodyTalk(t)) return false;

  // Explicit correction away from lessons toward the course/program.
  if (
    /\bnot\s+(a\s+|the\s+|my\s+)?(lesson|module)\b/i.test(t) &&
    /\b(course|program)\b/i.test(t) &&
    !/\bcontent\b|\bdepth\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\b(talking|mean|meant|referring)\b.{0,40}\b(course|program)\s+(name|title|heading)\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\b(talking|mean|meant|referring)\b.{0,40}\b(course|program)\b/i.test(t) &&
    !/\bcontent\b|\bdepth\b|\blesson\b|\bmodule\b/i.test(t)
  ) {
    return true;
  }

  if (/\b(program|course)\s+(name|title|heading|description|overview|summary)\b/i.test(t)) {
    return true;
  }
  if (/\brename\b[\s\S]{0,32}\b(course|program)\b/i.test(t) || /\b(course|program)\b[\s\S]{0,32}\brename\b/i.test(t)) {
    return true;
  }
  if (/\b(name|title|heading|description|overview)\s+of\s+(the\s+)?(program|course)\b/i.test(t)) {
    return true;
  }
  if (/\bchange\b[\s\S]{0,48}\b(program|course)\b[\s\S]{0,24}\b(name|title|heading)\b/i.test(t)) {
    return true;
  }
  if (
    /\b(better|best|catchier|stronger|smarter|improved)\s+(program\s+|course\s+)?(title|name|heading)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(change|rename|update|make|improve)\b[\s\S]{0,40}\binto\b[\s\S]{0,40}\b(heading|title|name)\b/i.test(
      t,
    ) &&
    !/\blesson\b|\bmodule\b|\b\d{1,2}\.\d{1,2}\b/i.test(t)
  ) {
    return true;
  }

  // Bare metadata words with no lesson/module target.
  if (
    /\b(title|description|overview|category)\b/i.test(t) &&
    !/\blesson\b|\bmodule\b|\bquiz\b|\bassignment\b|\b\d{1,2}\.\d{1,2}\b/i.test(t)
  ) {
    return true;
  }

  return false;
}

/** Undo / discard Whitby plan — not "remove lesson" and not "what did you change?". */
export function wantsUndoChanges(text: string): boolean {
  const t = text.trim();
  if (!t || asksAboutLastChange(t)) return false;
  return (
    /^(undo|revert)\b/i.test(t) ||
    /\b(undo|revert|roll\s*back)\b/i.test(t) ||
    /\b(remove|discard|cancel|drop|take back)\b.{0,28}\b(those\s+|the\s+|these\s+|my\s+)?(changes|edits|plan)\b/i.test(
      t,
    ) ||
    /\bremove changes\b/i.test(t)
  );
}

export function mentionsModule(text: string) {
  return fuzzyHas(text, ["module", "modules", "section", "sections", "unit", "units"]);
}

export function mentionsLesson(text: string) {
  return (
    /\b\d{1,2}\.\d{1,2}\b/.test(text) ||
    fuzzyHas(text, ["lesson", "lessons", "reading", "readings", "content"])
  );
}

export type DetectedKind =
  | "scenario"
  | "quiz"
  | "video"
  | "assignment"
  | "reading"
  | "resource"
  | "module"
  | null;

const KIND_PRIORITY: DetectedKind[] = [
  "quiz",
  "assignment",
  "video",
  "scenario",
  "resource",
  "module",
  "reading",
];

export function detectContentKind(text: string): DetectedKind {
  const tokens = tokensOf(text);
  const found = new Set<DetectedKind>();

  for (const [word, kind] of Object.entries(TYPE_WORDS)) {
    if (tokens.some((token) => closeTo(token, word))) {
      found.add(kind as DetectedKind);
    }
  }

  return KIND_PRIORITY.find((kind) => found.has(kind)) ?? null;
}

export function looksLikeMutation(text: string) {
  if (isQualityQuestion(text) || isConversationalAsk(text)) return false;
  if (looksLikeCourseCommand(text)) return true;
  return (
    wantsAdd(text) ||
    wantsRemove(text) ||
    wantsRename(text) ||
    wantsEdit(text) ||
    wantsDeeperContent(text) ||
    wantsProgramOverview(text) ||
    detectContentKind(text) != null
  );
}

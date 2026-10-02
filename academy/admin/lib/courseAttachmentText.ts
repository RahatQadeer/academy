export const COURSEGEN_ATTACHMENT_KINDS = ["pdf", "docx", "txt", "md", "csv", "json"] as const;
export type CourseGenAttachmentKind = (typeof COURSEGEN_ATTACHMENT_KINDS)[number];

export const MAX_ATTACHMENT_FILES = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TRANSPORT_CHARS = 120_000;
export const MAX_TOTAL_TRANSPORT_CHARS = 200_000;

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json"]);

const GENERIC_INSTRUCTION =
  /\b(create|generate|build|make|turn|write)\b[\s\S]{0,80}\b(course|program|curriculum|module)/i;

const FILE_REFERENT =
  /\b(this|the|attached|uploaded|provided)\b[\s\S]{0,40}\b(file|document|pdf|docx|attachment|source)\b/i;

const GENERIC_COURSEGEN_MARKERS = [
  "ai-powered course",
  "ai powered course",
  "course generator",
  "coursegen",
  "coursegens",
  "build your first",
  "with a prompt",
  "what an ai course",
  "read, extract, arrange",
  "read extract arrange",
  "source document into a module",
];

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "into",
  "your",
  "course",
  "program",
  "module",
  "lesson",
  "introduction",
  "advanced",
  "beginner",
  "using",
  "based",
  "document",
  "file",
  "create",
  "about",
]);

export function detectAttachmentKind(file: { name: string; type?: string }): CourseGenAttachmentKind | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = (file.type || "").toLowerCase();

  if (type === "application/pdf" || extension === "pdf") return "pdf";
  if (
    extension === "docx" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (extension === "doc" || type === "application/msword") return null;
  if (type === "application/json" || extension === "json") return "json";
  if (type === "text/csv" || extension === "csv") return "csv";
  if (extension === "md" || extension === "markdown" || type === "text/markdown") return "md";
  if (type.startsWith("text/") || TEXT_EXTENSIONS.has(extension)) return "txt";
  return null;
}

export function unsupportedAttachmentMessage(fileName: string) {
  return `${fileName} is not supported. Use PDF, Word (.docx), .txt, .md, .csv, or .json.`;
}

/** Mammoth HTML → headings, lists, tables, and paragraphs. */
export function htmlToStructuredText(html: string) {
  const out: string[] = [];
  let depth = 0;
  let cell = false;

  for (const [, tag, text] of html.matchAll(/<([^>]+)>|([^<]+)/g)) {
    if (text !== undefined) {
      out.push(decodeHtml(text));
      continue;
    }

    const name = tag.replace(/^\//, "").split(/[\s>]/)[0].toLowerCase();
    const closing = tag.startsWith("/");

    switch (name) {
      case "ul":
      case "ol":
        depth += closing ? -1 : 1;
        if (depth < 0) depth = 0;
        if (closing) out.push("\n");
        break;
      case "li":
        if (!closing) out.push(`\n${"  ".repeat(Math.max(depth - 1, 0))}- `);
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        out.push(closing ? "\n" : `\n\n${"#".repeat(Number(name[1]))} `);
        break;
      case "td":
      case "th":
        if (!closing) {
          out.push(cell ? " | " : "");
          cell = true;
        }
        break;
      case "tr":
        if (closing) cell = false;
        out.push("\n");
        break;
      case "p":
      case "br":
      case "div":
        out.push("\n");
        break;
    }
  }

  return normalizeExtractedText(out.join(""));
}

export function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function normalizeExtractedText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.trim() || lines[index - 1]?.trim())
    .join("\n")
    .trim();
}

/** Keep page breaks and promote short title-like lines so multi-page PDFs keep structure. */
export function formatPdfPageText(pageNum: number, text: string) {
  const lines = text.split("\n").map((line) => {
    const trimmed = line.trim();
    if (looksLikePdfHeading(trimmed)) return `## ${trimmed}`;
    return line;
  });
  return `--- Page ${pageNum} ---\n${normalizeExtractedText(lines.join("\n"))}`;
}

export function looksLikePdfHeading(line: string) {
  if (line.length < 4 || line.length > 90) return false;
  if (/[.!?:]$/.test(line)) return false;
  if (/\d{2,}/.test(line) && line.length > 40) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 12) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length / letters.length;
  if (upper >= 0.72) return true;
  return words.length <= 10 && words.every((word) => /^[A-Z0-9]/.test(word));
}

export function extractHeadings(text: string) {
  const headings: string[] = [];
  for (const line of text.split("\n")) {
    const match = line.trim().match(/^#{1,6}\s+(.+)$/);
    if (match?.[1]) headings.push(match[1].trim());
  }
  return headings;
}

export function countPages(text: string) {
  const markers = text.match(/--- Page \d+ ---/g);
  return markers?.length ?? 0;
}

export function splitIntoChunks(text: string, maxChars = 10_000, overlap = 400) {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const sections = splitOnStructure(normalized);
  const chunks: string[] = [];
  let current = "";

  for (const section of sections) {
    if (section.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      for (const piece of hardSplit(section, maxChars, overlap)) chunks.push(piece);
      continue;
    }
    if (current && current.length + section.length + 2 > maxChars) {
      chunks.push(current.trim());
      const tail = current.slice(Math.max(0, current.length - overlap));
      current = `${tail}\n\n${section}`.trim();
      continue;
    }
    current = current ? `${current}\n\n${section}` : section;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function splitOnStructure(text: string) {
  const parts = text.split(/(?=\n--- Page \d+ ---|\n#{1,3} )/);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function hardSplit(text: string, maxChars: number, overlap: number) {
  const pieces: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + maxChars);
    pieces.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return pieces.filter(Boolean);
}

/**
 * Shrink oversized extracts without dropping later sections: every section
 * keeps a head and a tail so page 24 is not discarded for page 1.
 */
export function condenseForTransport(text: string, maxChars = MAX_TRANSPORT_CHARS) {
  const normalized = text.trim();
  if (normalized.length <= maxChars) {
    return { text: normalized, condensed: false, sectionCount: 1 };
  }

  const sections = splitOnStructure(normalized);
  let budget = Math.max(400, Math.floor(maxChars / Math.max(sections.length, 1)));

  const render = (size: number) =>
    sections
      .map((section, index) => {
        if (section.length <= size) return section;
        const head = Math.max(120, Math.floor(size * 0.65));
        const tail = Math.max(80, size - head - 40);
        return `${section.slice(0, head).trim()}\n\n[…section ${index + 1} middle omitted for length…]\n\n${section.slice(-tail).trim()}`;
      })
      .join("\n\n");

  let joined = render(budget);
  while (joined.length > maxChars && budget > 220) {
    budget = Math.floor(budget * 0.75);
    joined = render(budget);
  }

  return { text: joined, condensed: true, sectionCount: sections.length };
}

export function isGenericCourseInstruction(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) return true;
  if (!GENERIC_INSTRUCTION.test(trimmed) && !FILE_REFERENT.test(trimmed)) return false;
  return !hasNamedSubject(trimmed);
}

export function hasNamedSubject(prompt: string) {
  const between = prompt.match(
    /\b(?:create|generate|build|make|turn)\b\s+(?:a|an|the)?\s*(.+?)\s+\b(?:course|program|curriculum)\b/i,
  );
  const inner = (between?.[1] ?? prompt)
    .replace(/\b(beginner|intermediate|advanced|practical|exercises?|friendly|from|based|using|related|please)\b/gi, " ")
    .replace(FILE_REFERENT, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim();
  const words = inner.split(/\s+/).filter((word) => word.length > 3 && !STOPWORDS.has(word.toLowerCase()));
  return words.length >= 1;
}

export function looksLikeGenericCourseGen(text: string) {
  const lower = text.toLowerCase();
  return GENERIC_COURSEGEN_MARKERS.some((marker) => lower.includes(marker));
}

export function sourceMentionsGenericCourseGen(sourceText: string) {
  return looksLikeGenericCourseGen(sourceText);
}

export function significantTokens(text: string, limit = 80) {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []) {
    if (STOPWORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

export function titleReflectsSource(title: string, sourceText: string, fileNames: string[] = []) {
  if (!title.trim()) return false;
  if (looksLikeGenericCourseGen(title) && !sourceMentionsGenericCourseGen(sourceText)) return false;
  const titleTokens = significantTokens(title, 12);
  if (titleTokens.length === 0) return false;
  const haystack = `${sourceText}\n${fileNames.join(" ")}`.toLowerCase();
  return titleTokens.some((token) => haystack.includes(token));
}

export function isOutlineOnlyBody(body: string) {
  const text = body.trim();
  if (!text) return true;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 250) return true;
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return true;
  const bullets = lines.filter((line) => /^([-*•]|\d+\.)\s+/.test(line)).length;
  const headings = lines.filter(
    (line) => /^#{1,6}\s+/.test(line) || /^[A-Z][A-Za-z0-9 ,:-]{0,70}$/.test(line),
  ).length;
  const proseLines = lines.filter((line) => {
    if (/^([-*•]|\d+\.)\s+/.test(line)) return false;
    if (/^#{1,6}\s+/.test(line)) return false;
    return line.split(/\s+/).filter(Boolean).length >= 12;
  });
  const proseWords = proseLines.join(" ").split(/\s+/).filter(Boolean).length;
  if (proseWords < 180) return true;
  const skeletonRatio = (bullets + headings) / lines.length;
  return skeletonRatio >= 0.55 && proseWords < 320;
}

export const SYNTHETIC_LESSON_MARKER = "is a working decision in this lesson, not a label to memorize";

export function isSyntheticLessonBody(body: string) {
  return body.includes(SYNTHETIC_LESSON_MARKER);
}

export function lessonNeedsTeachingBody(type: string, contentBody: string | null | undefined) {
  if (type === "quiz") return false;
  const body = String(contentBody ?? "");
  if (type === "assignment") return body.trim().length < 80;
  if (!body.trim()) return true;
  if (isSyntheticLessonBody(body)) return true;
  return isOutlineOnlyBody(body);
}

const LEVEL_WORD_FLOOR: Record<string, number> = {
  beginner: 420,
  intermediate: 500,
  advanced: 620,
};

export function teachingContentIsComplete(
  body: string,
  difficulty: string,
  kind = "reading",
) {
  if (kind === "quiz") return true;
  if (!body.trim()) return false;
  if (isSyntheticLessonBody(body)) return false;
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  if (kind === "assignment") return words >= 220;
  if (isOutlineOnlyBody(body)) return false;
  const floor = LEVEL_WORD_FLOOR[difficulty] ?? LEVEL_WORD_FLOOR.intermediate;
  return words >= floor;
}

export function kindLabel(kind: CourseGenAttachmentKind) {
  if (kind === "pdf") return "PDF";
  if (kind === "docx") return "DOCX";
  return kind.toUpperCase();
}

export type CourseGenContextRequest = {
  prompt: string;
  length: string;
  difficulty: string;
  type: string;
  moduleCount: number;
  attachments?: { name: string; content: string }[];
  source?: {
    hasSource: boolean;
    fileNames: string[];
    pageCount: number;
    headingCount?: number;
    subjectHint: string;
    consolidated: string;
    fullText?: string;
  };
};

export function sourcePriorityRules(hasSource: boolean) {
  if (!hasSource) return "";
  return `PRIORITY ORDER (highest first):
1. SOURCE DOCUMENT — the course subject, title, modules, lessons, examples, and quizzes MUST come from this material.
2. USER INSTRUCTION — how to transform the document (level, length, exercises, beginner/advanced). This is NOT the course topic unless the user names a subject that appears in the source.
3. Academy instructional-design rules — structure, depth, and format.
4. General knowledge — only to explain source concepts clearly. Never replace the source subject.

If the user says they want a course from this file/document, derive the entire course from the source. Do not invent a course about AI, prompting, CourseGen, or "building a course with a prompt" unless the source document is itself about those topics.

Forbidden unless they appear in the source: "Build Your First AI-Powered Course", "CourseGen", "What an AI Course Generator Actually Does", "The Three Stages: Read, Extract, Arrange".`;
}

export function buildCourseGenContextBlock(
  request: CourseGenContextRequest,
  blueprint?: { title?: string },
) {
  const hasSource = Boolean(request.source?.hasSource || request.attachments?.some((file) => file.content.trim()));
  const instruction = request.prompt.trim();
  const genericInstruction = hasSource && isGenericCourseInstruction(instruction);

  const sourceBlock = hasSource
    ? [
        "SOURCE DOCUMENT (PRIMARY — the generated course MUST be about this material):",
        request.source?.fileNames?.length ? `FILES: ${request.source.fileNames.join(", ")}` : null,
        request.source?.pageCount ? `PAGES ANALYZED: ${request.source.pageCount}` : null,
        request.source?.subjectHint ? `SUBJECT HINT FROM SOURCE: ${request.source.subjectHint}` : null,
        request.source?.consolidated?.trim() ||
          (request.attachments ?? [])
            .map((file, index) => `--- File ${index + 1}: ${file.name} ---\n${file.content.trim()}`)
            .join("\n\n"),
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  const instructionBlock = [
    "USER INSTRUCTION (how to transform the source, not a replacement topic):",
    instruction || "Create a course from the attached document.",
    genericInstruction
      ? "The user did not name a different subject. Use the source document's actual topic as the course subject."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    sourceBlock,
    instructionBlock,
    blueprint?.title ? `WORKING TITLE: ${blueprint.title}` : null,
    `LEVEL: ${request.difficulty}`,
    `MODULES REQUESTED: ${request.moduleCount}`,
    `PROGRAM TYPE: ${request.type}`,
    `PREFERRED LENGTH: ${request.length}`,
    sourcePriorityRules(hasSource),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function genericCourseGenBlocked(text: string, sourceText: string) {
  return looksLikeGenericCourseGen(text) && !looksLikeGenericCourseGen(sourceText);
}


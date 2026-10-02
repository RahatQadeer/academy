import "server-only";

import {
  MAX_ATTACHMENT_BYTES,
  condenseForTransport,
  countPages,
  detectAttachmentKind,
  extractHeadings,
  formatPdfPageText,
  htmlToStructuredText,
  kindLabel,
  normalizeExtractedText,
  unsupportedAttachmentMessage,
  type CourseGenAttachmentKind,
} from "./courseAttachmentText";

export type ParsedCourseAttachment = {
  name: string;
  content: string;
  kind: CourseGenAttachmentKind;
  pageCount: number;
  headingCount: number;
  charCount: number;
  condensed: boolean;
  parseSummary: string;
};

export type ParseCourseAttachmentResult =
  | { ok: true; attachment: ParsedCourseAttachment }
  | { ok: false; error: string };

export async function parseCourseAttachmentFile(file: File): Promise<ParseCourseAttachmentResult> {
  if (file.size <= 0) {
    return { ok: false, error: `${file.name} is empty.` };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `${file.name} is too large. Each file must be under ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`,
    };
  }

  const kind = detectAttachmentKind(file);
  if (!kind) {
    return { ok: false, error: unsupportedAttachmentMessage(file.name) };
  }

  try {
    if (kind === "pdf") return await parsePdf(file);
    if (kind === "docx") return await parseDocx(file);

    const content = normalizeExtractedText(await file.text());
    if (!content) {
      return { ok: false, error: `${file.name} did not contain any readable text.` };
    }
    return okAttachment(file.name, kind, content, 0);
  } catch (error) {
    console.error("[parseCourseAttachment]", file.name, error);
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : `${file.name} could not be parsed. The file may be damaged or password-protected.`,
    };
  }
}

async function parsePdf(file: File): Promise<ParseCourseAttachmentResult> {
  const { PDFParse } = await import("pdf-parse");
  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  let pages: Array<{ num: number; text: string }>;
  let total: number;
  try {
    const result = await parser.getText();
    pages = result.pages ?? [];
    total = result.total ?? pages.length;
  } finally {
    await parser.destroy();
  }

  const pageTexts = pages.map((page) => formatPdfPageText(page.num, page.text ?? ""));
  const content = pageTexts.join("\n\n").trim();
  const letters = content.replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "").length;

  if (!content || letters < 20 * Math.max(total, 1)) {
    return {
      ok: false,
      error: `${file.name} looks like a scanned PDF without a text layer. Export a text-based PDF or paste the contents.`,
    };
  }

  return okAttachment(file.name, "pdf", content, total || countPages(content));
}

async function parseDocx(file: File): Promise<ParseCourseAttachmentResult> {
  const mammoth = await import("mammoth");
  const buffer = Buffer.from(await file.arrayBuffer());
  const { value } = await mammoth.convertToHtml({ buffer });
  const content = htmlToStructuredText(value);
  if (!content) {
    return { ok: false, error: `${file.name} did not contain any readable Word content.` };
  }
  return okAttachment(file.name, "docx", content, 0);
}

function okAttachment(
  name: string,
  kind: CourseGenAttachmentKind,
  raw: string,
  pageCount: number,
): ParseCourseAttachmentResult {
  const condensed = condenseForTransport(raw);
  const headings = extractHeadings(condensed.text);
  const label = kindLabel(kind);
  const pageBit =
    kind === "pdf"
      ? `${pageCount || 1} page${(pageCount || 1) === 1 ? "" : "s"} analyzed`
      : "Document content extracted";

  return {
    ok: true,
    attachment: {
      name,
      content: condensed.text,
      kind,
      pageCount: kind === "pdf" ? pageCount || 1 : 0,
      headingCount: headings.length,
      charCount: condensed.text.length,
      condensed: condensed.condensed,
      parseSummary: `${label} parsed successfully. ${pageBit}. Ready to generate.`,
    },
  };
}

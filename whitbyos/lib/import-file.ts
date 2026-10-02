import "server-only";

import { isAiConfigured, transcribeFile } from "@/whitbyos/lib/ai/provider";
import { formatOf, MAX_UPLOAD_BYTES, type ImportFormat } from "@/whitbyos/lib/import-formats";

/**
 * Reading an uploaded plan — WP.12's four formats, plus the plain ones.
 *
 * The drafting model takes text, so every format's job here is the same: turn
 * the file into the closest honest text version of itself and hand that over.
 * Nothing tries to *understand* the file; a spreadsheet becomes rows, a
 * document becomes its paragraphs, and what any of it means is decided one
 * layer up, where the model is.
 *
 * Each parser is loaded on demand. They are large — pdf-parse alone pulls in
 * pdfjs — and every other page in the app would otherwise carry them.
 */

/** What the model is given, whatever the file was. */
const MAX_CHARS = 60_000;

export type UploadRead =
  | { ok: true; text: string; summary: string }
  | { ok: false; error: string };

export async function readUpload(file: File): Promise<UploadRead> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)} MB, the limit is 10 MB. Split it, or paste the part the plan is in.`,
    };
  }

  const format = formatOf(file);
  if (!format) {
    return {
      ok: false,
      error: `${file.name} is not a format Whitby can read. Try a PDF, Word document, Excel workbook, CSV, or plain text, or paste the contents instead.`,
    };
  }

  try {
    const read = await parse(file, format);
    if (!read.text.trim()) {
      return {
        ok: false,
        error: read.emptyReason
          ? `${file.name} could not be read, ${read.emptyReason}`
          : `${file.name} is empty.`,
      };
    }
    return { ok: true, text: clamp(read.text), summary: read.summary };
  } catch (error) {
    // Whatever a parser throws is about the file's insides and means nothing to
    // whoever uploaded it, so it is logged and not shown.
    console.error("import parse failed", file.name, error);
    return {
      ok: false,
      error: `${file.name} could not be read, it may be damaged, or password-protected. Paste the contents instead.`,
    };
  }
}

function clamp(text: string) {
  const trimmed = text.trim();
  return trimmed.length > MAX_CHARS ? `${trimmed.slice(0, MAX_CHARS)}\n\n[…truncated]` : trimmed;
}

type Parsed = {
  text: string;
  summary: string;
  /** Why there is no text, where that is worth saying. */
  emptyReason?: string;
};

async function parse(file: File, format: ImportFormat): Promise<Parsed> {
  if (format === "text") {
    const text = await file.text();
    return { text, summary: `${countLines(text)} lines` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (format === "docx") return parseDocx(buffer);
  if (format === "xlsx") return parseXlsx(buffer);
  return parsePdf(buffer);
}

/**
 * Word — the text, and the list nesting that carries the plan's shape.
 *
 * Converted to HTML first and flattened here rather than taken as raw text,
 * because in a plan written in Word the indent level *is* the structure:
 * "Phase 1" over three indented steps says what `extractRawText`'s flat run of
 * paragraphs would lose. Mammoth's own Markdown writer would do this, but it
 * is deprecated upstream and absent from its types.
 */
async function parseDocx(buffer: Buffer) {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ buffer });
  const text = htmlToOutline(value);
  return { text, summary: `${countLines(text)} lines` };
}

/**
 * Mammoth's HTML, as an indented outline.
 *
 * One pass, in document order, because list depth only means anything if it is
 * read as the tags go by — a chain of replacements would finish counting every
 * `<ul>` in the file before it reached the first `<li>`, and every step would
 * come out flat.
 *
 * Only the tags mammoth actually emits are handled — headings, paragraphs,
 * lists, tables — which is why this is a switch and not a parser.
 */
function htmlToOutline(html: string) {
  const out: string[] = [];
  let depth = 0;
  let cell = false;

  for (const [, tag, text] of html.matchAll(/<([^>]+)>|([^<]+)/g)) {
    if (text !== undefined) {
      out.push(decode(text));
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
        // A separator before every cell but the row's first.
        if (!closing) out.push(cell ? " | " : "");
        cell = !closing;
        break;
      case "tr":
        if (closing) cell = false;
        out.push("\n");
        break;
      case "p":
      case "br":
        out.push("\n");
        break;
    }
  }

  return out
    .join("")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.trim() || lines[index - 1]?.trim())
    .join("\n");
}

/** The five entities mammoth escapes on the way out. */
function decode(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Excel — every sheet, as rows.
 *
 * Sheets are labelled and kept in workbook order because the sheet name is
 * usually the phase, and the tabs are usually the sequence. Empty rows and
 * trailing empty cells go; a blank column between two used ones stays, since
 * dropping it would slide values under the wrong heading.
 */
async function parseXlsx(buffer: Buffer) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const blocks: string[] = [];
  let sheets = 0;
  let rows = 0;

  workbook.eachSheet((sheet) => {
    const lines: string[] = [];

    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cellText(cell.value));
      });

      while (cells.length > 0 && !cells[cells.length - 1]) cells.pop();
      if (cells.length === 0) return;

      lines.push(cells.join(" | "));
      rows += 1;
    });

    if (lines.length === 0) return;
    sheets += 1;
    blocks.push(`## ${sheet.name}\n${lines.join("\n")}`);
  });

  return {
    text: blocks.join("\n\n"),
    summary: `${sheets} sheet${sheets === 1 ? "" : "s"}, ${rows} row${rows === 1 ? "" : "s"}`,
  };
}

/**
 * One cell, as the person looking at the spreadsheet would read it.
 *
 * ExcelJS hands back a union — a formula arrives as its formula *and* its last
 * cached result, a date as a Date, a styled string as a run list. A formula
 * gives up its result, since `=SUM(B2:B9)` tells the model nothing and `48`
 * tells it something.
 */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === "object") {
    const cell = value as Record<string, unknown>;
    if ("text" in cell) return cellText(cell.text);
    if ("result" in cell) return cellText(cell.result);
    if ("hyperlink" in cell) return cellText(cell.hyperlink);
    if ("richText" in cell && Array.isArray(cell.richText)) {
      return cell.richText.map((run) => cellText((run as { text?: unknown }).text)).join("");
    }
    if ("error" in cell) return "";
  }

  return String(value);
}

/**
 * PDF — the text layer where there is one, and the model where there is not.
 *
 * A PDF has no headings and no lists, only positioned glyphs, so this is the
 * one format that reaches the drafting call as prose. Page markers are kept
 * because a plan laid out one phase per page loses its divisions without them.
 *
 * A scan has no glyphs at all. It is a photograph of a page, so no amount of
 * parsing will produce a word — which is why anything that comes back too thin
 * for its page count is handed to the model to read instead.
 */
async function parsePdf(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  let pages: Array<{ num: number; text: string }>;
  let total: number;

  try {
    const result = await parser.getText();
    pages = result.pages;
    total = result.total;
  } finally {
    await parser.destroy();
  }

  const layer = pages
    .map((page) => `--- Page ${page.num} ---\n${page.text.trim()}`)
    .join("\n\n");

  const label = `${total} page${total === 1 ? "" : "s"}`;
  if (!isScanned(pages, total)) return { text: layer, summary: label };

  const read = await transcribe(buffer, total);
  if (read.text) return { text: read.text, summary: `${label}, scanned` };
  return { text: "", summary: label, emptyReason: read.reason };
}

/**
 * A page or two of running heads is not a text layer.
 *
 * Scanners and phone apps often stamp a filename or a page number into the
 * PDF, so "has any text at all" would call those readable and hand the drafting
 * call a plan made of headers. The test is per page and deliberately low: real
 * prose clears twenty characters a page without trying, and a genuinely sparse
 * page — a title page, a signature page — is carried by the rest of the file.
 */
function isScanned(pages: Array<{ text: string }>, total: number) {
  if (total === 0) return false;
  const characters = pages.reduce((sum, page) => sum + page.text.replace(/\s+/g, "").length, 0);
  return characters < 20 * total;
}

/**
 * Above this, a scan is somebody's archive rather than a plan.
 *
 * The cap is on transcription, not on the file: a 300-page PDF with a text
 * layer still imports, because reading it costs nothing. This one is a model
 * call per page, and the drafting step only ever looks at the first several
 * thousand characters anyway.
 */
const MAX_SCANNED_PAGES = 50;

/** How long the model gets, matching the drafting call's own patience. */
const TRANSCRIBE_TIMEOUT_MS = 120_000;

async function transcribe(buffer: Buffer, total: number) {
  if (total > MAX_SCANNED_PAGES) {
    return {
      text: "",
      reason: `it is a scan of ${total} pages, and Whitby reads up to ${MAX_SCANNED_PAGES}. Split it, or paste the part the plan is in.`,
    };
  }

  if (!isAiConfigured()) {
    return {
      text: "",
      reason: "it is a scan (a picture of a plan rather than a plan) and no model is configured to read it. Paste the contents instead.",
    };
  }

  const read = await transcribeFile({
    data: buffer.toString("base64"),
    mimeType: "application/pdf",
    signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
  });

  if (!read.ok) return { text: "", reason: `it is a scan, and reading it failed \u2014 ${lower(read.error)}` };
  return { text: read.data, reason: "" };
}

/** The model's sentence continues ours, so it should not start with a capital. */
function lower(sentence: string) {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

function countLines(text: string) {
  return text.split("\n").filter((line) => line.trim()).length;
}

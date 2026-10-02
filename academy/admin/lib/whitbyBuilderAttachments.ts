import { parseCourseGenAttachmentAction } from "@/academy/admin/actions";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_FILES,
  MAX_TOTAL_TRANSPORT_CHARS,
  condenseForTransport,
  detectAttachmentKind,
  kindLabel,
  normalizeExtractedText,
  unsupportedAttachmentMessage,
  type CourseGenAttachmentKind,
} from "./courseAttachmentText";

export type WhitbyBuilderAttachment = {
  name: string;
  content: string;
  kind?: CourseGenAttachmentKind;
  pageCount?: number;
  headingCount?: number;
  charCount?: number;
  condensed?: boolean;
  parsed?: boolean;
  parseSummary?: string;
};

export const WHITBY_BUILDER_ATTACHMENTS_KEY = "academy-whitby-builder-attachments";

export function saveWhitbyBuilderAttachments(attachments: WhitbyBuilderAttachment[]) {
  try {
    sessionStorage.setItem(WHITBY_BUILDER_ATTACHMENTS_KEY, JSON.stringify(attachments));
  } catch {
    /* ignore quota errors */
  }
}

export function loadWhitbyBuilderAttachments(): WhitbyBuilderAttachment[] {
  try {
    const raw = sessionStorage.getItem(WHITBY_BUILDER_ATTACHMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WhitbyBuilderAttachment[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => typeof item?.name === "string" && typeof item?.content === "string" && item.content.trim(),
    );
  } catch {
    return [];
  }
}

export function clearWhitbyBuilderAttachments() {
  try {
    sessionStorage.removeItem(WHITBY_BUILDER_ATTACHMENTS_KEY);
  } catch {
    /* ignore */
  }
}

export async function readWhitbyAttachmentFile(
  file: File,
  existingCount: number,
): Promise<WhitbyBuilderAttachment> {
  if (existingCount >= MAX_ATTACHMENT_FILES) {
    throw new Error(`You can attach up to ${MAX_ATTACHMENT_FILES} files.`);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is too large. Each file must be under ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`);
  }

  const kind = detectAttachmentKind(file);
  if (!kind) {
    throw new Error(unsupportedAttachmentMessage(file.name));
  }

  if (kind === "pdf" || kind === "docx") {
    const form = new FormData();
    form.append("file", file);
    const result = await parseCourseGenAttachmentAction(form);
    if (!result.ok) throw new Error(result.error);
    return {
      ...result.attachment,
      parsed: true,
    };
  }

  const raw = normalizeExtractedText(await file.text());
  if (!raw) {
    throw new Error(`${file.name} did not contain any readable text.`);
  }
  const condensed = condenseForTransport(raw);
  return {
    name: file.name,
    content: condensed.text,
    kind,
    pageCount: 0,
    headingCount: 0,
    charCount: condensed.text.length,
    condensed: condensed.condensed,
    parsed: true,
    parseSummary: `${kindLabel(kind)} parsed successfully. Document content extracted. Ready to generate.`,
  };
}

export function normalizeWhitbyAttachments(
  attachments: WhitbyBuilderAttachment[],
): WhitbyBuilderAttachment[] {
  let total = 0;
  const kept: WhitbyBuilderAttachment[] = [];

  for (const attachment of attachments.slice(0, MAX_ATTACHMENT_FILES)) {
    const remaining = MAX_TOTAL_TRANSPORT_CHARS - total;
    if (remaining <= 0) break;
    const condensed = condenseForTransport(attachment.content, remaining);
    total += condensed.text.length;
    kept.push({
      ...attachment,
      content: condensed.text,
      charCount: condensed.text.length,
      condensed: attachment.condensed || condensed.condensed,
      parsed: attachment.parsed ?? Boolean(condensed.text.trim()),
    });
  }

  return kept;
}

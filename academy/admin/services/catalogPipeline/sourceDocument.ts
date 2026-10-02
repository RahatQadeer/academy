import "server-only";

import {
  countPages,
  extractHeadings,
  significantTokens,
  splitIntoChunks,
} from "@/academy/admin/lib/courseAttachmentText";
import { generateJson, mapLimit } from "./deepseek";
import { jsonDiscipline } from "./prompts";
import type { CatalogGenerationRequest, SourceExcerpt, SourceKnowledge } from "./types";

const DIRECT_CHARS = 28_000;
const CHUNK_CHARS = 10_000;
const CHUNK_OVERLAP = 400;
const CHUNK_CONCURRENCY = 3;

const emptySource = (): SourceKnowledge => ({
  hasSource: false,
  fileNames: [],
  pageCount: 0,
  headingCount: 0,
  subjectHint: "",
  headings: [],
  concepts: [],
  details: [],
  consolidated: "",
  excerpts: [],
  usedChunking: false,
});

export function combinedAttachmentText(
  attachments: CatalogGenerationRequest["attachments"],
): { text: string; fileNames: string[]; pageCount: number } {
  const files = attachments ?? [];
  const fileNames = files.map((file) => file.name);
  const pageCount = files.reduce((sum, file) => sum + (file.pageCount || countPages(file.content)), 0);
  const text = files
    .map((file, index) => `--- File ${index + 1}: ${file.name} ---\n${file.content.trim()}`)
    .join("\n\n");
  return { text, fileNames, pageCount };
}

export async function buildSourceKnowledge(
  attachments: CatalogGenerationRequest["attachments"],
  signal?: AbortSignal,
): Promise<SourceKnowledge> {
  const files = (attachments ?? []).filter((file) => file.content.trim());
  if (!files.length) return emptySource();

  const { text, fileNames, pageCount } = combinedAttachmentText(files);
  const headings = extractHeadings(text);
  const subjectHint =
    headings[0] ||
    fileNames[0]?.replace(/\.(pdf|docx|txt|md|markdown|csv|json)$/i, "").replace(/[_-]+/g, " ") ||
    significantTokens(text, 6).slice(0, 4).join(" ");

  if (text.length <= DIRECT_CHARS) {
    return {
      hasSource: true,
      fileNames,
      pageCount,
      headingCount: headings.length,
      subjectHint,
      headings,
      concepts: significantTokens(text, 24),
      details: headings.slice(0, 20),
      consolidated: text,
      fullText: text,
      excerpts: headings.slice(0, 12).map((topic) => ({
        topic,
        excerpt: excerptAround(text, topic, 1_800),
      })),
      usedChunking: false,
    };
  }

  const chunks = splitIntoChunks(text, CHUNK_CHARS, CHUNK_OVERLAP);
  const analyses = await mapLimit(chunks, CHUNK_CONCURRENCY, async (chunk, index) => {
    const result = await generateJson<{
      headings?: string[];
      topics?: string[];
      concepts?: string[];
      details?: string[];
      summary?: string;
    }>(
      "You extract teaching material from a source document. Return only JSON. Do not invent topics that are not in the chunk.",
      `Analyze SOURCE CHUNK ${index + 1} of ${chunks.length}. Cover everything important in this chunk. Do not skip later paragraphs.

CHUNK:
${chunk}

Return JSON with keys: headings (string array), topics (string array), concepts (string array), details (string array of facts/definitions that must not be lost), summary (120-180 words).

${jsonDiscipline()}`,
      { temperature: 0.2, maxTokens: 2500, timeoutMs: 45_000, signal, task: "write" },
    ).catch(() => null);

    return {
      chunk,
      headings: result?.headings?.map(String) ?? extractHeadings(chunk),
      topics: result?.topics?.map(String) ?? [],
      concepts: result?.concepts?.map(String) ?? significantTokens(chunk, 12),
      details: result?.details?.map(String) ?? [],
      summary: result?.summary?.trim() || chunk.slice(0, 600),
    };
  });

  const merged = await generateJson<{
    subject?: string;
    headings?: string[];
    concepts?: string[];
    details?: string[];
    teachingOutline?: string[];
    summary?: string;
  }>(
    "You merge chunk analyses of one source document into a complete knowledge representation. Later chunks are as important as the first. Do not drop topics.",
    `The source files are: ${fileNames.join(", ")}. Merge every chunk below into one representation. Keep order. Do not replace the subject with course-generation or AI-prompting unless those topics appear in the chunks.

${analyses
  .map(
    (item, index) =>
      `CHUNK ${index + 1}:
HEADINGS: ${item.headings.join("; ") || "—"}
TOPICS: ${item.topics.join("; ") || "—"}
CONCEPTS: ${item.concepts.join("; ") || "—"}
DETAILS: ${item.details.join("; ") || "—"}
SUMMARY: ${item.summary}`,
  )
  .join("\n\n")}

Return JSON with keys: subject, headings (in document order), concepts, details (must-keep facts), teachingOutline (module-sized topic sequence), summary (220-320 words covering the WHOLE document).

${jsonDiscipline()}`,
    { temperature: 0.2, maxTokens: 4000, timeoutMs: 60_000, signal, task: "reason" },
  ).catch(() => null);

  const excerpts: SourceExcerpt[] = analyses.flatMap((item) => {
    const topics = item.topics.length ? item.topics : item.headings.slice(0, 3);
    if (!topics.length) {
      return [{ topic: `Chunk ${analyses.indexOf(item) + 1}`, excerpt: item.chunk.slice(0, 1_600) }];
    }
    return topics.slice(0, 3).map((topic) => ({
      topic,
      excerpt: excerptAround(item.chunk, topic, 1_600) || item.chunk.slice(0, 1_600),
    }));
  });

  const consolidated = [
    `SUBJECT: ${merged?.subject?.trim() || subjectHint}`,
    `FILES: ${fileNames.join(", ")}`,
    merged?.summary ? `DOCUMENT SUMMARY:\n${merged.summary}` : null,
    `HEADINGS IN ORDER:\n${(merged?.headings?.length ? merged.headings : headings).map((h) => `- ${h}`).join("\n")}`,
    merged?.concepts?.length ? `CONCEPTS:\n${merged.concepts.map((c) => `- ${c}`).join("\n")}` : null,
    merged?.details?.length ? `MUST-KEEP DETAILS:\n${merged.details.map((d) => `- ${d}`).join("\n")}` : null,
    merged?.teachingOutline?.length
      ? `TEACHING OUTLINE FROM SOURCE:\n${merged.teachingOutline.map((d, i) => `${i + 1}. ${d}`).join("\n")}`
      : null,
    "CHUNK SUMMARIES (entire document):",
    ...analyses.map((item, index) => `${index + 1}. ${item.summary}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    hasSource: true,
    fileNames,
    pageCount,
    headingCount: (merged?.headings ?? headings).length,
    subjectHint: merged?.subject?.trim() || subjectHint,
    headings: merged?.headings?.map(String) ?? headings,
    concepts: merged?.concepts?.map(String) ?? significantTokens(text, 24),
    details: merged?.details?.map(String) ?? [],
    consolidated,
    excerpts,
    usedChunking: true,
  };
}

export function excerptForLesson(source: SourceKnowledge | undefined, title: string, outline: string[]) {
  if (!source?.hasSource) return "";
  const needle = `${title} ${outline.join(" ")}`.toLowerCase();
  const ranked = source.excerpts
    .map((item) => ({
      item,
      score: significantTokens(item.topic, 8).reduce(
        (sum, token) => sum + (needle.includes(token) ? 2 : 0),
        item.excerpt.toLowerCase().split(/\s+/).some((word) => needle.includes(word) && word.length > 4) ? 1 : 0,
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked.filter((entry) => entry.score > 0).slice(0, 2);
  if (best.length) return best.map((entry) => `### ${entry.item.topic}\n${entry.item.excerpt}`).join("\n\n");
  if (source.fullText) return source.fullText.slice(0, 6_000);
  return source.consolidated.slice(0, 6_000);
}

function excerptAround(text: string, topic: string, maxChars: number) {
  const index = text.toLowerCase().indexOf(topic.toLowerCase());
  if (index < 0) return text.slice(0, maxChars);
  const start = Math.max(0, index - 200);
  return text.slice(start, start + maxChars).trim();
}

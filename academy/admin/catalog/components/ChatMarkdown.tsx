"use client";

import { formatInlineMarkdown } from "../lib/formatInlineMarkdown";

/**
 * Compact chat markdown for the 300px Whitby sidebar.
 * Lesson bodies use justified text and large vertical rhythm — that stretches
 * words across a narrow bubble. Chat keeps left-aligned, wrapping text.
 */
export function ChatMarkdown({ content }: { content: string }) {
  const text = content.replace(/\r\n/g, "\n");
  if (!text.trim()) return null;

  return (
    <div className="whitby-chat-copy flex flex-col gap-[0.55rem]">
      {splitChatBlocks(text).map((block, index) => (
        <ChatBlock key={`${block.kind}-${index}`} block={block} />
      ))}
    </div>
  );
}

/** Live stream — plain wrapping text so layout does not jump while characters arrive. */
export function ChatStreamText({ content }: { content: string }) {
  return (
    <p className="whitby-chat-copy m-0 whitespace-pre-wrap">
      {content}
      <span className="whitby-caret" aria-hidden />
    </p>
  );
}

type ChatBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] };

function splitChatBlocks(text: string): ChatBlock[] {
  const chunks = text.trim().split(/\n{2,}/);
  const blocks: ChatBlock[] = [];

  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim());
    if (!lines.length) continue;

    if (lines.every((line) => isListLine(line))) {
      blocks.push({
        kind: "list",
        ordered: isOrderedLine(lines[0]),
        items: lines.map((line) => stripListMarker(line)).filter(Boolean),
      });
      continue;
    }

    blocks.push({ kind: "paragraph", lines: lines.map(stripHeadingHashes) });
  }

  return blocks;
}

function isOrderedLine(line: string) {
  return /^\d+[.)]\s+\S/.test(line.trim());
}

function isListLine(line: string) {
  const trimmed = line.trim();
  return /^([•*-]|\d+[.)])\s+\S/.test(trimmed);
}

function stripListMarker(line: string) {
  return line.trim().replace(/^([•*-]|\d+[.)])\s+/, "");
}

function stripHeadingHashes(line: string) {
  return line.replace(/^\s*#{1,6}\s+/, "").trim();
}

function ChatBlock({ block }: { block: ChatBlock }) {
  if (block.kind === "list") {
    return (
      <ul className="m-0 flex list-none flex-col gap-[0.35rem] p-0">
        {block.items.map((item, index) => (
          <li key={`${index}-${item.slice(0, 24)}`} className="flex gap-2">
            {block.ordered ? (
              <span
                className="w-4 shrink-0 pt-px text-[12px] tabular-nums"
                style={{ color: "var(--text-tertiary)" }}
              >
                {index + 1}.
              </span>
            ) : (
              <span
                className="mt-[0.55em] size-[5px] shrink-0 rounded-full"
                style={{ background: "var(--accent, #2383e2)" }}
              />
            )}
            <span className="min-w-0 flex-1">{formatInlineMarkdown(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="m-0">
      {block.lines.map((line, index) => (
        <span key={`${index}-${line.slice(0, 24)}`}>
          {index > 0 ? <br /> : null}
          {formatInlineMarkdown(line)}
        </span>
      ))}
    </p>
  );
}

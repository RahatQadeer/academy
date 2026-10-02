import { type ReactNode } from "react";

/**
 * Renders inline markdown: **bold**, ***bold***, ^^large^^, ,,small,,, and `code`.
 * Normalizes ***text*** (common AI mistake) to bold, and strips accidental
 * heading hashes inside bold tokens (`**## Title**` → Title).
 */
export function formatInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(`[^`\n]+`|\^\^[^\^\n]+?\^\^|,,[^,\n]+?,,|\*\*\*[^*\n]+?\*\*\*|\*\*[^*\n]+?\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(stripOrphanHeadingHashes(text.slice(lastIndex, match.index)));
    }

    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded-[4px] px-1 py-0.5 font-mono text-[0.92em]"
          style={{ background: "var(--surface-soft, #efefed)", color: "var(--ink)" }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("^^") && token.endsWith("^^")) {
      nodes.push(
        <span
          key={`${match.index}-large`}
          className="font-semibold tracking-[-0.01em]"
          style={{ fontSize: "1.15em" }}
        >
          {stripOrphanHeadingHashes(token.slice(2, -2))}
        </span>,
      );
    } else if (token.startsWith(",,") && token.endsWith(",,")) {
      nodes.push(
        <span key={`${match.index}-small`} style={{ fontSize: "0.875em" }}>
          {stripOrphanHeadingHashes(token.slice(2, -2))}
        </span>,
      );
    } else {
      const inner = token.startsWith("***") ? token.slice(3, -3) : token.slice(2, -2);
      nodes.push(
        <strong key={`${match.index}-bold`} className="font-bold">
          {stripOrphanHeadingHashes(inner)}
        </strong>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(stripOrphanHeadingHashes(text.slice(lastIndex)));
  }

  return nodes.length ? nodes : [stripOrphanHeadingHashes(text)];
}

/** Remove leading ATX hashes the model left inside body/bold text. */
function stripOrphanHeadingHashes(text: string): string {
  return text.replace(/^\s*#{1,6}\s*/, "").replace(/\s+#+\s*$/g, "").trimStart();
}

export function formatInlineMarkdownFragment(text: string) {
  return <>{formatInlineMarkdown(text)}</>;
}

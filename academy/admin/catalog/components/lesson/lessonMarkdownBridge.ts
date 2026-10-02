/**
 * Lightweight markdown ↔ HTML bridge for TipTap lesson editing.
 * Preserves fenced code/exercise blocks; maps common prose to HTML TipTap understands.
 */

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdownToHtml(text: string) {
  let out = escapeHtml(text);
  // Size markers (must run before bold/italic so nested marks stay intact).
  out = out.replace(
    /\^\^(.+?)\^\^/g,
    '<span data-font-size="large">$1</span>',
  );
  out = out.replace(
    /,,(.+?),,/g,
    '<span data-font-size="small">$1</span>',
  );
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/__(.+?)__/g, "<u>$1</u>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function proseChunkToHtml(chunk: string): string {
  const trimmed = chunk.trim();
  if (!trimmed) return "";

  const lines = trimmed.split("\n");
  const first = lines[0] ?? "";

  const heading = first.match(/^(#{1,3})\s+(.+)$/);
  if (heading && lines.length === 1) {
    const level = heading[1].length;
    return `<h${level}>${inlineMarkdownToHtml(heading[2].trim())}</h${level}>`;
  }
  if (heading) {
    const level = heading[1].length;
    const rest = lines.slice(1).join("\n").trim();
    const headingHtml = `<h${level}>${inlineMarkdownToHtml(heading[2].trim())}</h${level}>`;
    return rest ? `${headingHtml}${proseChunkToHtml(rest)}` : headingHtml;
  }

  // Mixed chunks (paragraph + list): split consecutive list runs so bullets survive.
  const mixed = splitMixedListChunk(lines);
  if (mixed) return mixed;

  if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
    const items = lines
      .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
      .map((item) => `<li><p>${inlineMarkdownToHtml(item)}</p></li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
    const items = lines
      .map((line) => line.replace(/^\s*\d+\.\s+/, "").trim())
      .map((item) => `<li><p>${inlineMarkdownToHtml(item)}</p></li>`)
      .join("");
    return `<ol>${items}</ol>`;
  }

  if (lines.every((line) => /^\s*>\s?/.test(line))) {
    const body = lines.map((line) => line.replace(/^\s*>\s?/, "")).join("\n");
    return `<blockquote><p>${inlineMarkdownToHtml(body)}</p></blockquote>`;
  }

  return `<p>${inlineMarkdownToHtml(trimmed.replace(/\n/g, " "))}</p>`;
}

function isBulletLine(line: string) {
  return /^\s*[-*]\s+/.test(line);
}

function isOrderedLine(line: string) {
  return /^\s*\d+\.\s+/.test(line);
}

/** If a chunk mixes prose and list lines, emit HTML for each run. */
function splitMixedListChunk(lines: string[]): string | null {
  const hasBullet = lines.some(isBulletLine);
  const hasOrdered = lines.some(isOrderedLine);
  if (!hasBullet && !hasOrdered) return null;
  if (lines.every(isBulletLine) || lines.every(isOrderedLine)) return null;

  const parts: string[] = [];
  let buffer: string[] = [];
  let mode: "prose" | "ul" | "ol" | null = null;

  const flush = () => {
    if (!buffer.length || !mode) return;
    if (mode === "ul") {
      parts.push(
        `<ul>${buffer
          .map((line) => `<li><p>${inlineMarkdownToHtml(line.replace(/^\s*[-*]\s+/, "").trim())}</p></li>`)
          .join("")}</ul>`,
      );
    } else if (mode === "ol") {
      parts.push(
        `<ol>${buffer
          .map((line) => `<li><p>${inlineMarkdownToHtml(line.replace(/^\s*\d+\.\s+/, "").trim())}</p></li>`)
          .join("")}</ol>`,
      );
    } else {
      const text = buffer.join(" ").trim();
      if (text) parts.push(`<p>${inlineMarkdownToHtml(text)}</p>`);
    }
    buffer = [];
  };

  for (const line of lines) {
    const next: "ul" | "ol" | "prose" = isBulletLine(line)
      ? "ul"
      : isOrderedLine(line)
        ? "ol"
        : "prose";
    if (mode && next !== mode) flush();
    mode = next;
    buffer.push(line);
  }
  flush();
  return parts.join("") || null;
}

export function markdownToEditorHtml(markdown: string): string {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) return "<p></p>";

  const fence = /```([\w-]*)\s*\n?([\s\S]*?)```/g;
  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) {
      const chunk = text.slice(last, match.index);
      for (const block of chunk.split(/\n{2,}/)) {
        const html = proseChunkToHtml(block);
        if (html) parts.push(html);
      }
    }
    const lang = (match[1] || "").trim();
    const code = match[2].replace(/\n$/, "");
    const classAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
    parts.push(`<pre><code${classAttr}>${escapeHtml(code)}</code></pre>`);
    last = fence.lastIndex;
  }

  if (last < text.length) {
    for (const block of text.slice(last).split(/\n{2,}/)) {
      const html = proseChunkToHtml(block);
      if (html) parts.push(html);
    }
  }

  return parts.length > 0 ? parts.join("") : "<p></p>";
}

function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function inlineHtmlToMarkdown(html: string): string {
  let out = html;
  out = out.replace(
    /<span[^>]*data-font-size="large"[^>]*>([\s\S]*?)<\/span>/gi,
    "^^$1^^",
  );
  out = out.replace(
    /<span[^>]*data-font-size="small"[^>]*>([\s\S]*?)<\/span>/gi,
    ",,$1,,",
  );
  out = out.replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**");
  out = out.replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**");
  out = out.replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*");
  out = out.replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*");
  out = out.replace(/<u>([\s\S]*?)<\/u>/gi, "__$1__");
  out = out.replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`");
  out = out.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/?span[^>]*>/gi, "");
  out = out.replace(/<\/?p[^>]*>/gi, "");
  out = out.replace(/<[^>]+>/g, "");
  return decodeHtml(out).trim();
}

export function editorHtmlToMarkdown(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p></p>" || trimmed === "<p><br></p>") return "";

  let working = trimmed
    .replace(/\r\n/g, "\n")
    .replace(/>\s+</g, "><");

  const blocks: string[] = [];

  // Extract in document order by walking top-level tags.
  const topLevel =
    /<(h[1-3]|p|ul|ol|blockquote|pre)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = topLevel.exec(working)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[3];

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const level = Number(tag[1]);
      blocks.push(`${"#".repeat(level)} ${inlineHtmlToMarkdown(inner)}`);
      continue;
    }

    if (tag === "pre") {
      const codeMatch = inner.match(/^<code(?:\s+class="language-([^"]*)")?[^>]*>([\s\S]*?)<\/code>$/i);
      if (codeMatch) {
        const lang = codeMatch[1] ?? "";
        const code = decodeHtml(codeMatch[2].replace(/<br\s*\/?>/gi, "\n"));
        blocks.push(`\`\`\`${lang}\n${code}\n\`\`\``);
      } else {
        blocks.push(`\`\`\`\n${decodeHtml(inner)}\n\`\`\``);
      }
      continue;
    }

    if (tag === "ul") {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) =>
        `- ${inlineHtmlToMarkdown(m[1])}`,
      );
      if (items.length) blocks.push(items.join("\n"));
      continue;
    }

    if (tag === "ol") {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m, i) =>
        `${i + 1}. ${inlineHtmlToMarkdown(m[1])}`,
      );
      if (items.length) blocks.push(items.join("\n"));
      continue;
    }

    if (tag === "blockquote") {
      const body = inlineHtmlToMarkdown(inner);
      blocks.push(
        body
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
      );
      continue;
    }

    if (tag === "p") {
      const text = inlineHtmlToMarkdown(inner);
      if (text) blocks.push(text);
    }
  }

  if (blocks.length === 0) {
    const fallback = inlineHtmlToMarkdown(working);
    return fallback;
  }

  return blocks.join("\n\n").trim();
}

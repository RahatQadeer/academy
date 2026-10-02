"use client";

import { useEffect, useMemo, useRef } from "react";
import { Mark, mergeAttributes } from "@tiptap/core";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import {
  editorHtmlToMarkdown,
  markdownToEditorHtml,
} from "./lessonMarkdownBridge";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: "large" | "small") => ReturnType;
      unsetFontSize: () => ReturnType;
      toggleFontSize: (size: "large" | "small") => ReturnType;
    };
  }
}

const FontSize = Mark.create({
  name: "fontSize",
  excludes: "fontSize",
  parseHTML() {
    return [{ tag: "span[data-font-size]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-font-size"),
        renderHTML: (attributes) => {
          if (!attributes.size) return {};
          const style =
            attributes.size === "large"
              ? "font-size: 1.2em; font-weight: 600; letter-spacing: -0.01em;"
              : attributes.size === "small"
                ? "font-size: 0.875em;"
                : undefined;
          return {
            "data-font-size": attributes.size,
            ...(style ? { style } : {}),
          };
        },
      },
    };
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ commands }) =>
          commands.setMark(this.name, { size }),
      unsetFontSize:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
      toggleFontSize:
        (size) =>
        ({ editor, commands }) => {
          if (editor.isActive(this.name, { size })) {
            return commands.unsetMark(this.name);
          }
          return commands.setMark(this.name, { size });
        },
    };
  },
});

const LESSON_DOC_PROSE_CSS = `
.lesson-doc-bubble {
  border-color: var(--border-strong, #d9d9d6);
  background: var(--surface, #fff);
  box-shadow: 0 10px 28px rgba(15,15,15,.14), 0 1px 2px rgba(15,15,15,.04);
}
.lesson-doc-prose {
  color: var(--ink, #37352f);
  font-size: 15.5px;
  line-height: 1.75;
  caret-color: var(--ink, #37352f) !important;
  cursor: text !important;
}
.lesson-doc-prose,
.lesson-doc-prose * {
  caret-color: var(--ink, #37352f) !important;
  cursor: text !important;
}
.lesson-doc-prose p { margin: 0 0 0.9em; }
.lesson-doc-prose h1,
.lesson-doc-prose h2,
.lesson-doc-prose h3 {
  color: var(--ink, #37352f);
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.25;
  margin: 1.2em 0 0.45em;
}
.lesson-doc-prose h1 { font-size: 1.55rem; }
.lesson-doc-prose h2 { font-size: 1.28rem; }
.lesson-doc-prose h3 { font-size: 1.1rem; }
.lesson-doc-prose ul,
.lesson-doc-prose ol {
  margin: 0 0 0.9em;
  padding-left: 1.5em;
  list-style-position: outside;
}
.lesson-doc-prose ul {
  list-style-type: disc !important;
}
.lesson-doc-prose ol {
  list-style-type: decimal !important;
}
.lesson-doc-prose li {
  margin: 0.25em 0;
  display: list-item;
}
.lesson-doc-prose li p {
  margin: 0;
}
.lesson-doc-prose blockquote {
  margin: 0 0 0.9em;
  padding: 0.55em 0.9em;
  border-left: 3px solid var(--accent, #2383e2);
  background: var(--surface-subtle, #fbfbfa);
  color: var(--text-secondary, rgba(55, 53, 47, 0.65));
  border-radius: 0 8px 8px 0;
}
.lesson-doc-prose pre {
  margin: 0 0 0.9em;
  padding: 0.85em 1em;
  border-radius: 8px;
  background: var(--surface-soft, #f7f7f5);
  border: 1px solid var(--border, #ececea);
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.55;
}
.lesson-doc-prose code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
}
.lesson-doc-prose p code {
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--surface-soft, #f7f7f5);
}
.lesson-doc-prose a {
  color: var(--accent, #2383e2);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.lesson-doc-prose .is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--text-tertiary, rgba(55, 53, 47, 0.45));
}
.lesson-doc-prose span[data-font-size="large"] {
  font-size: 1.2em;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.lesson-doc-prose span[data-font-size="small"] {
  font-size: 0.875em;
}
`;

export function LessonDocEditor({
  value,
  disabled,
  autofocus,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  autofocus?: boolean;
  onChange: (markdown: string) => void;
}) {
  const lastEmitted = useRef(value);
  const applyingExternal = useRef(false);
  const initialHtml = useMemo(() => markdownToEditorHtml(value), []); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autofocus ? "start" : false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      FontSize,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: "Start writing… Select text to format.",
      }),
    ],
    content: initialHtml,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "lesson-doc-prose outline-none min-h-[280px] px-1 py-1",
      },
    },
    onUpdate: ({ editor: next }) => {
      if (applyingExternal.current) return;
      const markdown = editorHtmlToMarkdown(next.getHTML());
      lastEmitted.current = markdown;
      onChange(markdown);
    },
  });

  useEffect(() => {
    if (!editor || !autofocus || disabled) return;
    const timer = window.setTimeout(() => {
      editor.commands.focus("start");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autofocus, disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    const current = editorHtmlToMarkdown(editor.getHTML());
    if (value === current) {
      lastEmitted.current = value;
      return;
    }
    // External replace (lesson switch / Whitby rewrite) — do not fight live typing.
    lastEmitted.current = value;
    applyingExternal.current = true;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(markdownToEditorHtml(value), false);
    const max = editor.state.doc.content.size;
    const nextFrom = Math.max(1, Math.min(from, max));
    const nextTo = Math.max(1, Math.min(to, max));
    editor.commands.setTextSelection({ from: nextFrom, to: nextTo });
    applyingExternal.current = false;
  }, [editor, value]);

  return (
    <div
      className="relative rounded-[12px] border px-4 py-5 sm:px-6 sm:py-6"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04)",
      }}
      onMouseDown={(event) => {
        if (!editor || disabled) return;
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest(".lesson-doc-bubble")) return;
        if (target.closest(".ProseMirror")) return;
        event.preventDefault();
        const pos = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (pos) {
          editor.chain().focus().setTextSelection(pos.pos).run();
        } else {
          editor.chain().focus("end").run();
        }
      }}
    >
      {editor ? (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100, placement: "top", offset: [0, 8] }}
          shouldShow={({ editor: current, state }) => {
            if (!current.isEditable || disabled) return false;
            const { empty, from, to } = state.selection;
            if (empty || from === to) return false;
            // Avoid showing over code blocks where marks don't apply cleanly.
            if (current.isActive("codeBlock")) return false;
            return true;
          }}
          className="lesson-doc-bubble flex items-center gap-0.5 rounded-[10px] border px-1.5 py-1"
        >
          <FormatToolbar editor={editor} />
        </BubbleMenu>
      ) : null}

      <EditorContent editor={editor} />
      <style>{LESSON_DOC_PROSE_CSS}</style>
    </div>
  );
}

function FormatToolbar({ editor }: { editor: Editor }) {
  return (
    <>
      <ToolbarBtn
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => applyMark(editor, () => editor.chain().focus().toggleBold().run())}
      >
        <span className="font-bold">B</span>
      </ToolbarBtn>
      <ToolbarBtn
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => applyMark(editor, () => editor.chain().focus().toggleItalic().run())}
      >
        <span className="italic">I</span>
      </ToolbarBtn>
      <ToolbarBtn
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => applyMark(editor, () => editor.chain().focus().toggleUnderline().run())}
      >
        <span className="underline">U</span>
      </ToolbarBtn>
      <ToolbarDivider />
      <ToolbarBtn
        label="Larger text"
        active={editor.isActive("fontSize", { size: "large" })}
        onClick={() =>
          applyMark(editor, () => editor.chain().focus().toggleFontSize("large").run())
        }
      >
        <span className="text-[13px] font-semibold leading-none">A</span>
      </ToolbarBtn>
      <ToolbarBtn
        label="Smaller text"
        active={editor.isActive("fontSize", { size: "small" })}
        onClick={() =>
          applyMark(editor, () => editor.chain().focus().toggleFontSize("small").run())
        }
      >
        <span className="text-[10px] font-semibold leading-none">A</span>
      </ToolbarBtn>
      <ToolbarDivider />
      <ToolbarBtn
        label="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          applyMark(editor, () => editor.chain().focus().toggleHeading({ level: 2 }).run())
        }
      >
        H
      </ToolbarBtn>
      <ToolbarBtn
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => applyMark(editor, () => editor.chain().focus().toggleBulletList().run())}
      >
        <span aria-hidden>•</span>
      </ToolbarBtn>
      <ToolbarBtn
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => applyMark(editor, () => editor.chain().focus().toggleOrderedList().run())}
      >
        1.
      </ToolbarBtn>
      <ToolbarDivider />
      <ToolbarBtn
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const { from, to } = editor.state.selection;
          if (from === to) return;
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", prev ?? "https://");
          if (url === null) return;
          if (!url.trim()) {
            editor.chain().focus().setTextSelection({ from, to }).unsetLink().run();
            return;
          }
          editor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .setLink({ href: url.trim() })
            .run();
        }}
      >
        ↗
      </ToolbarBtn>
    </>
  );
}

/** Apply a mark only to the current non-empty selection (never the whole doc). */
function applyMark(editor: Editor, run: () => void) {
  const { from, to, empty } = editor.state.selection;
  if (empty || from === to) return;
  run();
}

function ToolbarBtn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      /* Keep editor selection — otherwise bold/list apply to the wrong place. */
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-[6px] text-[12.5px] font-semibold disabled:opacity-40"
      style={{
        background: active ? "var(--accent-tint-mid, #f4f9fe)" : "transparent",
        color: active ? "var(--accent, #2383e2)" : "var(--ink)",
      }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <span
      className="mx-0.5 h-4 w-px"
      style={{ background: "var(--border-strong)" }}
      aria-hidden
    />
  );
}

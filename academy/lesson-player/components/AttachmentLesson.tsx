import type { LessonMedia } from "../types";

export function AttachmentLesson({ media }: { media: LessonMedia }) {
  const href = media.signedUrl ?? media.externalUrl;
  const label = media.fileName ? media.fileName : "Open attachment";

  return (
    <div
      className="flex items-start gap-4 rounded-[12px] px-5 py-5"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" }}
        aria-hidden
      >
        <FileGlyph />
      </span>
      <div className="min-w-0 flex-1">
        {href ? (
          <>
            <p className="text-[15px] font-medium">{label}</p>
            <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {media.signedUrl
                ? "Authorized file for this lesson."
                : "This attachment is stored as an external link."}
            </p>
            <a
              href={href}
              className="mt-3 inline-flex rounded-[6px] px-3 py-[8px] text-[13.5px] font-medium no-underline"
              style={{ background: "var(--accent)", color: "#fff" }}
              rel={media.externalUrl ? "noreferrer" : undefined}
            >
              Open file
            </a>
          </>
        ) : (
          <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            This attachment is not available.
          </p>
        )}
      </div>
    </div>
  );
}

function FileGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M5 2.5h4.2L13 6.3V13a1.5 1.5 0 0 1-1.5 1.5h-6.5A1.5 1.5 0 0 1 3.5 13V4A1.5 1.5 0 0 1 5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9.2 2.5V6.3H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

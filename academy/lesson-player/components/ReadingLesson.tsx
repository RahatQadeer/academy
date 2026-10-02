import type { LessonMedia } from "../types";

export function ReadingLesson({ media }: { media: LessonMedia }) {
  if (media.readingText) {
    return (
      <div className="whitespace-pre-wrap font-sans text-[16px] leading-[1.8] text-pretty">
        {media.readingText}
      </div>
    );
  }

  if (media.signedUrl) {
    return (
      <div
        className="rounded-[12px] px-5 py-5"
        style={{ border: "1px solid var(--border)", background: "var(--surface-soft)" }}
      >
        <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          This reading is a file. Open it to continue the lesson.
        </p>
        <a
          href={media.signedUrl}
          className="mt-4 inline-flex text-[13.5px] font-medium no-underline hover:text-accent-hover"
          style={{ color: "var(--accent)" }}
        >
          Open reading file{media.fileName ? ` (${media.fileName})` : ""}
        </a>
      </div>
    );
  }

  if (media.externalUrl) {
    return (
      <div
        className="rounded-[12px] px-5 py-5"
        style={{ border: "1px solid var(--border)", background: "var(--surface-soft)" }}
      >
        <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          This reading is available at an external source.
        </p>
        <a
          href={media.externalUrl}
          className="mt-4 inline-flex text-[13.5px] font-medium no-underline hover:text-accent-hover"
          style={{ color: "var(--accent)" }}
          rel="noreferrer"
        >
          Open reading source
        </a>
      </div>
    );
  }

  return (
    <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
      No reading content is stored for this lesson.
    </p>
  );
}

import type { ReactNode } from "react";

const FRAME_SHADOW = "0 1px 2px rgba(15,15,15,.05), 0 12px 32px rgba(15,15,15,.06)";

export function LessonMediaFrame({
  kind,
  caption,
  children,
}: {
  kind: "image" | "video";
  caption?: string;
  children: ReactNode;
}) {
  return (
    <figure
      className="overflow-hidden rounded-[12px]"
      style={{
        border: "1px solid var(--border-strong)",
        boxShadow: FRAME_SHADOW,
        background: kind === "video" ? "#1b1a18" : "var(--surface)",
      }}
    >
      {kind === "image" ? (
        <div className="p-2 sm:p-2.5" style={{ background: "var(--surface-soft)" }}>
          {children}
        </div>
      ) : (
        <div className="relative overflow-hidden bg-[#1b1a18]">{children}</div>
      )}
      {caption ? (
        <figcaption
          className="border-t px-4 py-2.5 text-[12.5px] leading-relaxed"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--text-secondary)",
          }}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

import Link from "next/link";
import type { LearnerResourceItem } from "../types";

function typeTone(type: string) {
  const key = type.toLowerCase();
  if (key.includes("template") || key.includes("guide")) {
    return {
      background: "var(--module-academy-bg)",
      color: "var(--module-academy-fg)",
      edge: "var(--module-academy-fg)",
    };
  }
  if (key.includes("video") || key.includes("media")) {
    return {
      background: "var(--module-whitby-bg)",
      color: "var(--module-whitby-fg)",
      edge: "var(--module-whitby-fg)",
    };
  }
  if (key.includes("sheet") || key.includes("spreadsheet") || key.includes("csv")) {
    return {
      background: "var(--success-bg)",
      color: "var(--success-fg)",
      edge: "var(--success-fg)",
    };
  }
  if (key.includes("pdf") || key.includes("doc")) {
    return {
      background: "var(--info-bg)",
      color: "var(--info-fg)",
      edge: "var(--info-fg)",
    };
  }
  if (key.includes("link") || key.includes("url")) {
    return {
      background: "#f1e9db",
      color: "#8a6f3e",
      edge: "#8a6f3e",
    };
  }
  return {
    background: "var(--surface-soft)",
    color: "var(--text-secondary)",
    edge: "var(--accent)",
  };
}

function ResourceIcon({ type }: { type: string }) {
  const key = type.toLowerCase();
  if (key.includes("video") || key.includes("media")) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <rect x="2.5" y="4" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 7.2v3.6L11.2 9 8 7.2z" fill="currentColor" />
      </svg>
    );
  }
  if (key.includes("link") || key.includes("url")) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <path
          d="M7.2 10.8l3.6-3.6M6.2 8.4l-1.1 1.1a2.6 2.6 0 003.7 3.7l1.1-1.1M11.8 9.6l1.1-1.1a2.6 2.6 0 00-3.7-3.7L8.1 5.9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (key.includes("sheet") || key.includes("csv")) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <rect x="3" y="3" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3 7.5h12M3 11h12M7.5 3v12M11 3v12" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M5 3.5h5.2L13.5 7v7.5a1 1 0 01-1 1H5a1 1 0 01-1-1v-10a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10 3.5V7h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function ResourceList({ items }: { items: LearnerResourceItem[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const tone = typeTone(item.resourceType);
        const body = (
          <>
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-[3px] rounded-l-[14px]"
              style={{ background: tone.edge, opacity: 0.8 }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `linear-gradient(150deg, ${tone.background} 0%, transparent 42%)`,
              }}
            />

            <div className="relative flex items-start gap-3.5">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-line bg-surface transition-transform duration-200 group-hover:scale-105"
                style={{ color: tone.color, boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
                aria-hidden
              >
                <ResourceIcon type={item.resourceType} />
              </span>
              <div className="min-w-0 flex-1">
                <span
                  className="inline-flex rounded-[5px] px-2 py-[2px] text-[10.5px] font-semibold"
                  style={{ background: tone.background, color: tone.color }}
                >
                  {item.resourceType}
                </span>
                <h3 className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.18px] text-pretty transition-colors duration-200 group-hover:text-accent">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                  {item.moduleTitle}
                  <span className="mx-1.5 opacity-50" aria-hidden>
                    ·
                  </span>
                  {item.lessonTitle}
                </p>
                {item.notes.trim() ? (
                  <p
                    className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-justify text-pretty"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {item.notes}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5">
              <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {item.url ? "Open in new tab" : "No link attached"}
              </span>
              {item.url ? (
                <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent">
                  Open
                  <span
                    aria-hidden
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </span>
              ) : null}
            </div>
          </>
        );

          const shellClass =
          "group academy-learner-card relative flex h-full flex-col overflow-hidden rounded-[16px] border border-line bg-surface p-4 text-ink no-underline sm:p-5";

        return (
          <li key={item.id}>
            {item.url ? (
              <Link href={item.url} target="_blank" rel="noreferrer" className={shellClass}>
                {body}
              </Link>
            ) : (
              <div className={shellClass}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

import Link from "next/link";
import type { Answer } from "@/whitbyos/lib/ask";

export function proseLength(answer: Answer) {
  return [answer.note, answer.lead, ...answer.sections.flatMap((section) => section.bullets)]
    .filter(Boolean)
    .join("\n").length;
}

export function AskReply({ answer }: { answer: Answer; reveal?: number }) {
  if (answer.note && !answer.lead) {
    return (
      <div className="ask-reply">
        <p className="ask-reply-note">{answer.note}</p>
      </div>
    );
  }

  return (
    <div className="ask-reply">
      {answer.lead ? <p className="ask-reply-lead">{answer.lead}</p> : null}

      {answer.sections.map((section) => (
        <div key={section.heading} className="ask-reply-section">
          <p className="ask-reply-heading">{section.heading}</p>
          <ul className="m-0 flex list-none flex-col p-0">
            {section.bullets.map((bit) => (
              <li key={bit} className="ask-reply-item">
                <span className="ask-reply-dot" aria-hidden />
                <span>{bit}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {answer.groups.map((group) => (
        <div key={group.heading} className="ask-reply-group">
          <p className="ask-reply-heading">{group.heading}</p>
          <div className="flex flex-col gap-0.5">
            {group.rows.map((row) => (
              <Link
                key={row.id}
                href={row.href ?? "#"}
                className="flex items-center gap-2.5 rounded-control px-1 py-1.5 no-underline hover:bg-[var(--surface)]"
                style={{ color: "var(--ink)" }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-[10px] font-bold"
                  style={{ background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }}
                >
                  {row.glyph}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]">
                  {row.label}
                  {row.detail ? (
                    <span style={{ color: "var(--text-tertiary)" }}> · {row.detail}</span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {answer.open ? (
        <Link href={answer.open.href} className="ask-reply-open">
          {answer.open.label}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}

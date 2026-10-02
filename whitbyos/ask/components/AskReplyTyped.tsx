"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Answer } from "@/whitbyos/lib/ask";
import { AskReply, proseLength } from "@/whitbyos/ask/components/AskReply";
import { useAskLive } from "@/whitbyos/ask/components/AskLive";

/**
 * Types the lead (and note) in, so a finished answer does not just appear.
 * Cards / sections land after the lead has finished.
 */
export function AskReplyTyped({ id, answer }: { id: string; answer: Answer }) {
  const live = useAskLive(id);
  const full = answer.note && !answer.lead ? answer.note : answer.lead;
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(() => proseLength(answer) === 0);

  useEffect(() => {
    if (!live) return;
    if (!full) {
      setDone(true);
      return;
    }
    setShown(0);
    setDone(false);
    let i = 0;
    const step = Math.max(1, Math.ceil(full.length / 60));
    const id = window.setInterval(() => {
      i = Math.min(full.length, i + step);
      setShown(i);
      if (i >= full.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, 18);
    return () => window.clearInterval(id);
  }, [full, live]);

  /*
   * An answer that was already on the page is just an answer.
   *
   * The typewriter is the model writing; replaying it on a thread somebody
   * has only opened says something is happening when nothing is, and makes
   * a conversation they came back to read unreadable until it finishes.
   */
  if (!live) return <AskReply answer={answer} />;

  if (answer.note && !answer.lead) {
    return (
      <div className="ask-reply">
        <p className="ask-reply-note">
          {full.slice(0, shown)}
          {!done ? <span className="ask-caret" aria-hidden /> : null}
        </p>
      </div>
    );
  }

  return (
    <div className="ask-reply">
      {answer.lead ? (
        <p className="ask-reply-lead">
          {answer.lead.slice(0, shown)}
          {!done ? <span className="ask-caret" aria-hidden /> : null}
        </p>
      ) : null}

      {done
        ? answer.sections.map((section) => (
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
          ))
        : null}

      {done
        ? answer.groups.map((group) => (
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
                      style={{
                        background: "var(--avatar-blue-bg)",
                        color: "var(--avatar-blue-fg)",
                      }}
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
          ))
        : null}

      {done && answer.open ? (
        <Link href={answer.open.href} className="ask-reply-open">
          {answer.open.label}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}

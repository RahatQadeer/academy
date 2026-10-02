"use client";

import { useState, useTransition } from "react";
import { startAskChat } from "@/whitbyos/ask/actions";
import { AskComposer } from "@/whitbyos/ask/components/AskComposer";
import { AskMark, AskThinking } from "@/whitbyos/ask/components/AskThinking";
import { AskTranscript } from "@/whitbyos/ask/components/AskTranscript";

const STARTERS = [
  {
    q: "Create a work plan for the open client",
    label: "New work plan",
    hint: "Name, client, request",
    icon: "next" as const,
  },
  {
    q: "Create a task and assign it to me",
    label: "New task",
    hint: "Title, client, owner, due",
    icon: "today" as const,
  },
  {
    q: "What is overdue?",
    label: "What's overdue?",
    hint: "Past due tasks and requests",
    icon: "clock" as const,
  },
  {
    q: "Summarise open requests",
    label: "Open requests",
    hint: "What is still in motion",
    icon: "list" as const,
  },
];

/**
 * Landing for Ask Whitby: starters and the first send stay on this page,
 * show the asked line + thinking dots, then the server action redirects into
 * the thread once Whitby has answered.
 *
 * Composer stays pinned at the bottom in every state — never unmounts into a
 * feed that can clip it.
 */
export function AskLanding() {
  const [asked, setAsked] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setAsked(q);
    startTransition(async () => {
      const data = new FormData();
      data.set("q", q);
      await startAskChat(data);
    });
  }

  if (asked) {
    return (
      <div className="ask-chat-shell flex min-h-0 flex-1 flex-col overflow-hidden">
        <AskTranscript>
          <div className="ask-feed">
            <div className="ask-column mx-auto flex w-full flex-col gap-5 px-6 pb-6 pt-14">
              <div className="flex justify-end">
                <div className="ask-asked">{asked}</div>
              </div>
              <AskThinking />
            </div>
          </div>
        </AskTranscript>
        <div className="ask-composer-bar">
          <div className="ask-column mx-auto px-6">
            <AskComposer placeholder="Whitby is working…" busy />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ask-chat-shell flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="ask-landing flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-8">
        <div className="ask-composer-hero w-full text-center">
          <div className="ask-landing-mark mx-auto mb-3" aria-hidden>
            <AskMark />
          </div>
          <h1 className="ask-landing-title text-wrap-pretty">What do you need?</h1>
          <p className="ask-landing-blurb mx-auto mt-1.5">
            Ask about this workspace, or tell Whitby to create a work plan, task,
            client, request or group, add somebody to a client, or send a message.
          </p>
          <div className="ask-starters mt-6">
            {STARTERS.map((starter) => (
              <button
                key={starter.q}
                type="button"
                className="ask-starter"
                disabled={pending}
                onClick={() => run(starter.q)}
              >
                <span className="ask-starter-glyph" aria-hidden>
                  <StarterIcon kind={starter.icon} />
                </span>
                <span className="ask-starter-copy">
                  <span className="ask-starter-label">{starter.label}</span>
                  <span className="ask-starter-hint">{starter.hint}</span>
                </span>
                <span className="ask-starter-arrow" aria-hidden>
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="ask-composer-bar">
        <div className="ask-column mx-auto px-6">
          <AskComposer
            placeholder="Ask Whitby anything…"
            onSend={(q) => run(q)}
          />
        </div>
      </div>
    </div>
  );
}

function StarterIcon({ kind }: { kind: "clock" | "today" | "list" | "next" }) {
  if (kind === "clock") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5.2V8l2 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "today") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2.5" y="3.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "list") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M4 4.5h8M4 8h8M4 11.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

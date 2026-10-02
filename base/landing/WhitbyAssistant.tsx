"use client";

import { useEffect, useRef } from "react";
import { ASSISTANT_PROMPTS, ASSISTANT_SHORTCUTS } from "@/base/landing/content";
import { cn } from "@/base/lib/cn";
import { Monogram } from "@/base/landing/brand/Monogram";
import {
  IconApproved,
  IconClose,
  IconSend,
  IconWhitby,
  IconArrow,
} from "@/base/landing/brand/Icons";

type ChatMessage = { from: "user" | "bot"; text: string };

type WhitbyAssistantProps = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  messages: ChatMessage[];
};

export function WhitbyAssistant({
  open,
  onClose,
  onNewChat,
  input,
  onInputChange,
  onSend,
  messages,
}: WhitbyAssistantProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const previous = document.body.style.overflow;
    if (mq.matches) document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 220);

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  if (!open) return null;

  const hasConversation = messages.length > 0;

  return (
    <>
      <button
        type="button"
        aria-label="Close Whitby assistant"
        className="fixed inset-0 z-[160] bg-pa-ink/25 backdrop-blur-[1px] md:bg-pa-ink/10"
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        className={cn(
          "whitby-assistant-panel fixed top-0 left-0 z-[170] flex h-[100svh] w-full max-w-[420px] flex-col border-r border-pa-line bg-[linear-gradient(180deg,#ffffff_0%,#faf8f9_58%,#ece6ea_100%)] shadow-[8px_0_40px_rgba(23,24,26,.08)]",
          "animate-[assistant-slide_0.32s_cubic-bezier(0.16,1,0.3,1)_both]",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Ask Whitby"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pa-blue">
              <Monogram size={18} variant="cream" />
            </div>
            <div className="text-[17px] font-bold tracking-[-0.2px]">Ask Whitby</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewChat}
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-pa-muted transition duration-200 hover:bg-white/80 hover:text-pa-ink"
            >
              + New chat
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-pa-muted transition duration-200 hover:bg-white/80 hover:text-pa-ink"
              aria-label="Close"
            >
              <IconClose size={18} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5">
          {!hasConversation ? (
            <>
              <div className="pt-6 pb-5">
                <h2 className="mb-2 text-[clamp(28px,4vw,34px)] font-bold leading-[1.12] tracking-[-1px] text-pa-ink">
                  Let&apos;s plan the next engagement
                </h2>
                <p className="max-w-[320px] text-[14.5px] leading-relaxed text-pa-muted">
                  Draft a relocation, board packet, or residence opening. Whitby
                  scopes it with you.
                </p>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                {ASSISTANT_SHORTCUTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onSend(item.prompt)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#eef1f4] px-3.5 py-2.5 text-[12.5px] font-semibold text-pa-ink/80 transition duration-200 hover:bg-[#e5ebf1]"
                  >
                    {item.icon === "approved" ? (
                      <IconApproved size={14} />
                    ) : item.icon === "whitby" ? (
                      <IconWhitby size={14} />
                    ) : (
                      <IconArrow size={14} className="rotate-[-90deg]" />
                    )}
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div ref={listRef} className="flex flex-1 flex-col gap-3 pt-2 pb-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.from}-${index}-${message.text.slice(0, 24)}`}
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed",
                    message.from === "user"
                      ? "self-end bg-pa-ink text-white"
                      : "self-start bg-white text-pa-ink shadow-[0_1px_0_rgba(23,24,26,.04)] ring-1 ring-pa-line",
                  )}
                >
                  {message.text}
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto">
            <div className="whitby-assistant-composer group relative rounded-[22px] border border-pa-line bg-white shadow-[0_10px_30px_rgba(23,24,26,.07)] transition duration-200 focus-within:border-pa-blue">
              <textarea
                ref={inputRef}
                value={input}
                rows={3}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onSend();
                  }
                }}
                placeholder="e.g., Plan a weekend engagement in Barcelona"
                className="block w-full resize-none rounded-[22px] bg-transparent px-4 pt-4 pb-14 font-sans text-[14.5px] leading-relaxed text-pa-ink outline-none placeholder:text-pa-muted/70 focus:outline-none focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => onSend()}
                disabled={!input.trim()}
                className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full bg-pa-ink text-white transition duration-200 hover:bg-black focus-visible:outline-offset-2 disabled:cursor-default disabled:bg-pa-ink/40"
                aria-label="Send"
              >
                <IconSend size={16} />
              </button>
            </div>
            <p className="mt-2.5 px-1 text-[12px] text-pa-muted">
              Tip: mention a module like Portal, Academy, or Partner Center
            </p>

            {!hasConversation && (
              <div className="mt-7">
                <div className="mb-1 text-[15px] font-bold">Ask anything</div>
                <div className="divide-y divide-pa-line/80">
                  {ASSISTANT_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onSend(prompt)}
                      className="flex w-full items-start gap-3 py-3.5 text-left transition duration-200 hover:text-pa-blue-dark"
                    >
                      <IconArrow size={15} className="mt-0.5 text-pa-muted" />
                      <span className="text-[14px] leading-snug text-pa-ink/80">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

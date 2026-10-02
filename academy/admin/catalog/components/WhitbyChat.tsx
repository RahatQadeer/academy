"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMarkdown, ChatStreamText } from "./ChatMarkdown";
import { ThinkingDots } from "./ThinkingDots";

export type WhitbyPlan = {
  token: string;
  /** Signed payload so Apply works across Vercel instances. */
  payload?: string;
  steps: string[];
  risk: "low" | "medium" | "high";
};

export type WhitbyReply = {
  text: string;
  plan?: WhitbyPlan;
};

export type WhitbyMessage = {
  id: string;
  role: "user" | "whitby";
  content: string;
  /** When present, render an [Apply] / [Cancel] approval card. */
  plan?: WhitbyPlan;
  /** Set once the instructor resolves the plan, so the card can't fire twice. */
  resolution?: "applied" | "cancelled";
};

export function whitbyPendingLabel(instruction: string) {
  const text = instruction.toLowerCase();
  if (/\b(remove|delete|drop|take out|get rid of)\b/.test(text)) return "Updating the outline";
  if (/\brename\b/.test(text)) return "Updating the title";
  if (/\?$/.test(text.trim()) || /^(what|who|why|how|which|where|when)\b/.test(text)) {
    return "Whitby is answering";
  }
  if (/quiz|question/.test(text)) return "Quiz agent is drafting questions";
  if (/assignment|rubric/.test(text)) return "Assignment agent is writing the brief";
  if (/scenario|case/.test(text)) return "Lesson agent is writing a scenario";
  if (/video|youtube/.test(text)) return "Video agent is adding a lesson";
  if (/module|section/.test(text)) return "Structure agent is adding a module";
  if (/lesson|reading/.test(text)) return "Lesson agent is writing content";
  if (/title|description/.test(text)) return "Overview agent is updating the program";
  return "Whitby is applying your instruction";
}

export function WhitbyChat({
  messages: controlledMessages,
  onMessagesChange,
  initialMessages = [],
  placeholder = "Tell Whitby what to change...",
  suggestions = [],
  onSend,
  onApprovePlan,
}: {
  messages?: WhitbyMessage[];
  onMessagesChange?: (messages: WhitbyMessage[]) => void;
  initialMessages?: WhitbyMessage[];
  placeholder?: string;
  suggestions?: string[];
  onSend?: (message: string) => Promise<string | WhitbyReply | null>;
  /** Apply a confirmed plan. ok:false keeps Apply available for retry. */
  onApprovePlan?: (
    token: string,
    payload?: string,
  ) => Promise<{ ok: boolean; message: string } | string | null>;
}) {
  const [internalMessages, setInternalMessages] = useState<WhitbyMessage[]>(initialMessages);
  const messages = controlledMessages ?? internalMessages;
  const setMessages = onMessagesChange ?? setInternalMessages;
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingHint, setPendingHint] = useState("Whitby is thinking");
  const [composerFocused, setComposerFocused] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef(messages);
  const stickToBottomRef = useRef(true);
  const mountedRef = useRef(false);
  const streamGenRef = useRef(0);
  const streamFrameRef = useRef(0);
  messagesRef.current = messages;

  const canSend = Boolean(input.trim()) && !pending;
  const conversation = messages.filter((message) => message.id !== "welcome");
  const welcome = messages.find((message) => message.id === "welcome");
  const showEmpty = messages.length === 0;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const overflows = node.scrollHeight > node.clientHeight + 8;
    if (!overflows) {
      node.scrollTop = 0;
      mountedRef.current = true;
      return;
    }

    const hasConversation = messages.some(
      (message) => message.id !== "welcome" && Boolean(message.content.trim() || message.plan),
    );

    if (!mountedRef.current) {
      mountedRef.current = true;
      if (hasConversation) node.scrollTop = node.scrollHeight;
      return;
    }

    if (!stickToBottomRef.current && !pending && !streamingId) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: pending || streamingId ? "auto" : "smooth",
    });
  }, [messages, pending, streamingId]);

  useEffect(() => {
    const node = composerRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 22), 110)}px`;
  }, [input]);

  function onTranscriptScroll() {
    const node = scrollRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 56;
  }

  function appendMessage(message: WhitbyMessage) {
    const next = [...messagesRef.current, message];
    messagesRef.current = next;
    setMessages(next);
  }

  function updateMessage(id: string, patch: Partial<WhitbyMessage>) {
    const next = messagesRef.current.map((message) =>
      message.id === id ? { ...message, ...patch } : message,
    );
    messagesRef.current = next;
    setMessages(next);
  }

  function prefersReducedMotion() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function pinTranscriptToBottom() {
    const node = scrollRef.current;
    if (!node || !stickToBottomRef.current) return;
    node.scrollTop = node.scrollHeight;
  }

  async function revealText(id: string, text: string, plan?: WhitbyPlan) {
    const gen = ++streamGenRef.current;
    if (streamFrameRef.current) {
      cancelAnimationFrame(streamFrameRef.current);
      streamFrameRef.current = 0;
    }

    if (prefersReducedMotion() || !text.trim()) {
      setStreamedText("");
      setStreamingId(null);
      updateMessage(id, { content: text, plan });
      return;
    }

    setStreamingId(id);
    setStreamedText(text.slice(0, 1));
    pinTranscriptToBottom();

    // Keep the reveal on local chat state so the course builder does not
    // re-render on every character. Time-based rAF = even ChatGPT-like flow.
    const charsPerSecond = text.length < 120 ? 92 : 80;
    const started = performance.now();

    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        if (streamGenRef.current !== gen) {
          resolve();
          return;
        }
        const elapsed = now - started;
        const count = Math.min(
          text.length,
          Math.max(1, Math.floor((elapsed / 1000) * charsPerSecond)),
        );
        setStreamedText(text.slice(0, count));
        pinTranscriptToBottom();
        if (count < text.length) {
          streamFrameRef.current = requestAnimationFrame(step);
        } else {
          streamFrameRef.current = 0;
          resolve();
        }
      };
      streamFrameRef.current = requestAnimationFrame(step);
    });

    if (streamGenRef.current !== gen) return;
    updateMessage(id, { content: text, plan });
    setStreamedText("");
    setStreamingId((current) => (current === id ? null : current));
  }

  useEffect(() => {
    return () => {
      streamGenRef.current += 1;
      if (streamFrameRef.current) cancelAnimationFrame(streamFrameRef.current);
    };
  }, []);

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || pending) return;
    stickToBottomRef.current = true;
    const userMessage: WhitbyMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    appendMessage(userMessage);
    setInput("");
    if (!onSend) return;

    const replyId = crypto.randomUUID();
    appendMessage({ id: replyId, role: "whitby", content: "" });
    setPendingHint(whitbyPendingLabel(trimmed));
    setPending(true);
    try {
      const reply = await onSend(trimmed);
      if (reply) {
        const normalized: WhitbyReply = typeof reply === "string" ? { text: reply } : reply;
        await revealText(replyId, normalized.text, normalized.plan);
      } else {
        const next = messagesRef.current.filter((message) => message.id !== replyId);
        messagesRef.current = next;
        setMessages(next);
      }
    } catch {
      updateMessage(replyId, {
        content:
          "I couldn’t finish that request. Try a shorter instruction, like adding a quiz or editing the selected lesson.",
      });
    } finally {
      setStreamingId(null);
      setPending(false);
    }
  }

  async function resolvePlan(message: WhitbyMessage, decision: "apply" | "cancel") {
    if (!message.plan || message.resolution || pending) return;

    if (decision === "cancel") {
      updateMessage(message.id, { resolution: "cancelled" });
      const replyId = crypto.randomUUID();
      appendMessage({ id: replyId, role: "whitby", content: "" });
      setPending(true);
      try {
        await revealText(replyId, "Cancelled — nothing was changed.");
      } finally {
        setStreamingId(null);
        setPending(false);
      }
      return;
    }

    const replyId = crypto.randomUUID();
    appendMessage({ id: replyId, role: "whitby", content: "" });
    setPendingHint("Applying changes");
    setPending(true);
    try {
      const raw = onApprovePlan
        ? await onApprovePlan(message.plan.token, message.plan.payload)
        : { ok: true, message: "Applied your changes." };
      const result =
        typeof raw === "string" || raw == null
          ? {
              ok: Boolean(raw && !/expired|could not be applied|couldn’t apply|could not apply/i.test(raw)),
              message: raw || "Applied your changes.",
            }
          : raw;
      if (result.ok) {
        updateMessage(message.id, { resolution: "applied" });
      }
      await revealText(replyId, result.message || (result.ok ? "Applied your changes." : "That change could not be applied."));
    } catch {
      await revealText(replyId, "I couldn’t apply that change. Please try again.");
    } finally {
      setStreamingId(null);
      setPending(false);
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: "var(--surface-soft, #f7f7f5)" }}
    >
      <div
        ref={scrollRef}
        onScroll={onTranscriptScroll}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4"
      >
        {showEmpty ? (
          <EmptyChatState />
        ) : (
          <div className="flex w-full flex-col gap-4">
            {welcome?.content.trim() ? (
              <div
                className="rounded-[12px] border px-3.5 py-3"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                }}
              >
                <p
                  className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Whitby
                </p>
                <p className="text-[13px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
                  {welcome.content}
                </p>
              </div>
            ) : null}

            {conversation.map((msg) => (
              <MessageRow
                key={msg.id}
                message={msg}
                pending={pending}
                pendingHint={pendingHint}
                streaming={msg.id === streamingId}
                streamedText={msg.id === streamingId ? streamedText : ""}
                onApply={() => void resolvePlan(msg, "apply")}
                onCancel={() => void resolvePlan(msg, "cancel")}
              />
            ))}

            {pending &&
            !streamingId &&
            !conversation.some((message) => message.role === "whitby" && !message.content.trim()) ? (
              <div className="flex gap-2.5">
                <WhitbyAvatar />
                <div
                  className="rounded-[12px] px-3.5 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <ThinkingDots label={pendingHint} />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t px-3 pb-7 pt-3"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        {suggestions.length > 0 && !pending ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {suggestions.slice(0, 4).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  stickToBottomRef.current = true;
                  void submit(suggestion);
                }}
                className="cursor-pointer rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:border-[rgba(35,131,226,.35)] hover:bg-[var(--accent-tint-soft,#e7f1fb)] hover:text-[var(--accent,#2383e2)]"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--surface)",
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className="flex items-end gap-2 rounded-[12px] border px-3 py-2.5 transition-[border-color,box-shadow] duration-150"
          style={{
            borderColor: composerFocused ? "var(--accent, #2383e2)" : "var(--border-strong, #d9d9d6)",
            background: "var(--canvas, #f1f1ef)",
            boxShadow: composerFocused ? "0 0 0 3px rgba(35,131,226,.12)" : "none",
          }}
        >
          <label className="sr-only" htmlFor="whitby-composer">
            Message Whitby
          </label>
          <textarea
            id="whitby-composer"
            ref={composerRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onFocus={() => setComposerFocused(true)}
            onBlur={() => setComposerFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit(input);
              }
            }}
            placeholder={pending ? "Whitby is working…" : placeholder}
            className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-[13.5px] leading-[1.45] outline-none placeholder:opacity-55"
            style={{
              color: "var(--ink)",
              minHeight: "22px",
              maxHeight: "110px",
              overflowY: "auto",
            }}
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => void submit(input)}
            disabled={!canSend}
            aria-label="Send message"
            className="mb-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              color: "#fff",
              background: "var(--accent, #2383e2)",
              border: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M2.5 7h9M7.5 3.5 11 7l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="mt-2 px-0.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {pending ? "Applying your instruction…" : "Enter to send · Shift+Enter for a new line"}
        </p>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  pending,
  pendingHint,
  streaming,
  streamedText,
  onApply,
  onCancel,
}: {
  message: WhitbyMessage;
  pending: boolean;
  pendingHint: string;
  streaming: boolean;
  streamedText: string;
  onApply: () => void;
  onCancel: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[90%] whitespace-pre-wrap break-words rounded-[12px] rounded-br-[4px] px-3.5 py-2.5 text-[13px] leading-[1.5] tracking-normal"
          style={{
            background: "var(--accent, #2383e2)",
            color: "#fff",
            overflowWrap: "anywhere",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const showBubble =
    Boolean(message.content.trim()) ||
    Boolean(streamedText.trim()) ||
    (pending && !message.content.trim()) ||
    streaming;

  return (
    <div className="flex max-w-[96%] flex-col gap-2">
      {showBubble ? (
        <div className="flex gap-2.5">
          <WhitbyAvatar />
          <div className="min-w-0 flex-1">
            <p
              className="mb-1 text-[11px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              Whitby
            </p>
            <div
              className="rounded-[12px] rounded-tl-[4px] border px-3.5 py-2.5"
              style={{
                background: "var(--surface)",
                color: "var(--ink)",
                borderColor: "var(--border)",
              }}
            >
              {streaming ? (
                streamedText ? (
                  <ChatStreamText content={streamedText} />
                ) : (
                  <ThinkingDots label={pendingHint} />
                )
              ) : message.content.trim() ? (
                <ChatMarkdown content={message.content} />
              ) : (
                <ThinkingDots label={pendingHint} />
              )}
            </div>
          </div>
        </div>
      ) : null}
      {message.plan ? (
        <PlanCard
          plan={message.plan}
          resolution={message.resolution}
          disabled={pending}
          onApply={onApply}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  );
}

function EmptyChatState() {
  return (
    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-5 text-center">
      <span
        className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[12px] font-bold text-white"
        style={{ background: "var(--accent, #2383e2)" }}
      >
        W
      </span>
      <p className="text-[14px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
        What should we change?
      </p>
      <p className="mt-1.5 max-w-[15rem] text-[12.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        Add lessons, rewrite quizzes, or refine the selected content.
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  resolution,
  disabled,
  onApply,
  onCancel,
}: {
  plan: WhitbyPlan;
  resolution?: "applied" | "cancelled";
  disabled: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const riskStyle =
    plan.risk === "high"
      ? { bg: "var(--danger-bg, #fbe9e7)", fg: "var(--danger-fg, #c0392b)", label: "Needs review" }
      : { bg: "var(--warning-bg, #fdf7ee)", fg: "var(--warning-fg, #7a5a2e)", label: "Please confirm" };

  return (
    <div
      className="ml-[34px] rounded-[12px] border px-3.5 py-3 text-[12.5px]"
      style={{ background: "var(--surface)", borderColor: "var(--border-strong, #d9d9d6)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-[6px] px-2 py-0.5 text-[10.5px] font-semibold"
          style={{ background: riskStyle.bg, color: riskStyle.fg }}
        >
          {riskStyle.label}
        </span>
        <span className="text-[11.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
          {plan.steps.length} change{plan.steps.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="mb-3 flex flex-col gap-1.5">
        {plan.steps.map((step, index) => (
          <li key={index} className="flex gap-2 leading-[1.45]" style={{ color: "var(--ink)" }}>
            <span className="mt-1.5 size-1 shrink-0 rounded-full" style={{ background: "var(--accent, #2383e2)" }} />
            <span>{step}</span>
          </li>
        ))}
      </ul>
      {resolution ? (
        <p className="text-[11.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
          {resolution === "applied" ? "Applied" : "Cancelled — nothing changed"}
        </p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={disabled}
            className="cursor-pointer rounded-[7px] px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--accent, #2383e2)", border: "none" }}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="cursor-pointer rounded-[7px] border px-3 py-1.5 text-[12px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: "var(--border-strong, #d9d9d6)",
              color: "var(--text-secondary)",
              background: "var(--surface)",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function WhitbyAvatar() {
  return (
    <span
      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[10px] font-bold text-white"
      style={{ background: "var(--accent, #2383e2)" }}
    >
      W
    </span>
  );
}

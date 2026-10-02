"use client";

import { useEffect, useLayoutEffect, useOptimistic, useRef, useState } from "react";

export type WhitbyTurn = { id: string; instruction: string; reply: string };

const ASKS = [
  "Update a Work Stream",
  "Reorder these Work Streams",
  "Merge streams that overlap",
  "Draft the next version",
];

/**
 * Ask Whitby on a Playbook — a full-height sheet from the right, with the
 * composer docked at the bottom so the panel reads as a conversation.
 */
export function WhitbyStreamComposer({
  draftId,
  action,
  prompt,
  turns = [],
  playbookName,
  initiallyOpen = false,
  variant = "rail",
  suggestions,
}: {
  draftId: string;
  action: (formData: FormData) => Promise<void>;
  prompt: string;
  turns?: WhitbyTurn[];
  playbookName?: string;
  initiallyOpen?: boolean;
  variant?: "rail" | "popover";
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [fresh, setFresh] = useState(false);
  const [draft, setDraft] = useState("");
  const [topbar, setTopbar] = useState(56);

  const [sending, showSending] = useOptimistic<string | null, string>(
    null,
    (_, asked) => asked,
  );

  const form = useRef<HTMLFormElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const prompts = (suggestions?.filter(Boolean).length ? suggestions : ASKS) as string[];
  void prompt;

  useEffect(() => {
    const box = transcript.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [turns.length, sending, open]);

  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const bar = document.querySelector("[data-pa-topbar]");
      setTopbar(bar ? Math.round(bar.getBoundingClientRect().bottom) : 56);
    }

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useLayoutEffect(() => {
    if (variant !== "popover") return;
    document.body.classList.toggle("pa-ask-open", open);
    return () => document.body.classList.remove("pa-ask-open");
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(formData: FormData) {
    const asked = String(formData.get("instruction") ?? "").trim();
    if (!asked) return;

    showSending(asked);
    setDraft("");
    setFresh(false);

    await action(formData);
  }

  function fill(line: string) {
    setDraft(line);
    setFresh(false);
  }

  const shown = fresh ? [] : turns;
  const talking = shown.length > 0 || Boolean(sending);

  const trigger =
    variant === "popover" ? (
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls="playbook-ask-whitby"
        className="pa-ask-whitby-nav inline-flex shrink-0 items-center gap-1.5 rounded-control px-3.5 py-[7px] text-[13px] font-semibold"
      >
        <CaseIcon />
        Ask Whitby
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="playbook-ask-whitby"
        className="pa-ask-whitby-nav flex w-full items-center gap-2 rounded-control px-3.5 py-3 text-[13.5px] font-semibold"
      >
        <CaseIcon />
        Ask Whitby
        <span className="ml-auto text-[15px] leading-none" aria-hidden>
          ›
        </span>
      </button>
    );

  return (
    <>
      {trigger}

          {open ? (
        <>
          <button
            type="button"
            className="fixed right-0 bottom-0 left-0 z-[160] cursor-default border-0 bg-[rgba(23,24,26,.1)] backdrop-blur-[1px] lg:hidden"
            style={{ top: topbar }}
            aria-label="Close Whitby assistant"
            onClick={() => setOpen(false)}
          />

          <aside
            id="playbook-ask-whitby"
            role="dialog"
            aria-modal="true"
            aria-label="Ask Whitby"
            className="pa-assistant-sheet fixed right-0 z-[170] flex w-full max-w-[400px] flex-col border-l"
            style={{
              top: topbar,
              height: `calc(100svh - ${topbar}px)`,
              borderColor: "#e6e3da",
              background: "linear-gradient(180deg, #ffffff 0%, #f5f9fd 48%, #eef5fc 100%)",
              boxShadow: "-8px 0 40px rgba(23,24,26,.08)",
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "#2383e2" }}
                  aria-hidden
                >
                  <svg width="18" height="18" viewBox="0 0 120 120" fill="none" aria-hidden>
                    <path d="M40 46 60 22l20 24" stroke="#f7f5f0" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M26 42h68c9.94 0 18 8.06 18 18v22c0 9.94-8.06 18-18 18H26C16.06 100 8 91.94 8 82V60c0-9.94 8.06-18 18-18Z" fill="#f7f5f0" />
                    <path d="M8 66h104M50 42 34 100M70 42l16 58" stroke="#17181a" strokeWidth="6.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-[17px] font-bold tracking-[-0.2px]" style={{ color: "#17181a" }}>
                  Ask Whitby
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setFresh(true);
                    setDraft("");
                  }}
                  className="pa-ask-ghost rounded-full px-3 py-1.5 text-[13px] font-semibold"
                >
                  + New chat
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="pa-ask-ghost flex h-9 w-9 items-center justify-center rounded-full"
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </div>

            {talking ? (
              <div ref={transcript} className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                <div className="flex flex-col gap-2.5">
                  {shown.map((turn) => (
                    <Exchange key={turn.id} asked={turn.instruction} reply={turn.reply} />
                  ))}
                  {sending ? <Exchange asked={sending} /> : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4">
                <h2
                  className="text-[22px] font-bold leading-[1.25] tracking-[-0.5px]"
                  style={{ color: "#17181a" }}
                >
                  Let&apos;s update this Playbook
                </h2>
                {playbookName ? (
                  <span
                    className="mt-2.5 inline-block max-w-full truncate rounded-full px-2.5 py-1 text-[12px] font-medium"
                    style={{ background: "#e7f1fb", color: "#183347" }}
                  >
                    {playbookName}
                  </span>
                ) : null}

                <div
                  className="mt-5 rounded-[14px] px-4 py-4"
                  style={{ background: "rgba(255,255,255,.72)", border: "1px solid rgba(230,227,218,.9)" }}
                >
                  <div className="text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: "#5c5e66" }}>
                    What Whitby does
                  </div>
                  <p className="mt-2 text-[13.5px] leading-[1.6]" style={{ color: "#17181a" }}>
                    Whitby rewrites the Work Streams on this Playbook from what you ask. Update a stream&apos;s purpose or tasks, reorder how the engagement runs, merge streams that overlap, or draft the next version.
                  </p>
                  <p className="mt-2.5 text-[13px] leading-[1.6]" style={{ color: "#5c5e66" }}>
                    A Playbook is the shape of the work, not a live Request. Dates, owners, and client details are not here. Anything you do not mention stays as it is, so a small ask does not quietly rewrite the whole thing.
                  </p>
                </div>

                <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: "#5c5e66" }}>
                  Ask Whitby to
                </div>
                <div className="mt-1.5">
                  {prompts.map((line) => (
                    <button
                      key={line}
                      type="button"
                      onClick={() => fill(line)}
                      className="pa-ask-row -mx-2 flex w-[calc(100%+16px)] items-center gap-2.5 rounded-[10px] px-2 py-2 text-left"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ background: "#e7f1fb", color: "#2383e2" }}
                        aria-hidden
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </span>
                      <span className="pa-ask-row-label text-[13.5px] leading-snug" style={{ color: "#17181a" }}>
                        {line}
                      </span>
                    </button>
                  ))}
                </div>

                <form
                  ref={form}
                  action={send}
                  onSubmit={(event) => {
                    const asked = new FormData(event.currentTarget).get("instruction");
                    if (!String(asked ?? "").trim()) return;
                    setDraft("");
                    setFresh(false);
                  }}
                  className="pa-ask-box mt-auto flex items-center gap-2 rounded-[14px] border bg-white px-3.5 py-2.5"
                >
                  <input type="hidden" name="draft_id" value={draftId} />
                  <input
                    name="instruction"
                    required
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={Boolean(sending)}
                    placeholder="Ask anything about this Playbook…"
                    aria-label="Ask anything about this Playbook"
                    className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[13.5px] outline-none disabled:cursor-not-allowed"
                    style={{ color: "#17181a" }}
                  />
                  <button
                    type="submit"
                    disabled={draft.trim().length === 0}
                    aria-label="Send"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white disabled:cursor-default"
                    style={{
                      background: draft.trim().length === 0 ? "rgba(35,131,226,.4)" : "#2383e2",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 19V5M6 11l6-6 6 6" />
                    </svg>
                  </button>
                </form>
              </div>
            )}

            {talking ? (
              <div
                className="shrink-0 px-5 pb-4 pt-3"
                style={{ borderTop: "1px solid rgba(230,227,218,.75)" }}
              >
                <form
                  action={send}
                  onSubmit={(event) => {
                    const asked = new FormData(event.currentTarget).get("instruction");
                    if (!String(asked ?? "").trim()) return;
                    setDraft("");
                    setFresh(false);
                  }}
                  className="pa-ask-box flex items-center gap-2 rounded-[14px] border bg-white px-3 py-2"
                >
                  <input type="hidden" name="draft_id" value={draftId} />
                  <input
                    name="instruction"
                    required
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={Boolean(sending)}
                    placeholder={sending ? "Whitby is working on it…" : "Ask anything about this Playbook…"}
                    aria-label="Ask anything about this Playbook"
                    className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[13.5px] outline-none disabled:cursor-not-allowed"
                    style={{ color: "#17181a" }}
                  />
                  <button
                    type="submit"
                    disabled={Boolean(sending) || draft.trim().length === 0}
                    aria-label="Send"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white disabled:cursor-default"
                    style={{
                      background: sending || draft.trim().length === 0 ? "rgba(35,131,226,.4)" : "#2383e2",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 19V5M6 11l6-6 6 6" />
                    </svg>
                  </button>
                </form>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
    </>
  );
}

function CaseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M8 9.5 12 5l4 4.5" />
      <rect x="3" y="9" width="18" height="11" rx="4" />
      <path d="M3 14.5h18" />
    </svg>
  );
}

function Exchange({ asked, reply }: { asked: string; reply?: string }) {
  return (
    <>
      <div className="max-w-[92%] self-end rounded-[16px] px-3.5 py-2.5 text-[13.5px] leading-snug" style={{ background: "#e7f1fb", color: "#183347" }}>
        {asked}
      </div>
      {reply ? (
        <div className="max-w-[92%] self-start rounded-[16px] px-3.5 py-2.5 text-[13.5px] leading-snug" style={{ background: "#ffffff", color: "#17181a", boxShadow: "0 1px 2px rgba(23,24,26,.04)" }}>
          {reply}
        </div>
      ) : (
        <div className="flex items-center gap-[5px] self-start rounded-[16px] bg-white px-3.5 py-[11px]" style={{ boxShadow: "0 1px 2px rgba(23,24,26,.04)" }}>
          <span className="sr-only">Whitby is working on it</span>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              aria-hidden
              className="whitby-thinking-dot block h-[5px] w-[5px] rounded-full"
              style={{ background: "#5c5e66", animationDelay: `${index * 0.16}s` }}
            />
          ))}
        </div>
      )}
    </>
  );
}

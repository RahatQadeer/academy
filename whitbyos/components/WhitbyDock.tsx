"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { announceWhitbyPanel, onOtherWhitbyPanel } from "@/whitbyos/lib/whitby-panels";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { askInPanel } from "@/whitbyos/ask/actions";
import { AskReply } from "@/whitbyos/ask/components/AskReply";
import { Logo } from "@/base/components/Logo";
import type { Answer } from "@/whitbyos/lib/ask";

/**
 * Whitby, over whatever you are working on.
 *
 * The bar's Whitby button used to navigate to the Ask page, which is the
 * right screen for a conversation and the wrong one for a question about the
 * thing you are in the middle of: you lose the plan you were reading in
 * order to ask about it, and you come back to the top of it.
 *
 * So it opens here instead, over the page, and the page tells it where it
 * is. Ask for a task from a work plan and the task goes on that plan; ask
 * from a client and it is that client's. Ask for something that has nothing
 * to do with the screen and it does that too — the page is context, not a
 * cage.
 *
 * The same threads as the Ask page, so everything said here is in the
 * history, and a conversation started on one can be carried on from the
 * other.
 */
/**
 * The screen the panel is open over, named in the words somebody would use.
 *
 * Read off the route, so it costs nothing and can never disagree with where
 * they actually are. Null wherever the path says nothing useful — an
 * unnamed page is better than a wrong name.
 */
function describe(path: string): string | null {
  const at = path.split("?")[0]!.split("/").filter(Boolean);
  if (at[0] !== "whitbyos") return null;

  const deep = Boolean(at[2]);
  switch (at[1]) {
    case "work-plans":
      return deep ? "this work plan" : "your work plans";
    case "requests":
      return deep ? "this request" : "your requests";
    case "clients":
      return deep ? "this client" : "your clients";
    case "tasks":
      return "your tasks";
    case "messages":
      return "your messages";
    case "documents":
      return "your documents";
    case "calendar":
      return "your calendar";
    case "playbooks":
      return "your playbooks";
    case "providers":
      return "your providers";
    case "reports":
      return "your reports";
    default:
      return null;
  }
}

export function WhitbyDock({ current }: { current: boolean }) {
  const [open, setOpen] = useState(false);

  /* Both Whitby sheets are fixed to the right and full height, so the
     second one to open lands flat on top of the first. Whichever opened
     last is the one somebody meant. */
  useEffect(() => {
    if (open) announceWhitbyPanel("global");
  }, [open]);

  useEffect(() => onOtherWhitbyPanel("global", () => setOpen(false)), []);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<{ asked: string; answer: Answer | null }[]>([]);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, startTurn] = useTransition();
  /*
   * The panel is rendered into `document.body`, not where it sits.
   *
   * It lives inside the top bar, and the top bar has a `backdrop-filter` —
   * which makes it the containing block for anything `position: fixed`
   * underneath it. So "fixed to the right of the screen" meant "fixed to
   * the right of a 56px strip", and the panel opened inside the header and
   * was clipped to nothing. It looked like the button had stopped working.
   *
   * A portal puts it back on the body, where `fixed` means the viewport
   * again. `mounted` because there is no `document` on the server.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const path = usePathname();
  const router = useRouter();

  /*
   * What the screen behind the panel is, in one phrase.
   *
   * Only what the route can honestly say. A work plan's page is "this work
   * plan"; a list is "your work plans"; anything unrecognised says nothing
   * at all rather than guessing at a name it has not got.
   */
  const where = describe(path);

  /* The first two are about that screen. The rest are the things people ask
     for most, the same four the full page opens with. */
  const starters = [
    ...(where
      ? [
          { q: `What should I know about ${where}?`, label: "Catch me up", hint: `On ${where}`, mark: "◎" },
          { q: "Create a task and assign it to me", label: "New task", hint: "Here, on this page", mark: "✓" },
        ]
      : [
          { q: "Create a work plan", label: "New work plan", hint: "Name, client, request", mark: "→" },
          { q: "Create a task and assign it to me", label: "New task", hint: "Title, client, owner, due", mark: "✓" },
        ]),
    { q: "What is overdue?", label: "What's overdue?", hint: "Past due tasks and requests", mark: "!" },
    { q: "Summarise open requests", label: "Open requests", hint: "What is still in motion", mark: "≡" },
  ];
  const box = useRef<HTMLTextAreaElement>(null);
  const feed = useRef<HTMLDivElement>(null);

  // Closes on Escape, like every other sheet in the product.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);

  /* Walking onto the Ask page with the panel open would leave two of them
     on screen for as long as it took to notice. */
  useEffect(() => {
    if (current) setOpen(false);
  }, [current]);

  /*
   * Told to the document, because the thing that has to move is the shell
   * and this component sits inside it. Cleared on unmount as well as on
   * close: a navigation that takes the header with it must not leave the
   * page padded for a panel that is gone.
   */
  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.whitbyDock = "open";
    else delete root.dataset.whitbyDock;
    return () => {
      delete root.dataset.whitbyDock;
    };
  }, [open]);

  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  function send() {
    const asked = draft.trim();
    if (!asked || busy) return;

    setDraft("");
    setFailed(false);
    /* Painted before the transition, not inside it: a state change made
       inside one does not reach the screen until it settles. */
    setTurns((all) => [...all, { asked, answer: null }]);

    startTurn(async () => {
      try {
        const result = await askInPanel({ threadId, question: asked, path });
        setThreadId(result.threadId);
        setTurns((all) => {
          const next = [...all];
          next[next.length - 1] = { asked, answer: result.answer };
          return next;
        });
        /* Only where something was written. Refreshing on every answer would
           redraw the page somebody is reading, under the panel they are
           reading it through. */
        if (result.changed) router.refresh();
      } catch {
        setFailed(true);
      }
    });
  }

  /*
   * On the Ask page the bar button is a link, not a panel.
   *
   * Opening a 400px Whitby over the full-screen Whitby puts two of the same
   * thing side by side, each with its own composer and its own idea of
   * which conversation is open. The button still goes somewhere — a fresh
   * chat — because a control on the bar that does nothing where you are
   * standing reads as broken.
   */
  if (current) {
    return (
      <Link
        href="/whitbyos/ask"
        aria-label="Ask Whitby"
        title="New chat"
        className="pa-bar-btn overflow-hidden p-0"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
      >
        <Logo size={36} />
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label="Ask Whitby"
        aria-expanded={open}
        title="Ask Whitby"
        className="pa-bar-btn overflow-hidden p-0"
        style={open ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
      >
        <Logo size={36} />
      </button>

      {open && mounted
        ? createPortal(
            <>
          {/* Dismisses, and takes the click with it so nothing underneath
              is pressed on the way out. */}
          <button
            type="button"
            aria-label="Close Whitby"
            onClick={() => setOpen(false)}
            className="whitby-dock-veil fixed inset-0 z-[60] cursor-default"
            style={{ background: "rgba(15,15,15,.14)", backdropFilter: "blur(1px)" }}
          />

          <aside
            /* A rail beside the page on a desktop; the whole screen on a
               phone, where 400px of panel over 390px of page leaves a
               sliver of something nobody can read or press. */
            className="whitby-dock fixed bottom-0 right-0 top-0 z-[61] flex w-full flex-col sm:w-[400px] lg:w-[420px]"
            style={{
              borderLeft: "1px solid var(--border-strong)",
              boxShadow: "-12px 0 40px -28px rgba(15,15,15,.45)",
            }}
          >
            <header
              className="whitby-dock-head flex shrink-0 items-center gap-1.5 border-b px-3.5 py-3"
              style={{ borderColor: "rgba(230,227,218,.9)" }}
            >
              <Logo size={26} />
              <span className="flex-1 truncate text-[14.5px] font-semibold" style={{ color: "#17181a" }}>
                Ask Whitby
              </span>

              {/* Always here, not only once there is something to leave: a
                  panel that opens on the last conversation and hides the way
                  to a fresh one makes people scroll up to check what it
                  still thinks they are talking about. */}
              <button
                type="button"
                onClick={() => {
                  setThreadId(null);
                  setTurns([]);
                  setFailed(false);
                  setDraft("");
                  box.current?.focus();
                }}
                title="Start a new chat"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-[3px] text-[12px] font-medium transition-colors hover:bg-white"
                style={{ borderColor: "rgba(230,227,218,.9)", color: "var(--accent)" }}
              >
                <span aria-hidden>✎</span> New chat
              </button>

              <Link
                href={threadId ? `/whitbyos/ask/${threadId}` : "/whitbyos/ask"}
                onClick={() => setOpen(false)}
                title="Open this conversation full screen"
                aria-label="Open Whitby full screen"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] no-underline transition-colors hover:bg-white"
                style={{ color: "#5c5e66" }}
              >
                ⤢
              </Link>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] leading-none transition-colors hover:bg-white"
                style={{ color: "#5c5e66" }}
              >
                ✕
              </button>
            </header>

            <div ref={feed} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-2">
              {turns.length === 0 ? (
                <div className="pt-5">
                  <div
                    className="mx-auto flex h-11 w-11 items-center justify-center rounded-[14px]"
                    style={{
                      background: "rgba(255,255,255,.72)",
                      border: "1px solid rgba(230,227,218,.9)",
                      boxShadow: "0 1px 2px rgba(23,24,26,.04)",
                    }}
                  >
                    <Logo size={24} />
                  </div>

                  <p
                    className="mt-3 text-center text-[17px] font-bold tracking-[-0.3px]"
                    style={{ color: "#17181a" }}
                  >
                    What do you need?
                  </p>
                  <p
                    className="mx-auto mt-1.5 max-w-[300px] text-center text-[12.5px] leading-[1.5]"
                    style={{ color: "#5c5e66" }}
                  >
                    {where
                      ? `Ask about ${where}, or anything else. Whatever you make here lands where you are.`
                      : "Ask about this workspace, or tell Whitby to make something."}
                  </p>

                  {/*
                   * Starters, because an empty box teaches nobody what a box
                   * can do — and the first two are about the screen behind
                   * the panel, which is the thing this surface is for.
                   */}
                  <div className="mt-5 flex flex-col gap-2">
                    {starters.map((starter) => (
                      <button
                        key={starter.q}
                        type="button"
                        onClick={() => {
                          setDraft(starter.q);
                          box.current?.focus();
                        }}
                        className="group flex items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors hover:bg-white"
                        style={{
                          borderColor: "rgba(230,227,218,.9)",
                          background: "rgba(255,255,255,.55)",
                        }}
                      >
                        <span
                          aria-hidden
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[12px]"
                          style={{ background: "#e7f1fb", color: "var(--accent)" }}
                        >
                          {starter.mark}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate text-[13px] font-medium"
                            style={{ color: "#17181a" }}
                          >
                            {starter.label}
                          </span>
                          <span className="block truncate text-[11.5px]" style={{ color: "#5c5e66" }}>
                            {starter.hint}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className="shrink-0 text-[12px] opacity-0 transition-opacity group-hover:opacity-100"
                          style={{ color: "var(--accent)" }}
                        >
                          →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-4">
                {turns.map((turn, index) => (
                  <div key={index} className="flex flex-col gap-2.5">
                    <div
                      className="ml-auto max-w-[86%] rounded-[14px] px-3.5 py-2 text-[13px] leading-snug"
                      style={{ background: "#e7f1fb", color: "#183347" }}
                    >
                      {turn.asked}
                    </div>

                    {turn.answer ? (
                      <div className="whitby-dock-reply ask-reply rounded-[14px] px-3.5 py-2.5 text-[13px]">
                        <AskReply answer={turn.answer} />
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 text-[12.5px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            aria-hidden
                            className="whitby-thinking-dot block h-[5px] w-[5px] rounded-full"
                            style={{
                              background: "var(--text-tertiary)",
                              animationDelay: `${dot * 0.16}s`,
                            }}
                          />
                        ))}
                        <span className="sr-only">Whitby is working on it</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {failed ? (
                <p className="mt-3 text-[12.5px]" style={{ color: "var(--danger-fg)" }}>
                  Something went wrong on the way to Whitby. Ask again and it will
                  pick up where it left off.
                </p>
              ) : null}
            </div>

            <div
              className="whitby-dock-foot shrink-0 border-t px-3.5 py-3"
              style={{ borderColor: "rgba(230,227,218,.9)" }}
            >
              <div
                className="flex items-end gap-2 rounded-[14px] border px-3 py-2"
                style={{
                  borderColor: "rgba(230,227,218,.9)",
                  background: "#ffffff",
                  boxShadow: "0 1px 2px rgba(23,24,26,.04)",
                }}
              >
                <textarea
                  ref={box}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    /* Enter sends; Shift+Enter is a new line. Mid-composition
                       Enter is choosing a character, not finishing. */
                    if (event.key !== "Enter" || event.shiftKey) return;
                    if (event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    send();
                  }}
                  placeholder={busy ? "Whitby is working…" : "Ask, or ask for something…"}
                  className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-[13.5px] outline-none"
                  style={{ color: "var(--ink)" }}
                />

                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !draft.trim()}
                  aria-label="Send"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  ↑
                </button>
              </div>
            </div>
            </aside>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { AskWhitbyPanel } from "@/whitbyos/work-plans/[id]/components/AskWhitbyPanel";
import type { RefineTurn } from "@/whitbyos/lib/workplan";
import { announceWhitbyPanel, onOtherWhitbyPanel } from "@/whitbyos/lib/whitby-panels";

/**
 * Ask Whitby on a Work Plan — compact control, white sheet from the right.
 *
 * Once the sheet is open the button goes away — the panel is the Ask Whitby
 * surface, and a second control for the same thing is noise.
 */
export function AskWhitbyDock({
  requestId,
  planId,
  planName,
  turns,
  suggestions,
  returnTo,
  closeHref,
  freshHref,
  error,
  initiallyOpen,
}: {
  requestId: string;
  /** The plan this dock belongs to, so a create lands on it. */
  planId: string;
  planName: string;
  turns: RefineTurn[];
  suggestions: string[];
  returnTo: string;
  closeHref: string;
  freshHref: string;
  error?: string;
  /** Sending an instruction comes back through the server with it open. */
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [topbar, setTopbar] = useState(56);

  /* Both Whitby sheets are fixed to the right and full height, so the
     second one to open lands flat on top of the first. Whichever opened
     last is the one somebody meant. */
  useEffect(() => {
    if (open) announceWhitbyPanel("plan");
  }, [open]);

  useEffect(() => onOtherWhitbyPanel("plan", () => setOpen(false)), []);

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
    document.body.classList.toggle("pa-ask-open", open);
    return () => document.body.classList.remove("pa-ask-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="plan-ask-whitby"
          /* Sized by the stylesheet so it matches the two buttons beside
             it; utilities here would be a second opinion about the same
             box, and the built CSS decides which one lands. */
          className="pa-ask-whitby-nav pa-ask-whitby-plan inline-flex shrink-0 items-center justify-center gap-1.5"
        >
          <WhitbyMark />
          Ask Whitby
        </button>
      ) : null}

      {open ? (
        <>
          <button
            type="button"
            className="fixed right-0 bottom-0 left-0 z-[160] cursor-default border-0 bg-[rgba(23,24,26,.1)] backdrop-blur-[1px] xl:hidden"
            style={{ top: topbar }}
            aria-label="Close Whitby assistant"
            onClick={() => setOpen(false)}
          />

          <aside
            id="plan-ask-whitby"
            role="dialog"
            aria-modal="true"
            aria-label="Ask Whitby"
            className="pa-assistant-sheet fixed right-0 z-[170] flex w-full max-w-[min(100vw,360px)] flex-col border-l"
            style={{
              top: topbar,
              height: `calc(100svh - ${topbar}px)`,
              borderColor: "#e6e3da",
              background: "linear-gradient(180deg, #ffffff 0%, #f5f9fd 48%, #eef5fc 100%)",
              boxShadow: "-8px 0 40px rgba(23,24,26,.08)",
            }}
          >
            <AskWhitbyPanel
              requestId={requestId}
              planId={planId}
              planName={planName}
              turns={turns}
              suggestions={suggestions}
              returnTo={returnTo}
              closeHref={closeHref}
              freshHref={freshHref}
              error={error}
              onClose={() => setOpen(false)}
              sheet
            />
          </aside>
        </>
      ) : null}
    </>
  );
}

/**
 * The Whitby mark, in whatever colour the control around it is.
 */
function WhitbyMark() {
  return (
    /* The mark alone, in the accent, rather than a filled tile. A solid
       blue square inside a button is a button inside a button, and it is
       what made this read as an advertisement beside its neighbours. */
    <span className="flex shrink-0 items-center justify-center" aria-hidden>
      {/* Drawn in `currentColor`, so it is the button's accent and follows
          the theme. The cream and near-black it was drawn in were the two
          colours of the tile it used to sit on; on white the cream half
          would simply not be there. */}
      <svg width="15" height="15" viewBox="0 0 120 120" fill="none">
        <path
          d="M40 46 60 22l20 24"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M26 42h68c9.94 0 18 8.06 18 18v22c0 9.94-8.06 18-18 18H26C16.06 100 8 91.94 8 82V60c0-9.94 8.06-18 18-18Z"
          stroke="currentColor"
          strokeWidth="9"
        />
        <path
          d="M8 66h104M50 42 34 100M70 42l16 58"
          stroke="currentColor"
          strokeWidth="6.5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </span>
  );
}

"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/**
 * The spotlight tour a product runs on somebody's first visit.
 *
 * Whitby's version of this (Screens 1.4 to 1.9) was the only one, and it held
 * both halves of the thing: the six steps a professional is shown, and the
 * machinery that measures an element, cuts a hole in a dimmed screen around it
 * and puts a card beside it without running off an edge. The Client Portal
 * wants the second half and none of the first — a client has no workspace
 * switcher, no Quick Add and no widgets to arrange — so the machinery moved
 * here and each product now brings its own `steps`.
 *
 * The ring is measured off the element named by each step rather than drawn at
 * a fixed pixel box, so a tour lands correctly at any width and follows its
 * controls if they ever move. Targets are `data-tour` attributes; a step whose
 * target is missing on this screen simply loses its ring and keeps its card,
 * which is what a portal with half its areas turned off needs.
 */

export type TourStep = {
  /** What the ring goes around. Null for a step that is a card on its own. */
  target: string | null;
  title: string;
  body: string;
};

type Box = { top: number; left: number; width: number; height: number };

const CARD = { width: 320, height: 220, gap: 14, margin: 16 };

/**
 * Where the card goes: beside a tall target, under a short one, and never off
 * an edge. The export hard-codes a pixel pair per step, which only describes
 * the frame it was drawn at.
 */
function position(box: Box | null, width: number, height: number) {
  if (!box) return { top: 120, left: Math.max(CARD.margin, width / 2 - CARD.width / 2) };

  const clamp = (value: number, max: number) =>
    Math.max(CARD.margin, Math.min(value, max - CARD.margin));

  // A target taller than half the screen has no room under it, so the card
  // goes to its side instead.
  if (box.height > height * 0.5) {
    const right = box.left + box.width + CARD.gap;
    const left =
      right + CARD.width + CARD.margin < width ? right : box.left - CARD.width - CARD.gap;
    return {
      top: clamp(box.top, height - CARD.height),
      left: clamp(left, width - CARD.width),
    };
  }

  const below = box.top + box.height + CARD.gap;
  const top =
    below + CARD.height + CARD.margin < height ? below : box.top - CARD.height - CARD.gap;

  return {
    top: clamp(top, height - CARD.height),
    left: clamp(box.left, width - CARD.width),
  };
}

export function WelcomeTour({
  steps,
  finish,
  /** The button on the closing card. Each product ends somewhere of its own. */
  doneLabel = "Go to my dashboard",
}: {
  steps: TourStep[];
  finish: () => Promise<void>;
  doneLabel?: string;
}) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });

  const current = steps[step]!;
  const last = step === steps.length - 1;

  // Measured after paint and again on resize, because the ring is drawn in
  // page coordinates and the thing under it moves with the layout.
  useLayoutEffect(() => {
    if (!current.target) {
      setBox(null);
      return;
    }

    function measure() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const element = document.querySelector(current.target!);
      if (!element) {
        setBox(null);
        return;
      }
      // Viewport coordinates, and the ring is fixed, so the two stay together
      // if the page moves under them.
      const rect = element.getBoundingClientRect();
      setBox({
        top: rect.top - 5,
        left: rect.left - 5,
        width: rect.width + 10,
        height: rect.height + 10,
      });
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current.target, step]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") void close();
      if (event.key === "ArrowRight" || event.key === "Enter") next();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function close() {
    setDone(true);
    await finish();
  }

  function next() {
    if (last) {
      void close();
      return;
    }
    setStep((value) => value + 1);
  }

  if (done) return null;

  if (last) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-6"
        style={{ background: "rgba(15,32,56,.32)" }}
        role="dialog"
        aria-modal
        aria-label="Tour complete"
      >
        <div
          className="relative w-full max-w-[400px] overflow-hidden rounded-[16px] border bg-surface px-7 pb-7 pt-8 text-center"
          style={{
            borderColor: "var(--chrome-line)",
            boxShadow:
              "0 1px 2px rgba(31,72,125,.06), 0 28px 56px -24px rgba(31,72,125,.55)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-x-10 top-0 h-[3px] rounded-b-full"
            style={{ background: "var(--accent)" }}
          />
          <span
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-bold"
            style={{ background: "var(--success-bg, #e1f5ea)", color: "var(--success-fg)" }}
            aria-hidden
          >
            ✓
          </span>
          <h2 className="text-[20px] font-bold tracking-[-0.3px]">{current.title}</h2>
          <p
            className="mt-2 text-[13.5px] leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {current.body}
          </p>
          <button
            type="button"
            onClick={() => void close()}
            className="mt-5 inline-flex w-full items-center justify-center rounded-control px-5 py-[11px] text-[14px] font-semibold text-white hover:!text-white"
            style={{
              background: "var(--accent)",
              boxShadow: "0 8px 18px -12px rgba(31,72,125,.9)",
            }}
          >
            {doneLabel}
          </button>
        </div>
      </div>
    );
  }

  const place = position(box, viewport.width, viewport.height);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-label={current.title}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "rgba(255,255,255,.22)" }}
      />

      {box ? (
        <div
          className="pointer-events-none fixed rounded-[8px]"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: "0 0 0 4000px rgba(255,255,255,.32), 0 0 0 3px var(--accent)",
          }}
        />
      ) : null}

      <div
        className="fixed w-[320px] rounded-[10px] p-[18px]"
        style={{
          top: place.top,
          left: place.left,
          background: "var(--ink)",
          boxShadow: "0 12px 40px rgba(15,15,15,.3)",
        }}
      >
        <div
          className="mb-1.5 text-[11px] font-semibold"
          style={{ color: "rgba(255,255,255,.5)" }}
        >
          STEP {step + 1} OF {steps.length}
        </div>
        <div className="mb-1.5 text-[15px] font-semibold" style={{ color: "#fff" }}>
          {current.title}
        </div>
        <p
          className="mb-4 text-[13px] leading-[1.5]"
          style={{ color: "rgba(255,255,255,.7)" }}
        >
          {current.body}
        </p>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => void close()}
            className="text-[12.5px]"
            style={{ color: "rgba(255,255,255,.5)" }}
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex gap-[5px]" aria-hidden>
              {steps.map((_, index) => (
                <span
                  key={index}
                  className="h-[5px] w-[5px] rounded-full"
                  style={{
                    background: index === step ? "#fff" : "rgba(255,255,255,.3)",
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={next}
              className="whitespace-nowrap rounded-control px-3.5 py-[7px] text-[12.5px] font-semibold"
              style={{ background: "#fff", color: "var(--ink)" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

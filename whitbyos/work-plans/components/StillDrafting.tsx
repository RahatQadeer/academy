"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/base/lib/cn";

/** How often the page asks whether the plan has landed. */
const LOOK_AGAIN_MS = 6_000;
/** How long a stage is marked as the one being worked on. */
const STAGE_MS = 4_200;
/** Past this, the wait is worth a word rather than a silence. */
const SLOW_SECONDS = 90;

/**
 * What the drafting works through, in the order it happens.
 *
 * Nothing here can see inside the model call, so nothing here claims to: the
 * marker travels at the pace the stages usually take, and each line says what
 * the stage is rather than that it has finished. The one real number on the
 * screen is how long it has actually been, which is what turns "is this
 * stuck?" into a question somebody can answer for themselves.
 */
const STAGES = [
  "Reading the client's file",
  "Looking the work up",
  "Drafting the phases and their tasks",
  "Scheduling backwards from the deadline",
  "Assigning the work and checking the dates hold",
  "Checking the plan saved completely",
];

/**
 * A plan that is still being written.
 *
 * One quiet screen: the plan's name, what Whitby is doing, and how long it has
 * been. The rail stays available — there is no button telling somebody to
 * leave, because they already can. The page re-reads itself on a timer; the
 * notice in the bell is what reaches somebody who opened something else.
 */
export function StillDrafting({
  planName,
  clientName,
}: {
  planName: string;
  /** Whose work it is, where the plan is filed under somebody. */
  clientName?: string | null;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // A tab nobody is looking at is nobody waiting.
      if (document.visibilityState === "visible") router.refresh();
    }, LOOK_AGAIN_MS);

    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    /* Stopping on the last one rather than looping back to the first: a
       marker that restarts says the work restarted. */
    const timer = setInterval(
      () => setStage((at) => (at < STAGES.length - 1 ? at + 1 : at)),
      STAGE_MS,
    );

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  const clock =
    elapsed < 60
      ? `${elapsed}s`
      : `${Math.floor(elapsed / 60)}m ${String(elapsed % 60).padStart(2, "0")}s`;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 py-14"
      style={{
        background:
          "radial-gradient(ellipse 70% 55% at 50% 18%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%), var(--surface)",
      }}
    >
      <div className="relative z-[1] w-full max-w-[440px]">
        <div className="flex flex-col items-center text-center">
          <span
            className="relative mb-7 flex h-[56px] w-[56px] items-center justify-center rounded-[16px]"
            style={{
              background: "var(--accent-tint)",
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
            }}
            aria-hidden
          >
            <span
              className="absolute inset-[-6px] rounded-[20px] opacity-60"
              style={{
                background:
                  "conic-gradient(from 180deg, transparent 40%, color-mix(in srgb, var(--accent) 35%, transparent), transparent 70%)",
                animation: "pa-spin 2.8s linear infinite",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))",
                WebkitMask:
                  "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))",
              }}
            />
            <Spinner />
          </span>

          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--accent)" }}
          >
            Drafting
          </p>

          <h1
            className="text-balance text-[24px] font-bold tracking-[-0.03em] leading-[1.2]"
            style={{ color: "var(--ink)" }}
          >
            {planName}
          </h1>

          {clientName ? (
            <p
              className="mt-2 text-[13.5px]"
              style={{ color: "var(--text-secondary)" }}
            >
              for {clientName}
            </p>
          ) : null}

          <p
            className="mt-4 max-w-[340px] text-pretty text-[13.5px] leading-[1.6]"
            style={{ color: "var(--text-secondary)" }}
          >
            Whitby is building the phases, tasks, and dates. A notice will
            arrive when it is ready.
          </p>
        </div>

        <div
          role="progressbar"
          aria-label="Drafting the plan"
          className="mt-8 h-[3px] w-full overflow-hidden rounded-full"
          style={{ background: "var(--surface-active)" }}
        >
          <div
            className="pa-progress-indeterminate h-full rounded-full"
            style={{ background: "var(--accent)" }}
          />
        </div>

        <ol className="mt-7 flex flex-col gap-0">
          {STAGES.map((label, index) => {
            const passed = index < stage;
            const here = index === stage;
            const last = index === STAGES.length - 1;

            return (
              <li key={label} className="relative flex gap-3.5">
                {!last ? (
                  <span
                    aria-hidden
                    className="absolute left-[11px] top-[22px] w-px"
                    style={{
                      bottom: 0,
                      background: passed ? "var(--accent)" : "var(--chrome-line)",
                    }}
                  />
                ) : null}

                <span
                  aria-hidden
                  className="relative z-[1] mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: passed
                      ? "var(--accent)"
                      : here
                        ? "var(--surface)"
                        : "var(--surface)",
                    color: passed ? "#fff" : here ? "var(--accent)" : "var(--text-tertiary)",
                    boxShadow: here
                      ? "0 0 0 2px var(--accent)"
                      : passed
                        ? "none"
                        : "0 0 0 1px var(--chrome-line)",
                  }}
                >
                  {passed ? (
                    <CheckMark />
                  ) : here ? (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                  ) : (
                    index + 1
                  )}
                </span>

                <span
                  className={cn("pb-4 text-[13.5px] leading-[1.4]", last && "pb-0")}
                  style={{
                    color: here
                      ? "var(--ink)"
                      : passed
                        ? "var(--text-secondary)"
                        : "var(--text-tertiary)",
                    fontWeight: here ? 600 : 400,
                  }}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        <p
          className="mt-6 text-center text-[12px]"
          style={{ color: "var(--text-tertiary)" }}
          suppressHydrationWarning
        >
          {clock} so far
          {elapsed >= SLOW_SECONDS ? " · Longer plans take longer; nothing is stuck." : ""}
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="color-mix(in srgb, var(--accent) 25%, transparent)" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2 4.8 8.5 9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

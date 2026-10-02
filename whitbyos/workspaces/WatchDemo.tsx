"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/base/components/Button";

const STEPS = [
  {
    title: "This page is the look",
    body: "Workspace overview is how the firm is doing. Stay on All workspaces to see every client at once. Open one from the left when you want to do the work inside it.",
  },
  {
    title: "Start with a workspace",
    body: "Each client relationship lives in its own workspace. Create one when you take someone on. The left rail is that list, and it stays with you on this page.",
  },
  {
    title: "Read the numbers first",
    body: "Active workspaces, clients, portals, and requests. These four cards are the firm today. They fill in as you add clients and take on work.",
  },
  {
    title: "Then see what needs you",
    body: "Needs attention is what is late. What is due is the next fortnight. Open the link on a card to go do that work. Come back here when you want the whole picture again.",
  },
] as const;

export function WatchDemo({
  canCreate,
  createHref,
  compact,
}: {
  canCreate: boolean;
  createHref: string;
  compact?: boolean;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowRight") setStep((n) => Math.min(STEPS.length - 1, n + 1));
      if (event.key === "ArrowLeft") setStep((n) => Math.max(0, n - 1));
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function start() {
    setStep(0);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-control border border-line-strong bg-transparent px-3.5 py-[7px] text-[13px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
            : "inline-flex items-center gap-2 rounded-control border border-line-strong bg-transparent px-4 py-[11px] text-[14px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
        }
        style={{ color: "var(--ink)" }}
      >
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          <PlayMark />
        </span>
        Watch a demo
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8"
          style={{ background: "rgba(55,53,47,.45)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[min(740px,calc(100vh-48px))] w-full max-w-[680px] flex-col overflow-hidden rounded-[16px] bg-surface"
            style={{
              border: "1px solid var(--chrome-line)",
              boxShadow: "0 28px 64px -24px rgba(15,32,56,.5)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3.5 sm:px-6"
              style={{ borderColor: "var(--chrome-line)" }}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                >
                  <PlayMark />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>
                    Watch a demo
                  </p>
                  <p className="truncate text-[12.5px]" style={{ color: "var(--text-quiet)" }}>
                    Step {step + 1} of {STEPS.length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close demo"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--surface-soft)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <CloseMark />
              </button>
            </div>

            <div className="shrink-0 px-5 pt-5 sm:px-6">
              <div
                className="overflow-hidden rounded-[14px] border px-5 py-6 sm:px-7 sm:py-7"
                style={{
                  borderColor: "var(--chrome-line)",
                  background:
                    "linear-gradient(180deg, var(--accent-tint-soft) 0%, var(--canvas) 58%)",
                }}
              >
                <DemoVisual step={step} />
              </div>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <div>
                <h2 id={titleId} className="text-[20px] font-semibold tracking-[-0.3px]">
                  {current.title}
                </h2>
                <p className="mt-2 text-[14px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
                  {current.body}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5" aria-hidden>
                  {STEPS.map((item, index) => (
                    <span
                      key={item.title}
                      className="h-1.5 rounded-full"
                      style={{
                        width: index === step ? 18 : 6,
                        background: index === step ? "var(--accent)" : "var(--border-strong)",
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {step > 0 ? (
                    <Button variant="secondary" unsized className="px-3.5 py-[8px] text-[13px]" onClick={() => setStep((n) => n - 1)}>
                      Back
                    </Button>
                  ) : null}
                  {last ? (
                    canCreate ? (
                      <Button href={createHref} unsized className="px-3.5 py-[8px] text-[13px] hover:!text-white">
                        Create a workspace
                      </Button>
                    ) : (
                      <Button unsized className="px-3.5 py-[8px] text-[13px] hover:!text-white" onClick={() => setOpen(false)}>
                        Got it
                      </Button>
                    )
                  ) : (
                    <Button unsized className="px-3.5 py-[8px] text-[13px] hover:!text-white" onClick={() => setStep((n) => n + 1)}>
                      Next
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PlayMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <path d="M2.2 1.2v7.6L8.6 5 2.2 1.2Z" />
    </svg>
  );
}

function CloseMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DemoVisual({ step }: { step: number }) {
  return (
    <div
      className="mx-auto flex h-[200px] max-w-[520px] overflow-hidden rounded-[12px] border bg-surface"
      style={{
        borderColor: "var(--chrome-line)",
        boxShadow: "0 16px 36px -24px rgba(15,32,56,.4)",
      }}
    >
      <aside
        className="flex w-[128px] shrink-0 flex-col gap-1.5 border-r p-2.5"
        style={{
          borderColor: "var(--chrome-line)",
          background: "var(--surface)",
          boxShadow: step === 1 || step === 2 ? "inset 3px 0 0 var(--accent)" : undefined,
        }}
      >
        <span className="mb-1 flex items-center gap-1.5">
          <span className="h-5 w-5 rounded-[6px]" style={{ background: "var(--ink)" }} />
          <span className="h-1.5 w-10 rounded-full" style={{ background: "var(--border-strong)" }} />
        </span>
        <span className="rounded-[8px] px-1.5 py-1.5" style={{ background: step === 0 ? "var(--accent-tint)" : "transparent" }}>
          <span className="block h-1.5 w-14 rounded-full" style={{ background: "var(--ink)", opacity: 0.45 }} />
        </span>
        <span className="rounded-[8px] px-1.5 py-1.5" style={{ background: step === 1 ? "var(--accent-tint)" : "transparent" }}>
          <span className="block h-1.5 w-12 rounded-full" style={{ background: "var(--ink)", opacity: 0.3 }} />
        </span>
        {step === 2 ? (
          <span
            className="mt-auto rounded-control px-1.5 py-1 text-center text-[9px] font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            + Create
          </span>
        ) : (
          <span className="mt-auto h-7 rounded-control" style={{ background: "var(--accent-tint)" }} />
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <span className="h-2.5 w-28 rounded-full" style={{ background: "var(--ink)", opacity: 0.38 }} />
        <span className="h-1.5 w-40 rounded-full" style={{ background: "var(--border-strong)" }} />
        <div className="mt-1 grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((card) => (
            <span
              key={card}
              className="h-12 rounded-[8px] border"
              style={{
                borderColor: "var(--chrome-line)",
                background: step === 3 && card === 0 ? "var(--accent-tint)" : "var(--canvas)",
              }}
            />
          ))}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-1.5">
          <span
            className="h-11 rounded-[8px] border"
            style={{
              borderColor: "var(--chrome-line)",
              background: step === 3 ? "var(--accent-tint)" : "var(--canvas)",
            }}
          />
          <span className="h-11 rounded-[8px] border" style={{ borderColor: "var(--chrome-line)", background: "var(--canvas)" }} />
        </div>
      </div>
    </div>
  );
}

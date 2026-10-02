"use client";

import { useFormStatus } from "react-dom";

/**
 * Drafting takes Gemini several seconds, which is long enough to read as a
 * frozen page. This reports the wait instead, and blocks a second submit —
 * without it a double click drafts two plans and charges for both.
 *
 * Must be a child of the <form> for useFormStatus to see it.
 */
export function DraftButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="ml-auto inline-flex items-center gap-2 rounded-control px-4 py-[7px] text-[13px] font-medium text-white disabled:opacity-60"
      style={{ background: "var(--accent)" }}
    >
      {pending ? (
        <>
          <Spinner />
          Whitby is drafting…
        </>
      ) : (
        "Draft with Whitby →"
      )}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/40 border-t-white"
      aria-hidden
    />
  );
}

/** Dims the prompt while Whitby works, so the form reads as busy, not broken. */
export function DraftingOverlay({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <div
      style={{
        opacity: pending ? 0.55 : 1,
        pointerEvents: pending ? "none" : undefined,
        transition: "opacity .15s",
      }}
    >
      {children}
    </div>
  );
}

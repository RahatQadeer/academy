"use client";

import { useFormStatus } from "react-dom";
import { BUTTON_SIZE, type ButtonSize } from "@/client-portal/components/buttons";
import { syncIntegrationNow } from "@/client-portal/lib/actions/integrations";

/**
 * Sync now — the way to ask for a read rather than wait for one.
 *
 * The header keeps a connection current on its own, but it does that in
 * `after()` and only once every ten minutes, so the answer to "I just got an
 * email, why isn't it here" was to refresh twice and wait. This asks, inline,
 * and the screen that returns is drawn from what the press just read.
 *
 * Disabled while it runs, because the reading is a round trip to Gmail and a
 * model call per new message — long enough that a second press is a real
 * possibility, and two concurrent syncs would read the same mail twice.
 */
const SHELL =
  "inline-flex items-center justify-center gap-1.5 rounded-control border border-line-strong bg-surface font-medium no-underline transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50";

function Submit({ sizing }: { sizing: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${SHELL} ${sizing}`}
      style={{ color: "var(--ink)" }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden
        className={pending ? "animate-spin" : undefined}
      >
        <path
          d="M12.5 7a5.5 5.5 0 1 1-1.61-3.89"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M12.5 1.5v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {pending ? "Checking…" : "Sync now"}
    </button>
  );
}

export function SyncNow({
  provider,
  back,
  size = "row",
  sizing,
}: {
  provider: string;
  /** The screen to return to, filters and all — see `backTo` in the action. */
  back: string;
  size?: ButtonSize;
  /** Padding and type in place of `size`, to sit level with a button beside it. */
  sizing?: string;
}) {
  return (
    <form action={syncIntegrationNow}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="back" value={back} />
      <Submit sizing={sizing ?? BUTTON_SIZE[size]} />
    </form>
  );
}

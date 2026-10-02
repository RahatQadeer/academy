"use client";

import { useFormStatus } from "react-dom";

/**
 * The little square beside a task, as a control rather than a picture.
 *
 * A Request's Overview has drawn this box since the screen existed, and it was
 * `aria-hidden` decoration: the one thing on the page that looks like it can
 * be clicked was the one thing that could not. Now it submits.
 *
 * Its own client component only for `useFormStatus` — the tick appears the
 * moment it is pressed rather than when the server comes back, because a
 * checkbox that does nothing for half a second is a checkbox somebody presses
 * twice.
 */
export function TaskTick({ done, label }: { done: boolean; label: string }) {
  const { pending } = useFormStatus();
  const on = pending ? !done : done;

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border p-0 text-[10px] leading-none transition-colors hover:border-[var(--accent)] disabled:cursor-wait"
      style={{
        borderColor: on ? "var(--success-fg)" : "var(--border-strong)",
        background: on ? "var(--success-fg)" : "var(--surface)",
        color: "#fff",
      }}
    >
      {on ? "✓" : ""}
    </button>
  );
}

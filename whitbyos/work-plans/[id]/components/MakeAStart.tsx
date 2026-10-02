"use client";

import { useFormStatus } from "react-dom";
import { SubmitPlain } from "@/base/components/Submit";

/**
 * Whitby making a start, saying so for as long as it takes.
 *
 * The action used to hand the drafting to `after` and redirect at once, so
 * the page navigated, came back unchanged, and told the professional to
 * refresh: three things to watch instead of one result. It waits now, and
 * this says what is happening while it does.
 *
 * Its own component because `useFormStatus` only reports from inside the
 * form, and the card around it is a server component.
 */
export function MakeAStart({ canStart, more }: { canStart: number; more: boolean }) {
  const { pending } = useFormStatus();

  return (
    <>
      <span
        className="min-w-0 flex-1 text-[12px] leading-[1.45]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {pending
          ? `Whitby is writing ${canStart === 1 ? "it" : `all ${canStart}`} now. Up to a minute, and they appear here when it is done.`
          : `${canStart} ${canStart === 1 ? "task needs" : "tasks need"} nobody. Whitby can make a start.`}
      </span>

      <SubmitPlain
        className="shrink-0 cursor-pointer rounded-control border px-2.5 py-[5px] text-[12.5px] font-medium"
        style={{
          borderColor: "color-mix(in srgb, var(--accent) 34%, transparent)",
          background: "var(--surface)",
          color: "var(--accent)",
        }}
      >
        {pending ? "Writing" : more ? "Do the rest" : "Make a start"}
      </SubmitPlain>
    </>
  );
}

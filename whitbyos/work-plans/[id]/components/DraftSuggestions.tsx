"use client";

import { useFormStatus } from "react-dom";
import { SubmitPlain } from "@/base/components/Submit";
import { proposeClientItems } from "@/whitbyos/work-plans/actions";

/**
 * Whitby drafting the suggestions, saying so while it does.
 *
 * `SubmitPlain` already spins and goes unpressable, which is the right amount
 * of signal for a button that saves a row. This one writes several pieces of
 * real content in one model call and can take most of a minute, and a small
 * spinner beside an unchanged label for that long reads as a stuck page. So
 * the label says what is happening and the line beside it says roughly how
 * long, which is the question somebody actually has while waiting.
 *
 * Its own component because `useFormStatus` only reports from inside the
 * form, and the panel around it is a server component.
 */
export function DraftSuggestions({ missing }: { missing: number }) {
  const { pending } = useFormStatus();

  return (
    <>
      <SubmitPlain
        formAction={proposeClientItems}
        className="inline-flex cursor-pointer items-center rounded-control border px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-[var(--accent-tint)]"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
      >
        {pending
          ? "Whitby is drafting"
          : missing === 1
            ? "Let Whitby draft it"
            : `Let Whitby draft ${missing}`}
      </SubmitPlain>

      <span className="text-[11.5px] leading-[1.4]" style={{ color: "var(--text-faint)" }}>
        {pending ? (
          "Writing them now. Up to a minute, and the page will come back with them in."
        ) : (
          <>
            {missing === 1 ? "One box is still empty." : `${missing} boxes are still empty.`}{" "}
            You can write them yourself instead.
          </>
        )}
      </span>
    </>
  );
}

"use client";

import { useFormStatus } from "react-dom";
import { SubmitPlain } from "@/base/components/Submit";
import { saveClientProposals } from "@/whitbyos/work-plans/actions";

/**
 * Keeping the corrections, without leaving the page.
 *
 * Its own component only so the label can say it is working. `SubmitPlain`
 * spins and goes unpressable already, but on the one button whose whole job
 * is "did that save?", the spinner alone is the answer given in the quietest
 * possible way.
 *
 * The action revalidates rather than redirecting, so nothing navigates: the
 * boxes stay where they are with what was typed still in them.
 */
export function SaveSuggestions() {
  const { pending } = useFormStatus();

  return (
    <SubmitPlain
      formAction={saveClientProposals}
      title="Keep what is in the boxes"
      className="inline-flex cursor-pointer items-center rounded-control border px-2.5 py-1 text-[12px] font-medium"
      style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
    >
      {pending ? "Saving" : "Save suggestions"}
    </SubmitPlain>
  );
}

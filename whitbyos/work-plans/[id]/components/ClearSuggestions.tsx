"use client";

import { useFormStatus } from "react-dom";
import { SubmitPlain } from "@/base/components/Submit";
import { clearClientProposals } from "@/whitbyos/work-plans/actions";

/**
 * Clearing the suggestions, on the press rather than on the reply.
 *
 * The server action is what actually clears them, and it takes a round trip.
 * In between, every box still held its text: the suggestions are uncontrolled
 * fields on `defaultValue`, and an uncontrolled field keeps whatever is in it
 * across a re-render. So the screen sat unchanged for a second and then
 * changed, which reads as a button that did nothing and then a page that did
 * something on its own.
 *
 * So the boxes are emptied here, in the click, before the form posts. The
 * action still does the real work, and the empty values it receives mean the
 * same thing they always did: it removes every key it is sent, whatever is in
 * it. The action no longer redirects either, so nothing navigates and the
 * screen never blanks.
 */
export function ClearSuggestions({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <SubmitPlain
      formAction={clearClientProposals}
      title="Empty every suggestion box and start again"
      onClick={(event) => {
        /* The form this button is in, not the whole document: the page has
           one, but a panel that assumed so once already broke when a second
           appeared beside it. */
        const form = event.currentTarget.form;
        if (!form) return;

        for (const field of form.querySelectorAll<HTMLTextAreaElement>(
          'textarea[name^="proposal_"]',
        )) {
          field.value = "";
          /* Back to the height an empty box has. They grow with their
             content, and a cleared one left tall is a row of empty space
             where the suggestion used to be. */
          field.style.height = "";
        }
      }}
      /* Bordered, like the two beside it. It was bare text, which on a row of
         two outlined buttons read as a caption somebody had made clickable.
         The border is the quiet one and the colour only turns on hover, so it
         still sits behind Save without pretending not to be a button. */
      className="inline-flex cursor-pointer items-center rounded-control border px-2.5 py-1 text-[12px] font-medium transition-colors hover:border-[var(--danger-fg)] hover:text-[var(--danger-fg)]"
      style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
    >
      {pending ? "Clearing" : `Clear ${count === 1 ? "the suggestion" : `all ${count}`}`}
    </SubmitPlain>
  );
}
